/**
 * Validate PNG texture files: decode, check dimensions, opacity, and variation.
 * Replaces file-size-based checks so valid compressed PNGs (e.g. 32x32 under 1KB) pass.
 * ensurePngRgba: convert indexed/palette (color type 3) to RGBA so Minecraft accepts the texture.
 */

import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { encodeRawRgbaToPng } from "./texture-png.js";

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
 * Full decode for conversion: read IHDR, PLTE, tRNS, IDAT. Used when colorType is 3 (indexed).
 */
function decodePngWithPalette(
  buffer: Buffer
): { width: number; height: number; colorType: number; raw: Buffer; plte?: Buffer; trns?: Buffer } | null {
  if (buffer.length < 8 || buffer.subarray(0, 8).compare(PNG_SIGNATURE) !== 0) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let plte: Buffer | undefined;
  let trns: Buffer | undefined;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= buffer.length) {
    const chunkLen = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLen);
    offset += 8 + chunkLen + 4;
    if (chunkType === "IHDR") {
      if (chunkLen < 13) return null;
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      colorType = chunkData[9];
    } else if (chunkType === "PLTE") {
      plte = chunkData;
    } else if (chunkType === "tRNS") {
      trns = chunkData;
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
  return { width, height, colorType, raw, plte, trns };
}

/**
 * Convert indexed (color type 3) PNG to RGBA. No-op if already color type 2 or 6.
 * Minecraft rejects palette/indexed (type 3); this ensures all saved PNGs are RGB or RGBA.
 */
export function ensurePngRgba(buffer: Buffer): Buffer {
  const decoded = decodePngWithPalette(buffer);
  if (!decoded) return buffer;
  const { width, height, colorType, raw, plte, trns } = decoded;
  if (colorType === 2 || colorType === 6) return buffer;

  if (colorType === 3 && plte) {
    const rowLen = 1 + width;
    const outRows = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
      const srcRow = y * rowLen;
      const dstRow = y * (1 + width * 4);
      outRows[dstRow] = 0;
      for (let x = 0; x < width; x++) {
        const idx = raw[srcRow + 1 + x];
        const o = dstRow + 1 + x * 4;
        outRows[o] = plte[idx * 3] ?? 0;
        outRows[o + 1] = plte[idx * 3 + 1] ?? 0;
        outRows[o + 2] = plte[idx * 3 + 2] ?? 0;
        outRows[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
    return encodeRawRgbaToPng(width, height, outRows);
  }

  if (colorType === 0) {
    const rowLen = 1 + width;
    const outRows = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
      const srcRow = y * rowLen;
      const dstRow = y * (1 + width * 4);
      outRows[dstRow] = 0;
      for (let x = 0; x < width; x++) {
        const g = raw[srcRow + 1 + x];
        const o = dstRow + 1 + x * 4;
        outRows[o] = g;
        outRows[o + 1] = g;
        outRows[o + 2] = g;
        outRows[o + 3] = 255;
      }
    }
    return encodeRawRgbaToPng(width, height, outRows);
  }

  if (colorType === 4) {
    const rowLen = 1 + width * 2;
    const outRows = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
      const srcRow = y * rowLen;
      const dstRow = y * (1 + width * 4);
      outRows[dstRow] = 0;
      for (let x = 0; x < width; x++) {
        const i = srcRow + 1 + x * 2;
        const g = raw[i];
        const a = raw[i + 1];
        const o = dstRow + 1 + x * 4;
        outRows[o] = g;
        outRows[o + 1] = g;
        outRows[o + 2] = g;
        outRows[o + 3] = a;
      }
    }
    return encodeRawRgbaToPng(width, height, outRows);
  }

  return buffer;
}

/**
 * Read PNG IHDR and return colorType. Fails if not a valid PNG.
 */
export function getPngColorType(buffer: Buffer): number | null {
  const decoded = decodePngRaw(buffer);
  return decoded ? decoded.colorType : null;
}

