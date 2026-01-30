/**
 * PART 1 — SEMANTIC → VISUAL INTELLIGENCE CONTRACT
 *
 * This invariant holds across the system:
 *
 * Every item/block MUST resolve to:
 * - A palette (3–6 colors)
 * - A procedural texture structure
 * - A stylistic transformation
 * - One or more visual motifs
 * - Optional animation intent
 *
 * This holds EVEN IF:
 * - Prompt is nonsense
 * - Prompt is abstract
 * - Prompt is emotional
 * - Prompt is contradictory
 *
 * No exceptions. No prompt rejection. No empty palettes. No grayscale-only outputs.
 * Rendering may be deferred, but INTELLIGENCE MUST STILL BE GENERATED.
 */

export const SEMANTIC_VISUAL_CONTRACT = {
  /** Every item/block must have at least this many colors. */
  MIN_PALETTE_COLORS: 3,
  /** Every item/block must have at most this many colors. */
  MAX_PALETTE_COLORS: 6,
  /** detailLayers must never be empty. */
  DETAIL_LAYERS_NEVER_EMPTY: true,
  /** Grayscale-only palettes are forbidden. */
  NO_GRAYSCALE_ONLY: true,
} as const;

export type SemanticVisualGuarantee = {
  hasPalette: boolean;
  hasProceduralStructure: boolean;
  hasStylisticTransformation: boolean;
  hasMotifs: boolean;
  hasAnimationIntent: boolean;
};
