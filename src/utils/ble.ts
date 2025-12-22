import crypto from "node:crypto";
import noble, { Characteristic, Peripheral, Service } from "@abandonware/noble";

export type RgbCommandParams = {
    red: number;
    green: number;
    blue: number;
    onMs: number;
    offMs: number;
    workMs: number;
};

export type ConnectDetails = {
    peripheral: Peripheral;
    vendorServiceUuid: string;
    securityChar: Characteristic;
    commandChar: Characteristic;
    statusChar?: Characteristic;
};

const SECURITY_KEY_HEX = "9b609f28bc49e25729bd7b8df22b4420";
const SECURITY_KEY = Buffer.from(SECURITY_KEY_HEX, "hex");

const STANDARD_SERVICES = new Set(["1800", "1801"]);
const A500_CHUNK_DATA_BYTES_DEFAULT = 200;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log = (...args: unknown[]) => console.log('[BLE]', ...args);

const normalizeUuid = (uuid: string) => uuid.replace(/-/g, "").toLowerCase();
const is128BitUuid = (uuid: string) => normalizeUuid(uuid).length > 4;

const isWritable = (c: Characteristic) =>
    c.properties.includes("write") || c.properties.includes("writeWithoutResponse");

const isReadable = (c: Characteristic) => c.properties.includes("read");

const isStatusChar = (c: Characteristic) => {
    const hasRead = c.properties.includes("read");
    const hasWrite = isWritable(c);
    const hasNotify = c.properties.includes("notify");
    return hasRead && !hasWrite && hasNotify;
};

const aesEcbEncrypt16 = (random16: Buffer): Buffer => {
    if (random16.length !== 16) throw new Error(`Expected 16 bytes, got ${random16.length}`);
    const cipher = crypto.createCipheriv("aes-128-ecb", SECURITY_KEY, null);
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(random16), cipher.final()]);
};

export const buildA500Block = (offset: number, chunk: Buffer): Buffer => {
    const header = Buffer.alloc(2 + 4);
    header[0] = 0x00;
    header[1] = 0xa5;
    header.writeUInt32LE(offset >>> 0, 2);
    return Buffer.concat([header, chunk]);
};

export const buildA501Commit = (pictureSize: number): Buffer => {
    const buf = Buffer.alloc(2 + 4);
    buf[0] = 0x01;
    buf[1] = 0xa5;
    buf.writeUInt32LE(pictureSize >>> 0, 2);
    return buf;
};

export const buildRgbCommand = (p: RgbCommandParams): Buffer => {
    const buf = Buffer.alloc(2 + 3 + 2 + 2 + 4);
    let o = 0;

    buf[o++] = 0x08;
    buf[o++] = 0xa5;

    buf[o++] = clampByte(p.red);
    buf[o++] = clampByte(p.green);
    buf[o++] = clampByte(p.blue);

    buf.writeUInt16LE(p.onMs >>> 0, o);
    o += 2;
    buf.writeUInt16LE(p.offMs >>> 0, o);
    o += 2;
    buf.writeUInt32LE(p.workMs >>> 0, o);
    o += 4;

    return buf;
};

export const buildClearCommand = (): Buffer => Buffer.from([0x04, 0xa5]);

const clampByte = (v: number): number => Math.max(0, Math.min(255, v | 0));


const waitForPoweredOn = async (): Promise<void> => {
    if (noble._state === "poweredOn") return;

    await new Promise<void>((resolve, reject) => {
        const onState = (state: string) => {
            if (state === "poweredOn") {
                noble.removeListener("stateChange", onState);
                log('Adapter powered on');
                resolve();
            } else if (state === "unsupported" || state === "unauthorized") {
                noble.removeListener("stateChange", onState);
                reject(new Error(`Bluetooth state: ${state}`));
            }
        };
        log('Waiting for Bluetooth adapter to power on...');
        noble.on("stateChange", onState);
    });
};

const discoverByAddress = async (addressOrId: string, scanMs = 30000): Promise<Peripheral> => {
    const target = addressOrId.trim().toLowerCase();
    if (!target) throw new Error("Empty peripheral id/address");

    await waitForPoweredOn();

    return await new Promise<Peripheral>((resolve, reject) => {
        log('Starting scan for target', target, `timeout=${scanMs}ms`);
        const timeout = setTimeout(() => {
            noble.removeListener("discover", onDiscover);
            void noble.stopScanningAsync().catch(() => undefined);
            log('Scan timeout; target not found', target);
            reject(new Error(`Peripheral not found within ${scanMs}ms: ${target}`));
        }, scanMs);

        const onDiscover = (p: Peripheral) => {
            const addr = (p.address ?? "").toLowerCase();
            const id = (p.id ?? "").toLowerCase();
            const advertName = `WL${target.replace("66:66", "").replaceAll(":", "").toUpperCase()}`;
            if (p.advertisement?.localName) {
                log('Discovered', { id, addr, name: p.advertisement.localName });
            }
            if (addr === target || id === target || p.advertisement.localName?.toUpperCase() === advertName) {
                clearTimeout(timeout);
                noble.removeListener("discover", onDiscover);
                void noble.stopScanningAsync().catch(() => undefined);
                log('Matched target peripheral', { id, addr, name: p.advertisement?.localName });
                resolve(p);
            }
        };

        noble.on("discover", onDiscover);
        void noble.startScanningAsync([], false).catch((e) => {
            clearTimeout(timeout);
            noble.removeListener("discover", onDiscover);
            log('Failed to start scanning', e);
            reject(e);
        });
    });
};

const findVendorService = (services: readonly Service[]): Service => {
    for (const s of services) {
        const u = normalizeUuid(s.uuid);
        const isStandard = STANDARD_SERVICES.has(u);
        if (!isStandard && is128BitUuid(u)) return s;
    }
    throw new Error("No vendor ESL service found on this device");
};