/** Simple string hash for deterministic per-entity variation. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Extract entity id from texture relPath (e.g. ".../item/ruby.png" -> "ruby"). */
export function entityIdFromRelPath(relPath: string): string {
  const itemMatch = relPath.match(/\/(?:item|block)\/([^/]+)\.png$/i);
  if (itemMatch) return itemMatch[1].toLowerCase();
  const base = relPath.replace(/\.png$/i, "").split("/").pop() ?? "";
  return base.toLowerCase();
}

/**
 * Known entity id -> hue (0–360). Gems and metals get distinct visual identity.
 * Used so ruby = red family, sapphire = blue family, tin = gray, etc.
 */
const KNOWN_HUE_BY_ENTITY_ID: Record<string, number> = {
  ruby: 0,
  sapphire: 220,
  emerald: 120,
  diamond: 200,
  amethyst: 280,
  amber: 45,
  tin: 30,
  raw_tin: 30,
  copper: 25,
  raw_copper: 25,
  iron: 0,
  raw_iron: 0,
  gold: 45,
  raw_gold: 45,
  silver: 0,
  coal: 0,
  lead: 0,
  nickel: 45,
  zinc: 45,
};

/** Deterministic hue (0–360) from entity id; uses known map or hash fallback. */
export function getTargetHueFromEntityId(entityId: string): number {
  const normalized = entityId.toLowerCase().replace(/\s+/g, "_");
  if (KNOWN_HUE_BY_ENTITY_ID[normalized] !== undefined) {
    return KNOWN_HUE_BY_ENTITY_ID[normalized];
  }
  return hashString(normalized) % 360;
}

/** RGB 0–255 -> H 0–360, S 0–1, V 0–1 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return [h, s, v];
}

/** H 0–360, S 0–1, V 0–1 -> R,G,B 0–255 */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Apply semantic color theme from entity id: shift hue toward a deterministic target
 * (e.g. ruby -> red, sapphire -> blue) so textures are perceptually distinct.
 * strength in 0..1: how much to pull pixel hue toward target (default 0.45).
 */
export function applySemanticColorTheme(buffer: Buffer, relPath: string, strength: number = 0.45): Buffer {
  const rgba = ensurePngRgba(buffer);
  const decoded = decodePngRaw(rgba);
  if (!decoded || (decoded.colorType !== 2 && decoded.colorType !== 6)) return rgba;
  const { width, height, colorType, raw } = decoded;
  const rowSize = colorType === 6 ? 1 + width * 4 : 1 + width * 3;
  const bpp = colorType === 6 ? 4 : 3;
  const entityId = entityIdFromRelPath(relPath);
  const targetHue = getTargetHueFromEntityId(entityId);
  const targetSat = 0.6;
  const outRows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    outRows[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * rowSize + 1 + x * bpp;
      const r = raw[i] ?? 0;
      const g = raw[i + 1] ?? 0;
      const b = raw[i + 2] ?? 0;
      const a = bpp === 4 ? (raw[i + 3] ?? 255) : 255;
      const [h, s, v] = rgbToHsv(r, g, b);
      const blend = v > 0.05 ? strength : 0;
      const newH = blend ? (h + (targetHue - h) * blend) % 360 : h;
      const newS = Math.min(1, s * (1 - blend * 0.3) + targetSat * blend * 0.3);
      const [nr, ng, nb] = hsvToRgb(newH < 0 ? newH + 360 : newH, newS, v);
      const o = y * (1 + width * 4) + 1 + x * 4;
      outRows[o] = nr;
      outRows[o + 1] = ng;
      outRows[o + 2] = nb;
      outRows[o + 3] = a;
    }
  }
  return encodeRawRgbaToPng(width, height, outRows);
}

/**
 * Apply deterministic per-entity variation so the same source never produces byte-identical output for different paths.
 * Decodes PNG to raw RGBA, tweaks at least one pixel based on relPath (hue/brightness), re-encodes.
 * Guarantees: output differs from any other relPath; visually similar (minimal change).
 */
