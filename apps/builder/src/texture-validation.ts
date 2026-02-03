/**
 * Validate PNG texture files: decode, check dimensions, opacity, and variation.
 * Replaces file-size-based checks so valid compressed PNGs (e.g. 32x32 under 1KB) pass.
 */

import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface TextureValidationResult {
  ok: boolean;
  message?: string;
  width?: number;
  height?: number;
  fullyTransparent?: boolean;
  uniqueColorCount?: number;
  samplePixels?: string;
}

/**
 * Minimal PNG decode: read IHDR (width, height, bitDepth, colorType) and decompress IDAT.
 * Supports colorType 6 (RGBA) and 2 (RGB). Returns raw decompressed bytes and dimensions.
 */
function decodePngRaw(buffer: Buffer): { width: number; height: number; colorType: number; raw: Buffer } | null {
  if (buffer.length < 8 || buffer.subarray(0, 8).compare(PNG_SIGNATURE) !== 0) {
    return null;
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= buffer.length) {
    const chunkLen = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLen);
    offset += 8 + chunkLen + 4; // +4 CRC

    if (chunkType === "IHDR") {
      if (chunkLen < 13) return null;
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      colorType = chunkData[9];
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }
  }

  if (width === 0 || height === 0 || idatChunks.length === 0) return null;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idatChunks));
  } catch {
    return null;
  }
  return { width, height, colorType, raw };
}

/**
 * For RGBA (colorType 6): each row = 1 filter byte + width*4 bytes. Check alpha and variation.
 */
function validateRgba(raw: Buffer, width: number, height: number): TextureValidationResult {
  const rowSize = 1 + width * 4;
  const expectedLen = height * rowSize;
  if (raw.length < expectedLen) {
    return { ok: false, message: `IDAT too short: ${raw.length} < ${expectedLen}`, width, height };
  }

  let hasNonZeroAlpha = false;
  const colorSet = new Set<string>();
  const sample: number[] = [];

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize + 1; // skip filter byte
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * 4;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      const a = raw[i + 3];
      if (a !== 0) hasNonZeroAlpha = true;
      colorSet.add(`${r},${g},${b},${a}`);
      if (sample.length < 6) sample.push(r, g, b, a);
    }
  }

  if (!hasNonZeroAlpha) {
    return {
      ok: false,
      message: "Image is fully transparent (all alpha=0)",
      width,
      height,
      fullyTransparent: true,
      uniqueColorCount: colorSet.size,
      samplePixels: sample.slice(0, 12).join(","),
    };
  }

  if (colorSet.size < 2) {
    return {
      ok: false,
      message: "Image has no variation (single flat color)",
      width,
      height,
      fullyTransparent: false,
      uniqueColorCount: 1,
      samplePixels: sample.slice(0, 12).join(","),
    };
  }

  return {
    ok: true,
    width,
    height,
    fullyTransparent: false,
    uniqueColorCount: colorSet.size,
  };
}

/**
 * For RGB (colorType 2): each row = 1 filter byte + width*3. Treat as opaque and check variation.
 */
function validateRgb(raw: Buffer, width: number, height: number): TextureValidationResult {
  const rowSize = 1 + width * 3;
  const expectedLen = height * rowSize;
  if (raw.length < expectedLen) {
    return { ok: false, message: `IDAT too short: ${raw.length} < ${expectedLen}`, width, height };
  }

  const colorSet = new Set<string>();
  const sample: number[] = [];

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize + 1;
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * 3;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      colorSet.add(`${r},${g},${b}`);
      if (sample.length < 6) sample.push(r, g, b);
    }
  }

  if (colorSet.size < 2) {
    return {
      ok: false,
      message: "Image has no variation (single flat color)",
      width,
      height,
      uniqueColorCount: 1,
      samplePixels: sample.slice(0, 9).join(","),
    };
  }

  return { ok: true, width, height, uniqueColorCount: colorSet.size };
}

const MIN_WIDTH = 16;
const MIN_HEIGHT = 16;

/**
 * Validate a PNG buffer: decodable, dimensions >= 16x16, not fully transparent, has pixel variation.
 * Returns result with ok and optional details for logging.
 */
export function validateTexturePngBuffer(buffer: Buffer, _filePath?: string): TextureValidationResult {
  if (buffer.length === 0) {
    return { ok: false, message: "File is 0 bytes" };
  }

  const decoded = decodePngRaw(buffer);
  if (!decoded) {
    return { ok: false, message: "PNG failed to decode (invalid signature or structure)" };
  }

  const { width, height, colorType, raw } = decoded;

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return {
      ok: false,
      message: `Dimensions ${width}x${height} below minimum ${MIN_WIDTH}x${MIN_HEIGHT}`,
      width,
      height,
    };
  }

  if (colorType === 6) {
    return validateRgba(raw, width, height);
  }
  if (colorType === 2) {
    return validateRgb(raw, width, height);
  }

  return {
    ok: false,
    message: `Unsupported PNG color type: ${colorType} (expected 2 or 6)`,
    width,
    height,
  };
}

/**
 * Validate a PNG file on disk; on failure log details and throw.
 */
export function validateTexturePngFile(fullPath: string, relPath: string): void {
  const buffer = readFileSync(fullPath);
  const result = validateTexturePngBuffer(buffer, fullPath);

  if (result.ok) return;

  console.error(`[BUILDER] Texture validation failed: ${relPath}`);
  console.error(`[BUILDER]   message: ${result.message}`);
  if (result.width != null) console.error(`[BUILDER]   decoded width: ${result.width}`);
  if (result.height != null) console.error(`[BUILDER]   decoded height: ${result.height}`);
  if (result.fullyTransparent === true) console.error(`[BUILDER]   fullyTransparent: true`);
  if (result.uniqueColorCount != null) console.error(`[BUILDER]   uniqueColorCount: ${result.uniqueColorCount}`);
  if (result.samplePixels != null) console.error(`[BUILDER]   samplePixels: ${result.samplePixels}`);

  throw new Error(`Texture validation failed: ${result.message} (${relPath})`);
}