const unlockAndSelectChars = async (
    writable: readonly Characteristic[]
): Promise<{ securityChar: Characteristic; commandChar: Characteristic }> => {
    if (writable.length === 0) throw new Error("No writable characteristics on vendor service");

    let securityChar: Characteristic | undefined;
    let random: Buffer | undefined;

    for (const c of writable) {
        if (!isReadable(c)) continue;
        try {
            const data = await c.readAsync();
            if (data.length === 16) {
                securityChar = c;
                random = data;
                break;
            }
        } catch {
            // ignore probing failures
        }
    }

    if (!securityChar || !random) {
        throw new Error("Could not find security characteristic (no 16-byte random read)");
    }

    const cipher = aesEcbEncrypt16(random);
    await securityChar.writeAsync(cipher, false);

    await sleep(100);

    const commandChar = writable.find((c) => c.uuid !== securityChar!.uuid) ?? securityChar;
    return { securityChar, commandChar };
};

export const connectAndUnlock = async (addressOrId: string): Promise<ConnectDetails> => {
    const peripheral = await discoverByAddress(addressOrId);

    log('Connecting to peripheral', { id: peripheral.id, addr: peripheral.address });
    await peripheral.connectAsync();
    log('Connected');

    const services = await peripheral.discoverServicesAsync([]);
    const vendorService = findVendorService(services);
    const vendorServiceUuid = normalizeUuid(vendorService.uuid);
    log('Vendor service found', vendorServiceUuid);

    const characteristics = await vendorService.discoverCharacteristicsAsync([]);

    const writable = characteristics.filter(isWritable);
    const statusChar = characteristics.find(isStatusChar);
    log('Characteristics', { total: characteristics.length, writable: writable.length, hasStatus: !!statusChar });

    const { securityChar, commandChar } = await unlockAndSelectChars(writable);
    log('Unlocked and selected chars', { securityChar: securityChar.uuid, commandChar: commandChar.uuid });

    return {
        peripheral,
        vendorServiceUuid,
        securityChar,
        commandChar,
        statusChar: statusChar ?? undefined,
    };
};


export const readStatus = async (d: ConnectDetails): Promise<{ busy: boolean; errByte: number; errors: string[] }> => {
    if (!d.statusChar) return { busy: false, errByte: 0, errors: [] };
    const bytes = await d.statusChar.readAsync();
    if (bytes.length < 2) return { busy: false, errByte: 0, errors: [] };

    const busy = (bytes[0] & 0x01) === 1;
    const errByte = bytes[1];

    const errors: string[] = [];
    if (errByte & (1 << 0)) errors.push("EPD init error");
    if (errByte & (1 << 1)) errors.push("EPD write error");
    if (errByte & (1 << 2)) errors.push("Data decompression error");
    if (errByte & (1 << 3)) errors.push("OTA error");
    if (errByte & (1 << 5)) errors.push("Unlock failed");

    return { busy, errByte, errors };
};

export const clearDevice = async (addressOrId: string): Promise<void> => {
    const d = await connectAndUnlock(addressOrId);
    try {
        log('Sending clear command');
        await d.commandChar.writeAsync(buildClearCommand(), false);
        log('Clear command sent');
    } finally {
        log('Disconnecting');
        await d.peripheral.disconnectAsync().catch(() => undefined);
        log('Disconnected');
    }
};

export const flashRgb = async (addressOrId: string, params: RgbCommandParams): Promise<void> => {
    const d = await connectAndUnlock(addressOrId);
    try {
        const payload = buildRgbCommand(params);
        log('Sending RGB command', params);
        await d.commandChar.writeAsync(payload, false);
        log('RGB command sent (write-with-response)');
        await waitForIdleOrTimeout(d, 500);
    } finally {
        log('Disconnecting');
        await d.peripheral.disconnectAsync().catch(() => undefined);
        log('Disconnected');
    }
};

export const sendFrameNonCompressedA500A501 = async (
    addressOrId: string,
    frameBytes: Uint8Array,
    opts?: { chunkBytes?: number; interChunkDelayMs?: number }
): Promise<void> => {
    const chunkBytes = opts?.chunkBytes ?? A500_CHUNK_DATA_BYTES_DEFAULT;
    const delayMs = opts?.interChunkDelayMs ?? 4;

    const d = await connectAndUnlock(addressOrId);
    try {
        log('Sending frame (non-compressed)', { totalBytes: frameBytes.length, chunkBytes, delayMs });
        const data = Buffer.from(frameBytes);
        const total = data.length;

        let offset = 0;
        while (offset < total) {
            const remaining = total - offset;
            const blockSize = Math.min(chunkBytes, remaining);
            const chunk = data.subarray(offset, offset + blockSize);

            const a500 = buildA500Block(offset, chunk);

            await d.commandChar.writeAsync(a500, false);

            offset += blockSize;
            if (delayMs > 0) await sleep(delayMs);
        }

        const a501 = buildA501Commit(total);
        await d.commandChar.writeAsync(a501, false);
        log('Frame commit sent');
    } finally {
        log('Disconnecting');
        await d.peripheral.disconnectAsync().catch(() => undefined);
        log('Disconnected');
    }
};

const waitForIdleOrTimeout = async (d: ConnectDetails, timeoutMs = 500): Promise<void> => {
    const start = Date.now();
    if (!d.statusChar) {
        await sleep(Math.min(timeoutMs, 200));
        return;
    }
    while (Date.now() - start < timeoutMs) {
        try {
            const s = await readStatus(d);
            log('Status', s);
            if (!s.busy) return;
        } catch (e) {
            log('Status read failed', e);
            return;
        }
        await sleep(100);
    }
};
