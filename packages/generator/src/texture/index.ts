/**
 * Generative texture intelligence. Procedural generation, style transfer, palette/motif.
 * Pure data plans; no rasterization. Deterministic via hash(seed + prompt).
 *
 * Contract: every item/block resolves to palette (3–6), procedural structure,
 * style, motifs, optional animation. No prompt rejection. No grayscale-only.
 */

export { SEMANTIC_VISUAL_CONTRACT, type SemanticVisualGuarantee } from "./semantic-visual-contract.js";
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
  type FinalTexturePlanMotifs,
} from "./synthesize.js";
