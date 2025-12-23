export const WIDTH = 128;
export const HEIGHT = 296;

const PIXELS_PER_BYTE = 4;

export type ColourCode = 0 | 1 | 2 | 3;

export const COLOUR_WHITE: ColourCode = 1;
export const COLOUR_BLACK: ColourCode = 0;
export const COLOUR_RED: ColourCode = 3;
export const COLOUR_YELLOW: ColourCode = 2;

export const createFrame = (width: number, height: number, fill: ColourCode = COLOUR_WHITE): Uint8Array => {
    const bytesPerRow = Math.ceil(width / PIXELS_PER_BYTE);
    const frameSize = bytesPerRow * height;
    const buffer = new Uint8Array(frameSize);
    if (fill === COLOUR_WHITE) return buffer;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            setPixelSized(buffer, width, height, x, y, fill);
        }
    }

    return buffer;
};

export const createFrameSized = (
    width: number,
    height: number,
    fill: ColourCode = COLOUR_WHITE,
): Uint8Array => {
    const bytesPerRow = Math.ceil(width / PIXELS_PER_BYTE);
    const frameSize = bytesPerRow * height;
    const buffer = new Uint8Array(frameSize);
    if (fill === COLOUR_WHITE) return buffer;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            setPixelSized(buffer, width, height, x, y, fill);
        }
    }

    return buffer;
};

export const setPixel = (
    buffer: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    colour: ColourCode,
): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const bytesPerRow = Math.ceil(width / PIXELS_PER_BYTE);
    const byteIndex = y * bytesPerRow + (x >> 2);
    const pixelInByte = x & 0b11;

    const shift = (3 - pixelInByte) * 2;
    const mask = ~(0b11 << shift) & 0xff;

    const value = buffer[byteIndex] & mask;
    buffer[byteIndex] = value | ((colour & 0b11) << shift);
};

export const setPixelSized = (
    buffer: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    colour: ColourCode,
): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const bytesPerRow = Math.ceil(width / PIXELS_PER_BYTE);
    const byteIndex = y * bytesPerRow + (x >> 2);
    const pixelInByte = x & 0b11;

    const shift = (3 - pixelInByte) * 2;
    const mask = ~(0b11 << shift) & 0xff;

    const value = buffer[byteIndex] & mask;
    buffer[byteIndex] = value | ((colour & 0b11) << shift);
};

export type RgbaImage = {
    width: number;
    height: number;
    data: Uint8ClampedArray | Uint8Array;
};

type PaletteEntry = {
    code: ColourCode;
    r: number;
    g: number;
    b: number;
};

const PALETTE: PaletteEntry[] = [
    { code: COLOUR_WHITE, r: 255, g: 255, b: 255 },
    { code: COLOUR_BLACK, r: 0, g: 0, b: 0 },
    { code: COLOUR_RED, r: 255, g: 0, b: 0 },
    { code: COLOUR_YELLOW, r: 255, g: 220, b: 0 },
];

export const quantisePixel = (
    r: number,
    g: number,
    b: number,
    a: number,
): ColourCode => {
    if (a < 128) {
        return COLOUR_WHITE;
    }

    let best: PaletteEntry = PALETTE[0];
    let bestDist = Number.POSITIVE_INFINITY;

    for (const entry of PALETTE) {
        const dr = r - entry.r;
        const dg = g - entry.g;
        const db = b - entry.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
            bestDist = dist;
            best = entry;
        }
    }

    return best.code;
};

export const convertRgbaToEslFrame = (
    img: RgbaImage,
    width = WIDTH,
    height = HEIGHT,
): number[] => {
    return convertRgbaToEslFrameSized(img, width, height);
};

export const convertRgbaToEslFrameSized = (
    img: RgbaImage,
    targetWidth: number,
    targetHeight: number,
): number[] => {
    const { width: srcW, height: srcH, data } = img;

    const needsRotation = targetWidth === 296 && targetHeight === 128;
    const frameWidth = needsRotation ? 128 : targetWidth;
    const frameHeight = needsRotation ? 296 : targetHeight;

    const frame = createFrameSized(frameWidth, frameHeight, COLOUR_WHITE);
    const frameArr: Uint8Array<ArrayBufferLike> & any = Array.isArray(frame) ? frame : Array.from(frame);

    if (needsRotation) {
        for (let fy = 0; fy < frameHeight; fy += 1) {
            const srcX = Math.min(
                srcW - 1,
                Math.max(0, Math.floor(((fy + 0.5) * srcW) / frameHeight)),
            );

            for (let fx = 0; fx < frameWidth; fx += 1) {
                const srcY = Math.min(
                    srcH - 1,
                    Math.max(0, Math.floor(((fx + 0.5) * srcH) / frameWidth)),
                );

                const idx = (srcY * srcW + srcX) * 4;
                const r = data[idx + 0];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                const colour = quantisePixel(r, g, b, a);
                setPixelSized(frameArr, frameWidth, frameHeight, fx, fy, colour);
            }
        }
    } else {
        for (let y = 0; y < targetHeight; y += 1) {
            const srcY = Math.min(
                srcH - 1,
                Math.max(0, Math.floor(((y + 0.5) * srcH) / targetHeight)),
            );

            for (let x = 0; x < targetWidth; x += 1) {
                const srcX = Math.min(
                    srcW - 1,
                    Math.max(0, Math.floor(((x + 0.5) * srcW) / targetWidth)),
                );

                const idx = (srcY * srcW + srcX) * 4;
                const r = data[idx + 0];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                const colour = quantisePixel(r, g, b, a);
                setPixelSized(frameArr, targetWidth, targetHeight, x, y, colour);
            }
        }
    }

    return frameArr;
};