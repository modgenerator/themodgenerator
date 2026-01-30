/**
 * Style transfer — Minecraft-compatible. Pure transforms, no ML.
 * Style NEVER changes structure; only saturation, contrast curve, edge softness, glow diffusion.
 */

import type { ProceduralTextureSpec } from "./procedural.js";

export enum TextureStyle {
  vanilla = "vanilla",
  fantasy = "fantasy",
  dark_fantasy = "dark_fantasy",
  cute = "cute",
  industrial = "industrial",
  sci_fi = "sci_fi",
  ancient = "ancient",
  magical = "magical",
}

export type StyledTextureSpec = {
  source: ProceduralTextureSpec;
  style: TextureStyle;
  saturation: number;
  contrastCurve: number;
  edgeSoftness: number;
  glowDiffusion: number;
  /** When vanilla: clamp to Minecraft-safe color ranges. */
  vanillaColorClamp?: boolean;
};

/** Default style params per style. Deterministic. */
function styleParams(style: TextureStyle): Omit<StyledTextureSpec, "source"> {
  switch (style) {
    case TextureStyle.vanilla:
      return {
        style: TextureStyle.vanilla,
        saturation: 0.9,
        contrastCurve: 0.85,
        edgeSoftness: 0.6,
        glowDiffusion: 0.2,
        vanillaColorClamp: true,
      };
    case TextureStyle.fantasy:
      return {
        style: TextureStyle.fantasy,
        saturation: 1.1,
        contrastCurve: 0.9,
        edgeSoftness: 0.5,
        glowDiffusion: 0.4,
      };
    case TextureStyle.dark_fantasy:
      return {
        style: TextureStyle.dark_fantasy,
        saturation: 0.85,
        contrastCurve: 1.1,
        edgeSoftness: 0.4,
        glowDiffusion: 0.35,
      };
    case TextureStyle.cute:
      return {
        style: TextureStyle.cute,
        saturation: 1.15,
        contrastCurve: 0.75,
        edgeSoftness: 0.8,
        glowDiffusion: 0.3,
      };
    case TextureStyle.industrial:
      return {
        style: TextureStyle.industrial,
        saturation: 0.8,
        contrastCurve: 1.0,
        edgeSoftness: 0.3,
        glowDiffusion: 0.15,
      };
    case TextureStyle.sci_fi:
      return {
        style: TextureStyle.sci_fi,
        saturation: 0.95,
        contrastCurve: 1.05,
        edgeSoftness: 0.35,
        glowDiffusion: 0.5,
      };
    case TextureStyle.ancient:
      return {
        style: TextureStyle.ancient,
        saturation: 0.9,
        contrastCurve: 0.95,
        edgeSoftness: 0.55,
        glowDiffusion: 0.25,
      };
    case TextureStyle.magical:
      return {
        style: TextureStyle.magical,
        saturation: 1.1,
        contrastCurve: 0.9,
        edgeSoftness: 0.5,
        glowDiffusion: 0.6,
      };
    default:
      return {
        style: TextureStyle.fantasy,
        saturation: 1.0,
        contrastCurve: 0.9,
        edgeSoftness: 0.5,
        glowDiffusion: 0.4,
      };
  }
}

/**
 * Apply style transfer to procedural spec. Structure unchanged; only visual params.
 * Deterministic.
 */
export function applyStyleTransfer(
  procedural: ProceduralTextureSpec,
  style: TextureStyle
): StyledTextureSpec {
  const params = styleParams(style);
  return {
    source: procedural,
    ...params,
  };
}
