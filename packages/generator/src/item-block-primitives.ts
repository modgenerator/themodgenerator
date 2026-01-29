/**
 * Item and Block descriptor primitives — maximal, future-proof vocabulary.
 * Describes WHAT exists (category, visual, behavior); missing/unsupported → safe default, never error.
 * Items and blocks MUST always fully materialize (registered Fabric item/block, textures, models, lang).
 *
 * PRIMITIVE INVARIANT (aligned with primitives.ts):
 * - Primitives describe WHAT exists, not HOW complex it is
 * - Missing primitives never block generation
 * - Unsupported primitives degrade to no-op systems, never errors
 * - Items and blocks MUST always fully materialize
 */

/** Shared, composable effect for onUse, onHit, onConsume, onBreak, onInteract, tick. */
export type EffectPrimitive = {
  type:
    | "damage"
    | "heal"
    | "status_effect"
    | "teleport"
    | "spawn_entity"
    | "explode"
    | "modify_block"
    | "play_sound";
  value?: number;
  duration?: number;
  amplifier?: number;
  target?: "self" | "entity" | "block" | "area";
};

/** Passive effect (glow, particle, ambient) — no direct trigger. */
export type PassiveEffectPrimitive = {
  type: "glow" | "particle" | "ambient_sound";
  value?: number;
};

export type ItemCategory =
  | "weapon"
  | "tool"
  | "armor"
  | "consumable"
  | "material"
  | "magic"
  | "utility"
  | "food"
  | "misc";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ItemPrimitive = {
  id: string;
  displayName: string;
  category: ItemCategory;
  rarity: ItemRarity;
  stackSize: number;
  durability?: number;
  visual: {
    model: "generated" | "handheld" | "block";
    textureHints: string[];
    glow?: boolean;
    animated?: boolean;
  };
  behavior: {
    onUse?: EffectPrimitive[];
    onHit?: EffectPrimitive[];
    onConsume?: EffectPrimitive[];
    passive?: PassiveEffectPrimitive[];
  };
  crafting?: {
    pattern?: string[];
    ingredients?: string[];
    station?: "crafting_table" | "smithing" | "furnace";
  };
  metadata: {
    lore?: string[];
    tags?: string[];
  };
};

export type BlockMaterial =
  | "stone"
  | "wood"
  | "metal"
  | "glass"
  | "organic"
  | "magic";

export type BlockShape = "cube" | "slab" | "stairs" | "pillar" | "custom";

export type BlockPrimitive = {
  id: string;
  displayName: string;
  material: BlockMaterial;
  hardness: number;
  blastResistance: number;
  requiresTool?: boolean;
  shape: BlockShape;
  behavior: {
    onBreak?: EffectPrimitive[];
    onInteract?: EffectPrimitive[];
    tick?: EffectPrimitive[];
  };
  drops?: {
    item: string;
    min: number;
    max: number;
  }[];
  visual: {
    textureHints: string[];
    emissive?: boolean;
    transparent?: boolean;
  };
};

/**
 * Safe default ItemPrimitive when behavior or details are undefined.
 * Used so materializer never fails; undefined behavior → safe default.
 */
export function defaultItemPrimitive(id: string, displayName: string): ItemPrimitive {
  return {
    id,
    displayName,
    category: "misc",
    rarity: "common",
    stackSize: 64,
    visual: {
      model: "generated",
      textureHints: ["generic"],
    },
    behavior: {},
    metadata: {},
  };
}

/**
 * Safe default BlockPrimitive when behavior or details are undefined.
 * Used so materializer never fails; undefined behavior → safe default.
 */
export function defaultBlockPrimitive(id: string, displayName: string): BlockPrimitive {
  return {
    id,
    displayName,
    material: "stone",
    hardness: 1,
    blastResistance: 1,
    shape: "cube",
    behavior: {},
    visual: {
      textureHints: ["generic"],
    },
  };
}
