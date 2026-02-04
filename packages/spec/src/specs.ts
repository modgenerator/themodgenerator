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

/** Item spec — Tier 1: handheld item, flat or 3D model, registry, creative tab. */
export interface ItemSpec extends BaseSpec {
  /** Semantic material for asset generation (e.g. "ruby", "ingot"). */
  material?: string;
  /** Rarity hint for visual descriptor. */
  rarity?: "common" | "uncommon" | "rare" | "epic";
  /** Render intent: flat sprite vs blocklike/chunky/rod/plate (3D elements). */
  itemRender?: "flat" | "blocklike" | "chunky" | "rod" | "plate";
}

/** Block spec — Tier 1: simple block, cube model, item form, flat texture. */
export interface BlockSpec extends BaseSpec {
  /** Semantic material for asset generation. */
  material?: string;
}

/** Convert ModItem to ItemSpec (logic layer). */
export function itemSpecFromModItem(
  item: { id: string; name: string; translationKey?: string; itemRender?: "flat" | "blocklike" | "chunky" | "rod" | "plate" },
  tier: Tier = 1
): ItemSpec {
  return {
    id: item.id,
    name: item.name,
    tier,
    material: "generic",
    ...(item.itemRender != null && { itemRender: item.itemRender }),
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
