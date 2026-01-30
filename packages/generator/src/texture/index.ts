/**
 * Generative texture intelligence. Procedural generation, style transfer, palette/motif.
 * Pure data plans; no rasterization. Deterministic via seed.
 */

export {
  generateProceduralTexture,
  type ProceduralTextureSpec,
  type BaseNoiseType,
  type DetailLayerType,
} from "./procedural.js";
export {
  applyStyleTransfer,
  TextureStyle,
  type StyledTextureSpec,
} from "./style-transfer.js";
export {
  generatePaletteAndMotifs,
  type GeneratedPalette,
  type PaletteLLMInput,
} from "./palette-llm.js";
export {
  synthesizeTexture,
  type FinalTexturePlan,
} from "./synthesize.js";
