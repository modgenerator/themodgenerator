/**
 * Procedural texture generation — pure data, deterministic via seed.
 * No rendering, no PNGs, no images. Output is a spec for downstream rasterization.
 */

import type { AestheticTextureRecipe } from "../item-block-primitives.js";

export type BaseNoiseType =
  | "perlin"
  | "simplex"
  | "cellular"
  | "crystal"
  | "organic"
  | "metallic";

export type DetailLayerType =
  | "noise"
  | "crackle"
  | "drip"
  | "veins"
  | "sparkles"
  | "corrosion"
  | "frost"
  | "swirl"
  | "runes"
  | "fractures";

export type ProceduralTextureSpec = {
  baseNoise: BaseNoiseType;
  scale: number;
  contrast: number;
  detailLayers: Array<{
    type: DetailLayerType;
    intensity: number;
  }>;
  postProcess: {
    blur?: number;
    sharpen?: number;
    glowMask?: boolean;
  };
};

/** Deterministic numeric hash from string (seed + prompt for determinism). */
function seedHash(seed: string, prompt?: string): number {
  const combined = (prompt != null ? seed + "\0" + prompt : seed);
  let h = 0;
  for (let i = 0; i < combined.length; i++) {
    h = (h * 31 + combined.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Pick baseNoise from materialHint (recipe.base.key). */
function baseNoiseFromMaterial(materialKey: string): BaseNoiseType {
  const k = materialKey.toLowerCase();
  if (k === "ice" || k === "crystal" || k === "gem") return "crystal";
  if (k === "organic" || k === "wood" || k === "slime" || k === "flesh") return "organic";
  if (k === "metal" || k === "metallic") return "metallic";
  if (k === "stone") return "cellular";
  if (k === "energy") return "simplex";
  return "crystal"; // magical/unknown → crystal
}

/**
 * Generate procedural texture spec from aesthetic recipe.
 * Determinism: hash(seed + prompt). detailLayers never empty; glow → postProcess.glowMask = true.
 * baseNoise inferred from material semantics (ice/crystal/gem → crystal, organic → organic, etc.).
 */
export function generateProceduralTexture(
  recipe: AestheticTextureRecipe,
  seed: string,
  prompt?: string
): ProceduralTextureSpec {
  const baseNoise = baseNoiseFromMaterial(recipe.base.key);
  const h = seedHash(seed, prompt);
  const scale = 0.3 + ((h % 100) / 100) * 0.4;
  const contrast = 0.5 + ((h % 73) / 73) * 0.5;

  const detailLayers: ProceduralTextureSpec["detailLayers"] = [];

  // animationHint → detail layers
  if (recipe.animation?.type === "drip") {
    detailLayers.push({ type: "drip", intensity: 0.6 });
  }
  if (recipe.animation?.type === "sparkle") {
    detailLayers.push({ type: "sparkles", intensity: 0.5 });
  }
  if (recipe.animation?.type === "wave") {
    detailLayers.push({ type: "swirl", intensity: 0.4 });
  }
  if (recipe.animation?.type === "pulse") {
    // pulse → handled by glowMask
  }

  // overlay keys from recipe
  for (const ov of recipe.overlays) {
    const key = ov.key.toLowerCase();
    if (key === "emissive_glow") continue; // handled by postProcess
    if (key.includes("crack") || key === "crackle") detailLayers.push({ type: "crackle", intensity: 0.4 });
    else if (key.includes("vein") || key.includes("radioactive")) detailLayers.push({ type: "veins", intensity: 0.5 });
    else if (key.includes("frost") || key.includes("ice")) detailLayers.push({ type: "frost", intensity: 0.5 });
    else if (key.includes("corrosion")) detailLayers.push({ type: "corrosion", intensity: 0.4 });
    else if (key.includes("sparkle")) detailLayers.push({ type: "sparkles", intensity: 0.4 });
    else if (key.includes("swirl") || key.includes("cream")) detailLayers.push({ type: "swirl", intensity: 0.35 });
    else if (key.includes("rune") || key.includes("arcane")) detailLayers.push({ type: "runes", intensity: 0.3 });
    else if (key.includes("fracture") || key.includes("crack")) detailLayers.push({ type: "fractures", intensity: 0.35 });
  }

  // glow in recipe (from aesthetic.glow) → glowMask
  const hasGlow = recipe.overlays.some((o) => o.key.toLowerCase().includes("emissive") || o.key === "emissive_glow");

  if (hasGlow) {
    // pulse-style glow implied
    if (!detailLayers.some((d) => d.type === "sparkles")) {
      detailLayers.push({ type: "sparkles", intensity: 0.25 });
    }
  }

  // detailLayers must never be empty
  if (detailLayers.length === 0) {
    detailLayers.push({ type: "noise", intensity: 0.2 + ((h % 50) / 50) * 0.2 });
  }

  return {
    baseNoise,
    scale,
    contrast,
    detailLayers,
    postProcess: {
      blur: 0,
      sharpen: 0.1,
      glowMask: hasGlow,
    },
  };
}
