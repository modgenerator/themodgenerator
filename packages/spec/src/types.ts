/**
 * Canonical Mod Spec v1 — single source of truth for deterministic generation.
 * Minecraft 1.21.1, Fabric only. Survival-safe features only.
 */

export const SUPPORTED_MINECRAFT_VERSION = "1.21.1" as const;
export const SUPPORTED_LOADER = "fabric" as const;

export type ModSpecV1 = {
  schemaVersion: 1;
  minecraftVersion: typeof SUPPORTED_MINECRAFT_VERSION;
  loader: typeof SUPPORTED_LOADER;
  modId: string;
  modName: string;
  /** List of feature keys that this mod includes. Drives template selection. */
  features: FeatureKey[];
  /** Explicit items/blocks/ores etc. (for future expansion) */
  items?: ModItem[];
  blocks?: ModBlock[];
  ores?: ModOre[];
  recipes?: ModRecipe[];
  loot?: ModLoot[];
  /** Required asset paths relative to assets/modid/ (e.g. "textures/item/foo.png"). */
  assetsRequired?: AssetRef[];
  /** Human-readable constraints: allowed, rejected, approximations. */
  constraintsReport?: ConstraintsReport;
  /** Behavior constraints from interpreter (e.g. no tools/weapons, pickaxe mining). */
  constraints?: ModSpecConstraints;
  /** Interpreter decisions (e.g. default furnace input when user did not specify). */
  decisions?: SpecDecision[];
  /** Structured smelting defaults: input type and ids. Materializer uses this only. */
  smelting?: SmeltingDecision[];
  /** Block families (variants). Generation driven by variant registry. */
  blockFamilies?: BlockFamily[];
  /** Wood types to expand into full vanilla wood family (log, planks, stairs, slab, fence, door, boat, etc.). */
  woodTypes?: WoodType[];
};

/** Declares a wood type; expansion generates the full craftable set (no worldgen unless added later). */
export interface WoodType {
  /** Display name (e.g. "Maple", "Cherry"). */
  displayName: string;
  /** Registry id prefix (e.g. "maple" -> maple_log, maple_planks, ...). Must be [a-z][a-z0-9_]*. */
  id: string;
  /** Optional flags (e.g. no recipes, no boats). Not used in initial implementation. */
  familyOptions?: Record<string, unknown>;
}

export interface SmeltingDecision {
  input: "block" | "item";
  sourceId: string;
  resultId: string;
}

export interface BlockFamily {
  baseId: string;
  baseDisplayName: string;
  familyType: "wood" | "stone" | "metal" | "generic";
  variants: string[];
}

export interface SpecDecision {
  kind: string;
  chosen?: string;
  alsoSupported?: string[];
}

export interface ModSpecConstraints {
  forbidToolsWeapons?: boolean;
  requirePickaxeMining?: boolean;
}

export type FeatureKey =
  | "hello-world"
  | "ore"
  | "ingot"
  | "tools"
  | "mob-drop"
  | "structure-spawn"
  | "advancement";

/** Semantic intent for texture: block = world, item = inventory, processed = smelted/cooked result. */
export type TextureIntent = "block" | "item" | "processed";

/** Material class for profile-driven rendering (no material-specific branches; used as key). */
export type TextureMaterialClass = "wood" | "stone" | "metal" | "food" | "cloud" | "crystal" | "generic";

/** Semantic texture profile for image generation. materialHint from displayName/familyType; traits inferred. */
export interface TextureProfile {
  intent: "block" | "item" | "processed";
  materialHint: string;
  materialClass?: TextureMaterialClass;
  physicalTraits: string[];
  surfaceStyle: string[];
  visualMotifs?: string[];
}

/** Item render intent: flat sprite vs 3D-like model. */
export type ItemRenderIntent = "flat" | "blocklike" | "chunky" | "rod" | "plate";

export interface ModItem {
  id: string;
  name: string;
  translationKey?: string;
  texturePath?: string;
  /** Optional color hint for generated texture (e.g. "yellow", "red"). */
  colorHint?: string;
  /** Texture semantic: item (default) or processed. Ensures distinct textures. */
  textureIntent?: TextureIntent;
  /** Semantic profile for texture generation (intent, material, traits). Required for pipeline. */
  textureProfile?: TextureProfile;
  /** How to render in-world/inventory: flat (default), blocklike, chunky, rod, plate. */
  itemRender?: ItemRenderIntent;
}

export interface ModBlock {
  id: string;
  name: string;
  texturePath?: string;
  /** Optional color hint for generated texture (e.g. "yellow", "red"). */
  colorHint?: string;
  /** Texture semantic: block (default). Ensures block texture not reused for items. */
  textureIntent?: TextureIntent;
  /** Semantic profile for texture generation (intent, material, traits). Required for pipeline. */
  textureProfile?: TextureProfile;
}

export interface ModOre {
  id: string;
  blockId: string;
  lootTable?: string;
  recipeId?: string;
}

/** Cooking recipe type for 1.21.1 (smelting, blasting, smoking, campfire_cooking). */
export type CookingKind = "smelting" | "blasting" | "smoking" | "campfire_cooking";

export interface ModRecipeIngredient {
  id: string;
  count?: number;
}

export interface ModRecipe {
  id: string;
  type: string;
  /** Required for crafting_shapeless; each entry references a spec item/block id. */
  ingredients?: ModRecipeIngredient[];
  /** Required for crafting_shaped: row strings (e.g. ["###", "# #", "###"]). */
  pattern?: string[];
  /** Required for crafting_shaped: map pattern char to spec id (e.g. { "#": { id: "ingot" } }). */
  key?: Record<string, { id: string }>;
  result: { id: string; count?: number };
  /** Optional for cooking recipes (smelting/blasting/smoking/campfire_cooking). Defaults applied in generator. */
  experience?: number;
  /** Optional for cooking recipes. Defaults: smelting 200, blasting/smoking 100, campfire_cooking 600. */
  cookingtime?: number;
}

export interface ModLoot {
  id: string;
  type: "block" | "entity" | "chest";
  targetId: string;
}

export interface AssetRef {
  path: string;
  /** e.g. 16 for 16x16 item texture */
  expectedWidth?: number;
  expectedHeight?: number;
}

export interface ConstraintsReport {
  allowed: string[];
  rejected: string[];
  approximations: string[];
}

/** Default spec for "hello-world" milestone: minimal valid Fabric mod. */
export function createHelloWorldSpec(modId: string, modName: string): ModSpecV1 {
  return {
    schemaVersion: 1,
    minecraftVersion: SUPPORTED_MINECRAFT_VERSION,
    loader: SUPPORTED_LOADER,
    modId,
    modName,
    features: ["hello-world"],
    assetsRequired: [],
    constraintsReport: {
      allowed: ["minimal Fabric mod", "example item"],
      rejected: [],
      approximations: [],
    },
  };
}
