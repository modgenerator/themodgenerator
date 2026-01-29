/**
 * Visual Fidelity Pipeline — Phase 1.
 * Credit-gated visual levels. Deterministic. No randomness.
 * More credits = more impressive visuals; behavior unchanged.
 *
 * CREDIT TIERS (DO NOT CHANGE):
 * Tier A: 30 credits | Tier B: 60 | Tier C: 120 | Tier D: 300
 */

export type VisualLevel = "basic" | "enhanced" | "advanced" | "legendary";

export type TextureResolution = 16 | 32 | 64 | 128;

export interface VisualLevelDefinition {
  id: VisualLevel;
  textureResolution: TextureResolution;
  allowsGlow: boolean;
  allowsEmissive: boolean;
  allowsAnimation: boolean;
  allowsLayeredOverlays: boolean;
}

/** Credit → visual level. <=30 basic, <=60 enhanced, <=120 advanced, <=300 legendary. */
const CREDIT_TO_LEVEL: ReadonlyArray<{ maxCredits: number; level: VisualLevel }> = [
  { maxCredits: 30, level: "basic" },
  { maxCredits: 60, level: "enhanced" },
  { maxCredits: 120, level: "advanced" },
  { maxCredits: 300, level: "legendary" },
];

/**
 * Map credits to visual level. Deterministic.
 * Everything works at 30 credits (basic). More credits = more impressive visuals.
 */
export function creditsToVisualLevel(credits: number): VisualLevel {
  const capped = Math.max(0, Math.min(credits, 300));
  for (const { maxCredits, level } of CREDIT_TO_LEVEL) {
    if (capped <= maxCredits) return level;
  }
  return "legendary";
}

/** Visual level definitions. basic: clean, flat, no glow/emissive. legendary: glow + emissive + animation-ready. */
export const VISUAL_LEVEL_DEFINITIONS: Record<VisualLevel, VisualLevelDefinition> = {
  basic: {
    id: "basic",
    textureResolution: 16,
    allowsGlow: false,
    allowsEmissive: false,
    allowsAnimation: false,
    allowsLayeredOverlays: false,
  },
  enhanced: {
    id: "enhanced",
    textureResolution: 32,
    allowsGlow: false,
    allowsEmissive: true,
    allowsAnimation: false,
    allowsLayeredOverlays: false,
  },
  advanced: {
    id: "advanced",
    textureResolution: 64,
    allowsGlow: true,
    allowsEmissive: true,
    allowsAnimation: false,
    allowsLayeredOverlays: true,
  },
  legendary: {
    id: "legendary",
    textureResolution: 128,
    allowsGlow: true,
    allowsEmissive: true,
    allowsAnimation: true,
    allowsLayeredOverlays: true,
  },
};

export function getVisualLevelDefinition(level: VisualLevel): VisualLevelDefinition {
  return VISUAL_LEVEL_DEFINITIONS[level];
}
