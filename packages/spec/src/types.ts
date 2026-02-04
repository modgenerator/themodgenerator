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
};

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

export interface ModItem {
  id: string;
  name: string;
  translationKey?: string;
  texturePath?: string;
  /** Optional color hint for generated texture (e.g. "yellow", "red"). */
  colorHint?: string;
}

export interface ModBlock {
  id: string;
  name: string;
  texturePath?: string;
  /** Optional color hint for generated texture (e.g. "yellow", "red"). */
  colorHint?: string;
}

export interface ModOre {
  id: string;
  blockId: string;
  lootTable?: string;
  recipeId?: string;
}

export interface ModRecipeIngredient {
  id: string;
  count?: number;
}

export interface ModRecipe {
  id: string;
  type: string;
  /** Required for crafting_*; each entry references a spec item/block id. */
  ingredients?: ModRecipeIngredient[];
  result: { id: string; count?: number };
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
