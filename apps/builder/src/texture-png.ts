/**
 * Generate real 32x32 opaque PNGs for block/item textures (output >1KB; Minecraft scales as needed).
 * No external deps: Node zlib + Buffer only. Used when materializer leaves PNG contents empty.
 * Material → base color; add simple noise so texture is not flat. Alpha 255 everywhere.
 */

import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC32 table for PNG chunk checksums (IEEE polynomial). */
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeChunk(out: Buffer[], type: string, data: Buffer): void {
  const typeBuf = Buffer.from(type, "ascii");
  const combined = Buffer.concat([typeBuf, data]);
  const crc = crc32(combined);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  out.push(len, typeBuf, data, crcBuf);
}

/** Material → [R, G, B] 0–255. Opaque, visible in-game. */
function materialToRgb(material: string): [number, number, number] {
  switch (material) {
    case "wood":
      return [139, 90, 43];
    case "stone":
      return [128, 128, 128];
    case "metal":
      return [192, 192, 192];
    case "gem":
      return [148, 0, 211];
    case "food":
    case "organic":
      return [218, 165, 32]; // golden / honey
    default:
      return [128, 128, 128]; // generic gray
  }
}

/** Hash a string to a deterministic 0–1 value. */
function hashToFloat(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Generate a 32x32 RGBA image: base color + subtle noise. Alpha 255 everywhere (opaque).
 * Returns a valid PNG file as Buffer (typically >1KB after compression).
 */
export function generateOpaquePng16x16(options: {
  material?: string;
  /** Override color hint e.g. "yellow" -> [255,255,0] */
  colorHint?: string;
  /** Optional seed for deterministic noise (e.g. modId + contentId). */
  seed?: string;
}): Buffer {
  const { material = "generic", colorHint, seed = "default" } = options;
  let [r, g, b] = colorHint ? colorHintToRgb(colorHint) : materialToRgb(material);

  const W = 32;
  const H = 32;
  const rawRows: number[] = [];

  for (let y = 0; y < H; y++) {
    rawRows.push(0); // filter type 0 (None)
    for (let x = 0; x < W; x++) {
      const n = (hashToFloat(`${seed}-${x}-${y}`) - 0.5) * 24;
      rawRows.push(
        Math.max(0, Math.min(255, r + n)),
        Math.max(0, Math.min(255, g + n)),
        Math.max(0, Math.min(255, b + n)),
        255
      );
    }
  }

  const rawData = Buffer.from(rawRows);
  const compressed = deflateSync(rawData, { level: 6 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const out: Buffer[] = [PNG_SIGNATURE];
  writeChunk(out, "IHDR", ihdr);
  writeChunk(out, "IDAT", compressed);
  writeChunk(out, "IEND", Buffer.alloc(0));

  return Buffer.concat(out);
}

function colorHintToRgb(hint: string): [number, number, number] {
  const h = hint.toLowerCase().trim();
  if (h.includes("yellow")) return [240, 220, 80];
  if (h.includes("red")) return [200, 60, 60];
  if (h.includes("blue")) return [80, 120, 200];
  if (h.includes("green")) return [80, 180, 80];
  if (h.includes("orange")) return [230, 150, 50];
  if (h.includes("purple") || h.includes("violet")) return [160, 80, 180];
  if (h.includes("white")) return [240, 240, 240];
  if (h.includes("black")) return [40, 40, 40];
  if (h.includes("gray") || h.includes("grey")) return [140, 140, 140];
  return [128, 128, 128];
}
