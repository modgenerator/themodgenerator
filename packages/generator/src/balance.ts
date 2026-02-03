/**
 * Balance/Rarity — deterministic stats from worldgen + material overrides.
 * Tool/armor stats are derived here; LLM must NOT invent them.
 */

import type { ModSpecV2Worldgen } from "@themodgenerator/spec";
import type { PowerProfile } from "@themodgenerator/spec";

export interface RarityScore {
  score: number;
  /** 0–1 normalized for stat scaling. */
  normalized: number;
  factors: { veinsPerChunk: number; veinSize: number; verticalRange: number; biomeRestriction: number };
}

/** Compute rarity score from worldgen. Higher = rarer = can justify higher stats. */
export function computeRarityScore(worldgen: ModSpecV2Worldgen[]): RarityScore {
  if (worldgen.length === 0) {
    return {
      score: 50,
      normalized: 0.5,
      factors: { veinsPerChunk: 2, veinSize: 4, verticalRange: 128, biomeRestriction: 0 },
    };
  }
  const w = worldgen[0];
  const veinsPerChunk = Math.max(0.1, Math.min(20, w.veinsPerChunk ?? 2));
  const veinSize = Math.max(1, Math.min(20, w.veinSize ?? 4));
  const verticalRange = Math.max(1, Math.abs((w.maxY ?? 64) - (w.minY ?? -64)));
  const biomeRestriction = (w.biomeTags?.length ?? 0) > 1 ? 1 : 0;

  const score =
    100 -
    veinsPerChunk * 3 -
    veinSize * 2 -
    verticalRange / 4 +
    biomeRestriction * 15;
  const clamped = Math.max(5, Math.min(95, score));
  const normalized = (clamped - 5) / 90;

  return {
    score: clamped,
    normalized,
    factors: { veinsPerChunk, veinSize, verticalRange, biomeRestriction },
  };
}

export interface ToolStats {
  durability: number;
  miningSpeed: number;
  attackDamageBonus: number;
  enchantability: number;
  miningLevel: number;
}

export interface ArmorStats {
  durabilityMultiplier: number;
  protectionPoints: number[];
  toughness: number;
  knockbackResistance: number;
}

export interface MaterialStatOverrides {
  powerProfile?: PowerProfile;
  styleOverPower?: boolean;
}

const TOOL_DURABILITY_MIN = 32;
const TOOL_DURABILITY_MAX = 2031;
const MINING_SPEED_MIN = 1;
const MINING_SPEED_MAX = 16;
const ATTACK_BONUS_MIN = 0;
const ATTACK_BONUS_MAX = 12;
const ENCHANTABILITY_MIN = 5;
const ENCHANTABILITY_MAX = 25;
const MINING_LEVEL_MIN = 0;
const MINING_LEVEL_MAX = 4;

const ARMOR_DURABILITY_MULT_MIN = 5;
const ARMOR_DURABILITY_MULT_MAX = 40;
const PROTECTION_PER_SLOT_MAX = 8;
const TOUGHNESS_MIN = 0;
const TOUGHNESS_MAX = 4;
const KB_RESIST_MIN = 0;
const KB_RESIST_MAX = 0.2;

/** Derive tool stats from rarity and overrides. Clamped to sane ranges. */
export function deriveToolStats(
  _materialId: string,
  rarityScore: RarityScore,
  overrides?: MaterialStatOverrides
): ToolStats {
  let mult = 0.4 + rarityScore.normalized * 0.6;
  if (overrides?.powerProfile === "cosmetic" || overrides?.styleOverPower) {
    mult *= 0.5;
  }
  if (overrides?.powerProfile === "glass_cannon") {
    mult = Math.min(1.2, mult * 1.2);
  }
  if (overrides?.powerProfile === "tank") {
    mult = Math.min(1.1, mult * 1.05);
  }

  const durability = Math.round(
    TOOL_DURABILITY_MIN + (TOOL_DURABILITY_MAX - TOOL_DURABILITY_MIN) * mult * 0.6
  );
  const miningSpeed = Math.max(
    MINING_SPEED_MIN,
    Math.min(MINING_SPEED_MAX, 1 + rarityScore.normalized * 8 * mult)
  );
  const attackDamageBonus = Math.max(
    ATTACK_BONUS_MIN,
    Math.min(ATTACK_BONUS_MAX, rarityScore.normalized * 6 * mult)
  );
  const enchantability = Math.round(
    ENCHANTABILITY_MIN + (ENCHANTABILITY_MAX - ENCHANTABILITY_MIN) * rarityScore.normalized * mult
  );
  const miningLevel =
    rarityScore.normalized < 0.3 ? 0 : rarityScore.normalized < 0.6 ? 1 : rarityScore.normalized < 0.85 ? 2 : 3;

  return {
    durability: Math.max(TOOL_DURABILITY_MIN, Math.min(TOOL_DURABILITY_MAX, durability)),
    miningSpeed: Math.max(MINING_SPEED_MIN, Math.min(MINING_SPEED_MAX, miningSpeed)),
    attackDamageBonus: Math.max(ATTACK_BONUS_MIN, Math.min(ATTACK_BONUS_MAX, attackDamageBonus)),
    enchantability: Math.max(ENCHANTABILITY_MIN, Math.min(ENCHANTABILITY_MAX, enchantability)),
    miningLevel: Math.max(MINING_LEVEL_MIN, Math.min(MINING_LEVEL_MAX, miningLevel)),
  };
}

/** Derive armor stats from rarity and overrides. protectionPoints: [boots, leggings, chest, helmet]. */
export function deriveArmorStats(
  _materialId: string,
  rarityScore: RarityScore,
  overrides?: MaterialStatOverrides
): ArmorStats {
  let mult = 0.4 + rarityScore.normalized * 0.6;
  if (overrides?.powerProfile === "cosmetic" || overrides?.styleOverPower) {
    mult *= 0.5;
  }
  if (overrides?.powerProfile === "tank") {
    mult = Math.min(1.15, mult * 1.1);
  }

  const baseProtection = 2 + rarityScore.normalized * 4 * mult;
  const protectionPoints = [1, 2, 3, 1].map((k) =>
    Math.min(PROTECTION_PER_SLOT_MAX, Math.round(baseProtection * k * 0.5))
  );
  const toughness = Math.max(
    TOUGHNESS_MIN,
    Math.min(TOUGHNESS_MAX, rarityScore.normalized * 3 * mult)
  );
  const knockbackResistance = Math.max(
    KB_RESIST_MIN,
    Math.min(KB_RESIST_MAX, rarityScore.normalized * 0.1 * mult)
  );
  const durabilityMultiplier = Math.round(
    ARMOR_DURABILITY_MULT_MIN +
      (ARMOR_DURABILITY_MULT_MAX - ARMOR_DURABILITY_MULT_MIN) * 0.4 * mult
  );

  return {
    durabilityMultiplier: Math.max(
      ARMOR_DURABILITY_MULT_MIN,
      Math.min(ARMOR_DURABILITY_MULT_MAX, durabilityMultiplier)
    ),
    protectionPoints,
    toughness: Math.max(TOUGHNESS_MIN, Math.min(TOUGHNESS_MAX, toughness)),
    knockbackResistance: Math.max(KB_RESIST_MIN, Math.min(KB_RESIST_MAX, knockbackResistance)),
  };
}
