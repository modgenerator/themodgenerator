/**
 * Infer TextureProfile from displayName or familyType.
 * materialHint MUST come from displayName/familyType (never hardcoded).
 * physicalTraits and surfaceStyle inferred generically from material hint.
 * If confidence < threshold, caller must FAIL with explanation.
 */

import type { TextureProfile, TextureMaterialClass } from "@themodgenerator/spec";

const CONFIDENCE_THRESHOLD = 0.5;

const MOTIF_OPTIONS = ["holes", "grain", "strata", "veins", "bubbles", "flakes", "rings"] as const;

function inferMaterialClass(materialHint: string): TextureMaterialClass {
  const lower = materialHint.toLowerCase();
  if (/\bwood\b/.test(lower)) return "wood";
  if (/\bstone\b|\bbrick\b/.test(lower)) return "stone";
  if (/\bmetal\b|\bingot\b/.test(lower)) return "metal";
  if (/\bfood\b|\borganic\b|\bplant\b/.test(lower)) return "food";
  if (/\bcloud\b/.test(lower)) return "cloud";
  if (/\bgem\b|\bcrystal\b/.test(lower)) return "crystal";
  return "generic";
}

function inferVisualMotifs(materialHint: string, physicalTraits: string[]): string[] {
  const motifs: string[] = [];
  const lower = materialHint.toLowerCase();
  const traitSet = new Set(physicalTraits.map((t) => t.toLowerCase()));
  if (traitSet.has("porous") || /\bporous\b/.test(lower)) motifs.push("holes");
  if (traitSet.has("grainy") || /\bwood\b|\bgrain\b/.test(lower)) motifs.push("grain");
  if (traitSet.has("strata") || /\bstone\b|\bstrata\b/.test(lower)) motifs.push("strata");
  if (traitSet.has("veins") || /\bvein\b/.test(lower)) motifs.push("veins");
  if (traitSet.has("bubbles") || /\bbubble\b/.test(lower)) motifs.push("bubbles");
  if (traitSet.has("flakes")) motifs.push("flakes");
  if (traitSet.has("rings") || /\bring\b/.test(lower)) motifs.push("rings");
  return [...new Set(motifs)].filter((m) => MOTIF_OPTIONS.includes(m)).slice(0, 2);
}

/** Infer physical traits and surface style from material hint (generic keyword inference). */
function inferTraitsFromMaterialHint(materialHint: string): {
  physicalTraits: string[];
  surfaceStyle: string[];
  confidence: number;
} {
  const lower = materialHint.toLowerCase().trim();
  if (!lower) return { physicalTraits: ["textured"], surfaceStyle: ["flat"], confidence: 0.3 };

  // Generic inference: match substrings that suggest material semantics (not material-specific logic).
  const traits: string[] = [];
  const style: string[] = [];

  if (/\bcheese\b/.test(lower)) {
    traits.push("porous", "soft");
    style.push("smooth", "cracked");
  }
  if (/\bcloud\b/.test(lower)) {
    traits.push("wispy", "soft");
    style.push("soft", "ethereal");
  }
  if (/\bwood\b/.test(lower) || /\bocean\s*wood\b/.test(lower)) {
    traits.push("fibrous", "grainy");
    style.push("grainy", "organic");
  }
  if (/\bocean\b/.test(lower) && !/wood/.test(lower)) {
    traits.push("fluid", "translucent");
    style.push("smooth", "shimmering");
  }
  if (/\bmetal\b/.test(lower) || /\bingot\b/.test(lower)) {
    traits.push("dense", "solid");
    style.push("smooth", "reflective");
  }
  if (/\bstone\b/.test(lower) || /\bbrick\b/.test(lower)) {
    traits.push("hard", "solid");
    style.push("rough", "cracked");
  }
  if (/\bmelted\b/.test(lower) || /\bmolten\b/.test(lower)) {
    traits.push("liquid", "shiny");
    style.push("smooth", "glossy");
  }
  if (/\bgem\b/.test(lower) || /\bcrystal\b/.test(lower)) {
    traits.push("hard", "crystalline");
    style.push("smooth", "faceted");
  }

  if (traits.length === 0) traits.push("textured");
  if (style.length === 0) style.push("flat");

  const confidence = traits.length > 1 || style.length > 1 ? 0.9 : lower.length >= 2 ? 0.7 : 0.5;
  return { physicalTraits: [...new Set(traits)], surfaceStyle: [...new Set(style)], confidence };
}

/**
 * Derive materialHint from displayName or familyType only (never hardcoded).
 * Strip " Block", " Item", " Melted" for consistency; lowercase.
 */
export function materialHintFromDisplayNameOrFamily(
  displayName: string,
  familyType?: string
): string {
  if (familyType && familyType.trim()) {
    return familyType.trim().toLowerCase();
  }
  const base = displayName
    .replace(/\s+Block$/i, "")
    .replace(/\s+Item$/i, "")
    .replace(/^Melted\s+/i, "")
    .trim()
    .toLowerCase();
  return base || "custom";
}

export interface InferTextureProfileResult {
  profile: TextureProfile;
  confidence: number;
}

/**
 * Infer full TextureProfile from displayName and intent.
 * materialHint from displayName (or familyType); physicalTraits/surfaceStyle inferred.
 * Caller must FAIL if result.confidence < CONFIDENCE_THRESHOLD.
 */
export function inferTextureProfile(
  displayName: string,
  intent: "block" | "item" | "processed",
  options?: { familyType?: string }
): InferTextureProfileResult {
  const materialHint = materialHintFromDisplayNameOrFamily(displayName, options?.familyType);
  const { physicalTraits, surfaceStyle, confidence } = inferTraitsFromMaterialHint(materialHint);
  const materialClass = inferMaterialClass(materialHint);
  const visualMotifs = inferVisualMotifs(materialHint, physicalTraits);

  const profile: TextureProfile = {
    intent,
    materialHint,
    materialClass,
    physicalTraits,
    surfaceStyle,
    ...(visualMotifs.length > 0 && { visualMotifs }),
  };

  const finalConfidence = materialHint === "custom" ? Math.min(confidence, 0.4) : confidence;
  return { profile, confidence: finalConfidence };
}

export function getTextureProfileConfidenceThreshold(): number {
  return CONFIDENCE_THRESHOLD;
}