export function applyPerEntityVariation(buffer: Buffer, relPath: string): Buffer {
  const rgba = ensurePngRgba(buffer);
  const decoded = decodePngRaw(rgba);
  if (!decoded || (decoded.colorType !== 2 && decoded.colorType !== 6)) return rgba;
  const { width, height, colorType, raw } = decoded;
  const rowSize = colorType === 6 ? 1 + width * 4 : 1 + width * 3;
  const bpp = colorType === 6 ? 4 : 3;
  const h = hashString(relPath);
  const pxIndex = h % (width * height);
  const y = Math.floor(pxIndex / width);
  const x = pxIndex % width;
  const offset = y * rowSize + 1 + x * bpp;
  if (offset + bpp > raw.length) return rgba;
  const delta = (h % 13) - 6;
  raw[offset] = Math.max(0, Math.min(255, (raw[offset] ?? 0) + delta));
  if (bpp >= 3) {
    raw[offset + 1] = Math.max(0, Math.min(255, (raw[offset + 1] ?? 0) + ((h >> 8) % 7) - 3));
    raw[offset + 2] = Math.max(0, Math.min(255, (raw[offset + 2] ?? 0) + ((h >> 16) % 7) - 3));
  }
  if (colorType === 2) {
    const outRows = Buffer.alloc(height * (1 + width * 4));
    for (let yy = 0; yy < height; yy++) {
      outRows[yy * (1 + width * 4)] = 0;
      for (let xx = 0; xx < width; xx++) {
        const src = yy * rowSize + 1 + xx * 3;
        const dst = yy * (1 + width * 4) + 1 + xx * 4;
        outRows[dst] = raw[src] ?? 0;
        outRows[dst + 1] = raw[src + 1] ?? 0;
        outRows[dst + 2] = raw[src + 2] ?? 0;
        outRows[dst + 3] = 255;
      }
    }
    const dstRowSize = 1 + width * 4;
    const dstOffset = y * dstRowSize + 1 + x * 4;
    outRows[dstOffset] = Math.max(0, Math.min(255, outRows[dstOffset] + delta));
    outRows[dstOffset + 1] = Math.max(0, Math.min(255, outRows[dstOffset + 1] + ((h >> 8) % 7) - 3));
    outRows[dstOffset + 2] = Math.max(0, Math.min(255, outRows[dstOffset + 2] + ((h >> 16) % 7) - 3));
    return encodeRawRgbaToPng(width, height, outRows);
  }
  return encodeRawRgbaToPng(width, height, raw);
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
 * Compute a perceptual fingerprint (4x4 grid of average RGB) for duplicate detection.
 * Two textures with the same fingerprint are considered perceptually identical.
 * Returns a string suitable for comparison; decodes PNG internally.
 */
export function perceptualFingerprint(buffer: Buffer): string | null {
  const decoded = decodePngRaw(buffer);
  if (!decoded || (decoded.width < 16 || decoded.height < 16)) return null;
  const { width, height, colorType, raw } = decoded;
  const rowSize = colorType === 6 ? 1 + width * 4 : 1 + width * 3;
  const bpp = colorType === 6 ? 4 : 3;
  const grid = 4;
  const cellW = Math.floor(width / grid);
  const cellH = Math.floor(height / grid);
  const parts: number[] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = gy * cellH; y < (gy + 1) * cellH && y < height; y++) {
        const rowStart = y * rowSize + 1;
        for (let x = gx * cellW; x < (gx + 1) * cellW && x < width; x++) {
          const i = rowStart + x * bpp;
          r += raw[i];
          g += raw[i + 1];
          b += raw[i + 2];
          n++;
        }
      }
      if (n > 0) {
        parts.push(Math.round(r / n), Math.round(g / n), Math.round(b / n));
      }
    }
  }
  return parts.join(",");
}

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
