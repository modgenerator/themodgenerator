/**
 * Preview texture generation — DATA only (buffers). No file writes.
 * If rasterization succeeds → embed textures. If fails → log + scaffold → DO NOT BLOCK.
 */

import type { FinalTexturePlan } from "./synthesize.js";
import { rasterizeTexture } from "./rasterize.js";
import type { RasterizedTexture } from "./rasterize.js";

export type PreviewTextures = {
  inventoryIcon: RasterizedTexture;
  blockFace?: RasterizedTexture;
  emissiveMask?: Uint8ClampedArray;
};

/**
 * Generate preview textures from plan + seed. Output is DATA (buffers), not files.
 * - inventory icon (always)
 * - block face (if isBlock)
 * - emissive mask (if plan has glow)
 */
export function generatePreviewTextures(
  plan: FinalTexturePlan,
  seed: string,
  options?: { isBlock?: boolean }
): PreviewTextures {
  const isBlock = options?.isBlock ?? false;
  const hasGlow = plan.proceduralSpec.postProcess.glowMask ?? false;

  const inventoryIcon = rasterizeTexture(plan, 16, seed + ":icon");

  let blockFace: RasterizedTexture | undefined;
  if (isBlock) {
    blockFace = rasterizeTexture(plan, 16, seed + ":block");
  }

  let emissiveMask: Uint8ClampedArray | undefined;
  if (hasGlow) {
    const base = rasterizeTexture(plan, 16, seed + ":emissive");
    emissiveMask = new Uint8ClampedArray(base.pixels.length);
    for (let i = 0; i < base.pixels.length; i += 4) {
      const a = base.pixels[i + 3];
      emissiveMask[i] = a;
      emissiveMask[i + 1] = a;
      emissiveMask[i + 2] = a;
      emissiveMask[i + 3] = 255;
    }
  }

  return {
    inventoryIcon,
    blockFace,
    emissiveMask,
  };
}
