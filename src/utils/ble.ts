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
                resolve();
            } else if (state === "unsupported" || state === "unauthorized") {
                noble.removeListener("stateChange", onState);
                reject(new Error(`Bluetooth state: ${state}`));
            }
        };
        noble.on("stateChange", onState);
    });
};

const discoverByAddress = async (addressOrId: string, scanMs = 8000): Promise<Peripheral> => {
    const target = addressOrId.trim().toLowerCase();
    if (!target) throw new Error("Empty peripheral id/address");

    await waitForPoweredOn();

    return await new Promise<Peripheral>((resolve, reject) => {
        const timeout = setTimeout(() => {
            noble.removeListener("discover", onDiscover);
            void noble.stopScanningAsync().catch(() => undefined);
            reject(new Error(`Peripheral not found within ${scanMs}ms: ${target}`));
        }, scanMs);

        const onDiscover = (p: Peripheral) => {
            const addr = (p.address ?? "").toLowerCase();
            const id = (p.id ?? "").toLowerCase();
            if (addr === target || id === target) {
                clearTimeout(timeout);
                noble.removeListener("discover", onDiscover);
                void noble.stopScanningAsync().catch(() => undefined);
                resolve(p);
            }
        };

        noble.on("discover", onDiscover);
        void noble.startScanningAsync([], false).catch((e) => {
            clearTimeout(timeout);
            noble.removeListener("discover", onDiscover);
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

    await peripheral.connectAsync();

    const services = await peripheral.discoverServicesAsync([]);
    const vendorService = findVendorService(services);
    const vendorServiceUuid = normalizeUuid(vendorService.uuid);

    const characteristics = await vendorService.discoverCharacteristicsAsync([]);

    const writable = characteristics.filter(isWritable);
    const statusChar = characteristics.find(isStatusChar);

    const { securityChar, commandChar } = await unlockAndSelectChars(writable);

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
        await d.commandChar.writeAsync(buildClearCommand(), false);
    } finally {
        await d.peripheral.disconnectAsync().catch(() => undefined);
    }
};

export const flashRgb = async (addressOrId: string, params: RgbCommandParams): Promise<void> => {
    const d = await connectAndUnlock(addressOrId);
    try {
        const payload = buildRgbCommand(params);
        const withoutResponse = d.commandChar.properties.includes("writeWithoutResponse");
        await d.commandChar.writeAsync(payload, withoutResponse);
    } finally {
        await d.peripheral.disconnectAsync().catch(() => undefined);
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
    } finally {
        await d.peripheral.disconnectAsync().catch(() => undefined);
    }
};
