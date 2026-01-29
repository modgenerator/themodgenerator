/**
 * Tier engine — Plane 1 logic only.
 * Higher tiers implicitly require lower-tier constructs.
 * DO NOT implement above Tier 1 yet.
 */

export const TIER_1 = 1 as const;
export const TIER_2 = 2 as const;
export const TIER_3 = 3 as const;
export const TIER_4 = 4 as const;
export const TIER_5 = 5 as const;

export type Tier = typeof TIER_1 | typeof TIER_2 | typeof TIER_3 | typeof TIER_4 | typeof TIER_5;

export const TIER_LABELS: Record<Tier, string> = {
  1: "foundation",
  2: "block_states_loot_tools",
  3: "worldgen",
  4: "entities",
  5: "dimensions_advanced",
};

/** Maximum tier allowed in the current implementation. */
export const MAX_TIER_ALLOWED: Tier = TIER_1;

/** Feature key to minimum tier required. Tier 2+ features are stubbed/deferred. */
export const FEATURE_TIER: Record<string, Tier> = {
  "hello-world": TIER_1,
  "ingot": TIER_1,
  "ore": TIER_3,
  "tools": TIER_2,
  "mob-drop": TIER_4,
  "structure-spawn": TIER_3,
  "advancement": TIER_2,
};

export function getTierForFeature(featureKey: string): Tier | undefined {
  return FEATURE_TIER[featureKey];
}

/** Require that a feature is allowed at the current max tier. Throws if above Tier 1. */
export function requireTierForFeature(featureKey: string): void {
  const tier = getTierForFeature(featureKey);
  if (tier === undefined) {
    throw new Error(`Unknown feature: ${featureKey}`);
  }
  if (tier > MAX_TIER_ALLOWED) {
    throw new Error(
      `Feature "${featureKey}" requires Tier ${tier}. Only Tier ${MAX_TIER_ALLOWED} (${TIER_LABELS[MAX_TIER_ALLOWED]}) is allowed.`
    );
  }
}

export function isAllowedAtTier1(featureKey: string): boolean {
  const tier = getTierForFeature(featureKey);
  return tier !== undefined && tier <= MAX_TIER_ALLOWED;
}
