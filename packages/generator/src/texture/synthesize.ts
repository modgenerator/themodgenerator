/**
 * Unified texture synthesis pipeline. STRICT ORDER: palette & motif → procedural → style → final plan.
 * FinalTexturePlan is the SINGLE SOURCE OF TRUTH for visuals.
 *
 * Contract: every item/block resolves to palette (3–6 colors), procedural structure,
 * stylistic transformation, motifs, optional animation. No exceptions.
 */

import type { InterpretedResult } from "../interpretation.js";
import { deriveTextureRecipe } from "../item-block-primitives.js";
import type { AnimationSpec } from "../item-block-primitives.js";
import { generateProceduralTexture } from "./procedural.js";
import type { ProceduralTextureSpec } from "./procedural.js";
import { applyStyleTransfer } from "./style-transfer.js";
import { TextureStyle } from "./style-transfer.js";
import type { StyledTextureSpec } from "./style-transfer.js";
import { generatePaletteAndMotifs } from "./palette-llm.js";
import type { GeneratedPalette } from "./palette-llm.js";

export type FinalTexturePlanMotifs = {
  primaryMotif: string;
  secondaryMotifs: string[];
};

export type FinalTexturePlan = {
  palette: GeneratedPalette;
  /** Explicit motifs (visual intent: "swirled cream", "radioactive veins", "arcane fractures"). */
  motifs: FinalTexturePlanMotifs;
  proceduralSpec: ProceduralTextureSpec;
  styledSpec: StyledTextureSpec;
  animationSpec?: AnimationSpec;
};

/** Infer TextureStyle from semanticTags + aesthetic. */
function inferTextureStyle(interpreted: InterpretedResult): TextureStyle {
  const tags = interpreted.semanticTags.map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
  const glow = !!interpreted.aesthetic.glow;

  if (tags.includes("magical") || glow) return TextureStyle.magical;
  if (tags.includes("cute")) return TextureStyle.cute;
  if (tags.includes("dangerous") || tags.includes("radioactive")) return TextureStyle.dark_fantasy;
  if (tags.includes("technological") || tags.includes("futuristic")) return TextureStyle.sci_fi;
  if (tags.includes("ancient")) return TextureStyle.ancient;
  if (tags.includes("organic") && !tags.includes("magical")) return TextureStyle.vanilla;

  return TextureStyle.fantasy;
}

/**
 * Synthesize full texture plan from prompt + interpreted result + seed.
 * Pipeline: palette & motif → procedural → style transfer → final plan.
 */
export function synthesizeTexture(
  prompt: string,
  interpreted: InterpretedResult,
  seed: string
): FinalTexturePlan {
  // 1. Palette & motif (LLM or deterministic fallback)
  const palette = generatePaletteAndMotifs({
    prompt,
    semanticTags: interpreted.semanticTags,
    aesthetic: interpreted.aesthetic,
    seed,
  });

  // 2. Recipe from interpreted aesthetic
  const recipe = deriveTextureRecipe(interpreted.aesthetic);

  // 3. Procedural texture generation
  const proceduralSpec = generateProceduralTexture(recipe, seed);

  // 4. Style inferred from semantic + aesthetic
  const style = inferTextureStyle(interpreted);

  // 5. Style transfer
  const styledSpec = applyStyleTransfer(proceduralSpec, style);

  // 6. Final plan (single source of truth)
  return {
    palette,
    motifs: {
      primaryMotif: palette.primaryMotif,
      secondaryMotifs: palette.secondaryMotifs,
    },
    proceduralSpec,
    styledSpec,
    animationSpec: recipe.animation,
  };
}
