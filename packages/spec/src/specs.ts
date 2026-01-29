/**
 * Core Spec interfaces — Plane 1 logic only.
 * No Minecraft paths, textures, or Fabric. Fully testable without Minecraft.
 */

import type { Tier } from "./tier.js";

/** Base spec for any registered content. Tier 1 only. */
export interface BaseSpec {
  id: string;
  name: string;
  tier: Tier;
}

/** Item spec — Tier 1: handheld item, flat texture, registry, creative tab. */
export interface ItemSpec extends BaseSpec {
  /** Semantic material for asset generation (e.g. "ruby", "ingot"). */
  material?: string;
  /** Rarity hint for visual descriptor. */
  rarity?: "common" | "uncommon" | "rare" | "epic";
}

/** Block spec — Tier 1: simple block, cube model, item form, flat texture. */
export interface BlockSpec extends BaseSpec {
  /** Semantic material for asset generation. */
  material?: string;
}

/** Convert ModItem to ItemSpec (logic layer). */
export function itemSpecFromModItem(
  item: { id: string; name: string; translationKey?: string },
  tier: Tier = 1
): ItemSpec {
  return {
    id: item.id,
    name: item.name,
    tier,
    material: "generic",
  };
}

/** Convert ModBlock to BlockSpec (logic layer). */
export function blockSpecFromModBlock(
  block: { id: string; name: string },
  tier: Tier = 1
): BlockSpec {
  return {
    id: block.id,
    name: block.name,
    tier,
    material: "generic",
  };
}
