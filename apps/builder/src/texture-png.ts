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
 * Generate a 32x32 RGBA image: base color + per-pixel noise (deterministic from seed).
 * Guarantees: alpha=255 everywhere (opaque), at least two distinct pixel values (noise ±12 per channel).
 */
export function generateOpaquePng16x16(options: {
  material?: string;
  /** Override color hint e.g. "yellow" -> [255,255,0] */
  colorHint?: string;
  /** Optional seed for deterministic noise (e.g. modId + contentId). */
  seed?: string;
}): Buffer {
  const result = generateOpaquePng16x16WithProfile({
    ...options,
    textureProfile: undefined,
  });
  return result.buffer;
}

export interface TextureProfileForGenerator {
  intent?: string;
  materialHint?: string;
  materialClass?: string;
  physicalTraits?: string[];
  surfaceStyle?: string[];
  visualMotifs?: string[];
}

export interface GenerateTextureResult {
  buffer: Buffer;
  motifsApplied: string[];
  materialClassApplied: string;
}

/**
 * Profile-driven texture: base + noise + motif stamps (e.g. holes). Records what was applied for manifest.
 */
export function generateOpaquePng16x16WithProfile(options: {
  material?: string;
  colorHint?: string;
  seed?: string;
  textureProfile?: TextureProfileForGenerator | null;
}): GenerateTextureResult {
  const { material = "generic", colorHint, seed = "default", textureProfile } = options;
  let [r, g, b] = colorHint ? colorHintToRgb(colorHint) : materialToRgb(material);
  const materialClassApplied = textureProfile?.materialClass ?? "generic";
  const motifsRequested = textureProfile?.visualMotifs ?? [];
  const motifsApplied: string[] = [];

  const W = 32;
  const H = 32;
  const rowSize = 1 + W * 4;
  const rawRows: number[] = [];

  for (let y = 0; y < H; y++) {
    rawRows.push(0);
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

  const pixelIdx = (x: number, y: number) => 1 + y * rowSize + x * 4;
  const getPixel = (x: number, y: number): [number, number, number] => {
    const i = pixelIdx(x, y);
    return [rawRows[i] ?? 0, rawRows[i + 1] ?? 0, rawRows[i + 2] ?? 0];
  };
  const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = pixelIdx(x, y);
    rawRows[i] = Math.max(0, Math.min(255, r));
    rawRows[i + 1] = Math.max(0, Math.min(255, g));
    rawRows[i + 2] = Math.max(0, Math.min(255, b));
  };
  const darken = (x: number, y: number, factor: number) => {
    const [rr, gg, bb] = getPixel(x, y);
    setPixel(x, y, rr * factor, gg * factor, bb * factor);
  };

  if (motifsRequested.includes("holes") && seed) {
    const numHoles = 2 + (Math.floor(hashToFloat(seed + "-holes") * 2) % 2);
    for (let i = 0; i < numHoles; i++) {
      const cx = Math.floor(hashToFloat(seed + `-hole-${i}-x`) * (W - 6)) + 3;
      const cy = Math.floor(hashToFloat(seed + `-hole-${i}-y`) * (H - 6)) + 3;
      const radius = 2 + (i % 2);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            darken(cx + dx, cy + dy, 0.4);
          }
        }
      }
    }
    motifsApplied.push("holes");
  }

  if (motifsRequested.includes("grain") && seed) {
    for (let x = 0; x < W; x++) {
      const streak = hashToFloat(seed + "-grain-x-" + x) > 0.5 || x % 4 === 0;
      if (!streak) continue;
      for (let y = 0; y < H; y++) darken(x, y, 0.85);
    }
    motifsApplied.push("grain");
  }

  if (motifsRequested.includes("strata") && seed) {
    for (let y = 0; y < H; y++) {
      const band = Math.floor(y / 4);
      const delta = (hashToFloat(seed + "-strata-" + band) - 0.5) * 35;
      for (let x = 0; x < W; x++) {
        const [rr, gg, bb] = getPixel(x, y);
        setPixel(x, y, rr + delta, gg + delta, bb + delta);
      }
    }
    motifsApplied.push("strata");
  }

  if (motifsRequested.includes("veins") && seed) {
    const numVeins = 2 + (Math.floor(hashToFloat(seed + "-veins") * 2) % 2);
    for (let v = 0; v < numVeins; v++) {
      const x0 = Math.floor(hashToFloat(seed + "-v" + v + "-x0") * W);
      const y0 = Math.floor(hashToFloat(seed + "-v" + v + "-y0") * H);
      const x1 = Math.floor(hashToFloat(seed + "-v" + v + "-x1") * W);
      const y1 = Math.floor(hashToFloat(seed + "-v" + v + "-y1") * H);
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let t = 0; t <= steps; t++) {
        const x = Math.round(x0 + (t / steps) * (x1 - x0));
        const y = Math.round(y0 + (t / steps) * (y1 - y0));
        darken(x, y, 0.6);
        if (x + 1 < W) darken(x + 1, y, 0.75);
        if (y + 1 < H) darken(x, y + 1, 0.75);
      }
    }
    motifsApplied.push("veins");
  }

  if (motifsRequested.includes("bubbles") && seed) {
    const numBubbles = 2 + (Math.floor(hashToFloat(seed + "-bubbles") * 2) % 2);
    for (let i = 0; i < numBubbles; i++) {
      const cx = Math.floor(hashToFloat(seed + `-bub-${i}-x`) * (W - 8)) + 4;
      const cy = Math.floor(hashToFloat(seed + `-bub-${i}-y`) * (H - 8)) + 4;
      const radius = 2 + (i % 2);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const x = cx + dx;
            const y = cy + dy;
            const [rr, gg, bb] = getPixel(x, y);
            const inner = dx * dx + dy * dy <= (radius * 0.5) ** 2;
            const mul = inner ? 1.15 : 0.75;
            setPixel(x, y, rr * mul, gg * mul, bb * mul);
          }
        }
      }
    }
    motifsApplied.push("bubbles");
  }

  if (motifsRequested.includes("flakes") && seed) {
    const numFlakes = 8 + (Math.floor(hashToFloat(seed + "-flakes") * 8) % 8);
    for (let i = 0; i < numFlakes; i++) {
      const fx = Math.floor(hashToFloat(seed + "-flake-" + i + "-x") * W) % W;
      const fy = Math.floor(hashToFloat(seed + "-flake-" + i + "-y") * H) % H;
      darken(fx, fy, 0.5);
      if (fx + 1 < W) darken(fx + 1, fy, 0.6);
      if (fy + 1 < H) darken(fx, fy + 1, 0.6);
    }
    motifsApplied.push("flakes");
  }

  if (motifsRequested.includes("rings") && seed) {
    const cx = W / 2 - 0.5;
    const cy = H / 2 - 0.5;
    for (const r of [6, 12, 18]) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (Math.abs(d - r) < 1.2) darken(x, y, 0.65);
        }
      }
    }
    motifsApplied.push("rings");
  }

  const rawData = Buffer.from(rawRows);
  const compressed = deflateSync(rawData, { level: 6 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const out: Buffer[] = [PNG_SIGNATURE];
  writeChunk(out, "IHDR", ihdr);
  writeChunk(out, "IDAT", compressed);
  writeChunk(out, "IEND", Buffer.alloc(0));

  return {
    buffer: Buffer.concat(out),
    motifsApplied,
    materialClassApplied,
  };
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
