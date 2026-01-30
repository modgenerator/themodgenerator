/**
 * Item and Block descriptor primitives — maximal, future-proof vocabulary.
 * Describes WHAT exists (category, visual, behavior); missing/unsupported → safe default, never error.
 * Items and blocks MUST always fully materialize (registered Fabric item/block, textures, models, lang).
 * Interpret > enumerate: semantic decomposition + fallback synthesis. No prompt is "unknown".
 *
 * PRIMITIVE INVARIANT (aligned with primitives.ts):
 * - Primitives describe WHAT exists, not HOW complex it is
 * - Missing primitives never block generation
 * - Unsupported primitives degrade to no-op systems, never errors
 * - Items and blocks MUST always fully materialize
 */

// ============== EXHAUSTIVE PRIMITIVE AXES ==============

/**
 * Semantic axes (open-ended string). Interpret > enumerate.
 * Examples: food, weapon, tool, block, organic, metallic, crystal, magical, dangerous, cute,
 * ancient, futuristic, strange, cold, hot, radioactive, edible, placeable, wearable.
 */
export type SemanticTag = string;

/** Physical axes: hardness, weight, light, transparency. All optional. */
export type PhysicalTraits = {
  hardness?: number;
  weight?: "light" | "medium" | "heavy";
  luminosity?: number;
  transparency?: number;
};

/** Effect for food/weapon (type + optional duration/amplifier). */
export type GameplayEffect = {
  type: string;
  duration?: number;
  amplifier?: number;
};

/** Gameplay axes: food, weapon, block behavior. */
export type GameplayTraits = {
  food?: { hunger: number; saturation: number; effects?: GameplayEffect[] };
  weapon?: { damage: number; speed: number; effects?: GameplayEffect[] };
  block?: { solid: boolean; gravity?: boolean; interactive?: boolean };
};

/** Material hint is open-ended string; this alias exists for backward compatibility. */
export type MaterialHint = string;

/** Aesthetic axes (CRITICAL): drives texture recipe. materialHint is open-ended string. NO gray cubes; NO default texture. */
export type AestheticProfile = {
  materialHint: string;
  colorPalette: string[];
  glow?: boolean;
  animationHint?: "pulse" | "drip" | "sparkle" | "wave";
  /** Overlay intent for asset pipeline (e.g. radioactive_speckles, frosting, cracks). */
  overlayHints?: string[];
};

/** Texture source: base material or procedural overlay. */
export type TextureSource = {
  type: "material" | "overlay" | "procedural";
  key: string;
  description?: string;
};

/** Animation spec for procedural recipes. */
export type AnimationSpec = {
  type: "pulse" | "drip" | "sparkle" | "wave";
  speed?: number;
};

/** Recipe derived from aesthetic: base + overlays + palette + animation. Guarantees every item/block has a texture matching intent. */
export type AestheticTextureRecipe = {
  base: TextureSource;
  overlays: TextureSource[];
  paletteShift: string[];
  animation?: AnimationSpec;
};

// ============== EFFECT PRIMITIVES ==============

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

/** Default physical traits when not specified. All axes have defaults so gameplay is believable. */
export function defaultPhysicalTraits(): PhysicalTraits {
  return {
    hardness: 1,
    weight: "medium",
    luminosity: 0,
    transparency: 0,
  };
}

/** Default aesthetic when not specified. Never gray cube: use organic/stone + palette. */
export function defaultAestheticProfile(): AestheticProfile {
  return {
    materialHint: "organic",
    colorPalette: ["#8B7355", "#6B5344", "#4A3728"],
    glow: false,
  };
}

/**
 * Derive texture recipe from aesthetic profile.
 * Every item/block MUST have a recipe. Never return incomplete recipe.
 * Rules: base (from materialHint), paletteShift, glow → emissive overlay, animationHint → procedural overlay, overlayHints → overlays.
 */
export function deriveTextureRecipe(profile: AestheticProfile): AestheticTextureRecipe {
  const base: TextureSource = {
    type: "material",
    key: profile.materialHint || "crystal",
    description: `base ${profile.materialHint || "crystal"}`,
  };
  const overlays: TextureSource[] = [];
  if (profile.glow) {
    overlays.push({ type: "overlay", key: "emissive_glow", description: "glow overlay" });
  }
  for (const hint of profile.overlayHints ?? []) {
    if (hint) overlays.push({ type: "overlay", key: hint, description: hint });
  }
  if (profile.animationHint) {
    overlays.push({
      type: "procedural",
      key: profile.animationHint,
      description: `${profile.animationHint} animation`,
    });
  }
  const paletteShift =
    profile.colorPalette?.length > 0
      ? profile.colorPalette.slice(0, 4)
      : ["#9370DB", "#8A2BE2", "#DA70D6", "#4B0082"];
  const animation: AnimationSpec | undefined = profile.animationHint
    ? { type: profile.animationHint as AnimationSpec["type"], speed: 1 }
    : undefined;
  return {
    base,
    overlays,
    paletteShift,
    animation,
  };
}
