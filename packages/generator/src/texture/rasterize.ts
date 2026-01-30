/**
 * Visual preview synthesis — actual pixels.
 * Rasterization is deterministic, semantic-free, and never blocks generation.
 * Purely derived from FinalTexturePlan. No randomness beyond seed.
 * NEVER generate flat or uniform textures.
 */

import type { FinalTexturePlan } from "./synthesize.js";

export type RasterizedTexture = {
  size: number;
  pixels: Uint8ClampedArray;
  hash: string;
  metadata: {
    paletteUsed: string[];
    motifsUsed: string[];
    style: string;
  };
};

/** Deterministic hash from string. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic 2D value noise from seed + scale. Returns [0,1). */
function valueNoise(seed: string, x: number, y: number, scale: number): number {
  const sx = Math.floor(x * scale) >>> 0;
  const sy = Math.floor(y * scale) >>> 0;
  const h = hashStr(`${seed}:${sx}:${sy}`);
  return (h % 65536) / 65536;
}

/** Smoothed noise (bilinear). */
function noise(seed: string, x: number, y: number, scale: number): number {
  const fx = x * scale - Math.floor(x * scale);
  const fy = y * scale - Math.floor(y * scale);
  const n00 = valueNoise(seed, Math.floor(x * scale) / scale, Math.floor(y * scale) / scale, scale);
  const n10 = valueNoise(seed, Math.floor(x * scale + 1) / scale, Math.floor(y * scale) / scale, scale);
  const n01 = valueNoise(seed, Math.floor(x * scale) / scale, Math.floor(y * scale + 1) / scale, scale);
  const n11 = valueNoise(seed, Math.floor(x * scale + 1) / scale, Math.floor(y * scale + 1) / scale, scale);
  const nx = fx * fx * (3 - 2 * fx);
  const ny = fy * fy * (3 - 2 * fy);
  return n00 * (1 - nx) * (1 - ny) + n10 * nx * (1 - ny) + n01 * (1 - nx) * ny + n11 * nx * ny;
}

/** Parse hex to R,G,B. */
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace(/^#/, "").match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!m) return [128, 128, 128];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Clamp to Minecraft-safe range (avoid too dark/bright). */
function clampVanilla(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 16) {
    const mid = (r + g + b) / 3;
    return [Math.max(40, Math.min(255, mid)), Math.max(40, Math.min(255, mid)), Math.max(40, Math.min(255, mid))];
  }
  return [
    Math.max(40, Math.min(255, r)),
    Math.max(40, Math.min(255, g)),
    Math.max(40, Math.min(255, b)),
  ];
}

/** Content hash of pixel array. */
function contentHash(pixels: Uint8ClampedArray): string {
  let h = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    h = (h * 31 + pixels[i] + pixels[i + 1] * 257 + pixels[i + 2] * 65537) >>> 0;
  }
  return "r" + h.toString(16);
}

/**
 * Rasterize FinalTexturePlan to pixels. Deterministic per (plan + size + seed).
 * Uses proceduralSpec.baseNoise, detailLayers, palette; glowMask as alpha/emissive.
 * NEVER produces flat or uniform textures.
 */
export function rasterizeTexture(
  plan: FinalTexturePlan,
  size: 16 | 32,
  seed: string
): RasterizedTexture {
  const { palette, proceduralSpec, styledSpec } = plan;
  const colors = palette.colors.length >= 3 ? palette.colors : ["#9370DB", "#8A2BE2", "#4A3728"];
  const rgbPalette = colors.map(hexToRgb);
  const scale = proceduralSpec.scale * (size / 16);
  const contrast = proceduralSpec.contrast;
  const glowMask = proceduralSpec.postProcess.glowMask ?? false;
  const vanillaClamp = styledSpec.vanillaColorClamp ?? false;

  const pixels = new Uint8ClampedArray(size * size * 4);
  const noiseSeed = seed + plan.motifs.primaryMotif;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;

      let v = noise(noiseSeed, nx, ny, 4 * scale);
      v = v * contrast + (1 - contrast) * 0.5;
      v = Math.max(0, Math.min(1, v));

      for (const layer of proceduralSpec.detailLayers) {
        const layerSeed = noiseSeed + layer.type;
        const lv = noise(layerSeed, nx * 2, ny * 2, 3) * layer.intensity;
        if (layer.type === "drip") v = v * (1 - 0.3 * lv) + (ny * lv) * 0.3;
        else if (layer.type === "veins") v = v + (noise(layerSeed, nx * 5, ny * 5, 2) - 0.5) * layer.intensity;
        else if (layer.type === "sparkles") v = v + (v > 0.6 ? layer.intensity * 0.3 : 0);
        else if (layer.type === "swirl") v = v + (Math.sin(nx * 10 + ny * 10) * 0.5 + 0.5) * layer.intensity * 0.2;
        else v = v + (noise(layerSeed, nx, ny, 6) - 0.5) * layer.intensity * 0.5;
      }

      v = Math.max(0, Math.min(1, v));
      const palIdx = Math.floor(v * (rgbPalette.length - 0.01)) % rgbPalette.length;
      let [r, g, b] = rgbPalette[palIdx];

      const variation = noise(noiseSeed + "v", x, y, 8) * 0.15 + 0.92;
      r = Math.floor(r * variation);
      g = Math.floor(g * variation);
      b = Math.floor(b * variation);

      if (vanillaClamp) {
        [r, g, b] = clampVanilla(r, g, b);
      }

      const alpha = glowMask ? 200 + Math.floor(55 * (noise(noiseSeed + "g", nx, ny, 2))) : 255;

      const i = (y * size + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = Math.min(255, alpha);
    }
  }

  const hash = contentHash(pixels);
  return {
    size,
    pixels,
    hash,
    metadata: {
      paletteUsed: colors.slice(0, 6),
      motifsUsed: [plan.motifs.primaryMotif, ...plan.motifs.secondaryMotifs],
      style: styledSpec.style,
    },
  };
}
