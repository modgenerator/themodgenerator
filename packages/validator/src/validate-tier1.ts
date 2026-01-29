/**
 * Tier 1 validation — Plane 1 logic only.
 * Only Tier 1 features allowed: items, simple blocks, flat textures, handheld/cube models, basic crafting.
 * No worldgen, entities, animation, or Tier 2+ concepts.
 * Every rejected path produces exactly one error code.
 */

import type { ModSpecV1 } from "@themodgenerator/spec";
import { getTierForFeature, MAX_TIER_ALLOWED } from "@themodgenerator/spec";

/** Error codes for Tier 1 validation failures. One code per rejection path. */
export const TIER1_NO_FEATURES = "TIER1_NO_FEATURES";
export const TIER1_UNKNOWN_FEATURE = "TIER1_UNKNOWN_FEATURE";
export const TIER1_FORBIDDEN_FEATURE = "TIER1_FORBIDDEN_FEATURE";
export const TIER1_ORES_FORBIDDEN = "TIER1_ORES_FORBIDDEN";
export const TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN = "TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  /** Set when valid is false; identifies the rejection path. */
  code?: string;
}

/** Validate that the spec uses only Tier 1 features. Reject Tier 2+ and unknown features. */
export function validateTier1(spec: ModSpecV1): ValidationResult {
  if (!spec.features || spec.features.length === 0) {
    return {
      valid: false,
      reason: "At least one feature is required.",
      code: TIER1_NO_FEATURES,
    };
  }

  for (const feature of spec.features) {
    const tier = getTierForFeature(feature);
    if (tier === undefined) {
      return {
        valid: false,
        reason: `Unknown feature: "${feature}".`,
        code: TIER1_UNKNOWN_FEATURE,
      };
    }
    if (tier > MAX_TIER_ALLOWED) {
      return {
        valid: false,
        reason: `Feature "${feature}" requires Tier ${tier}. Only Tier ${MAX_TIER_ALLOWED} (foundation) is allowed.`,
        code: TIER1_FORBIDDEN_FEATURE,
      };
    }
  }

  if (spec.ores && spec.ores.length > 0) {
    return {
      valid: false,
      reason: "Ores (worldgen) are Tier 3. Not allowed in Tier 1.",
      code: TIER1_ORES_FORBIDDEN,
    };
  }
  if (spec.loot && spec.loot.length > 0) {
    const hasBlockOrEntity = spec.loot.some(
      (l) => l.type === "block" || l.type === "entity"
    );
    if (hasBlockOrEntity) {
      return {
        valid: false,
        reason: "Block/entity loot tables are Tier 2+. Not allowed in Tier 1.",
        code: TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN,
      };
    }
  }

  return { valid: true };
}
