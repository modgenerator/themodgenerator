/**
 * ModSpec V2 — strict JSON schema for deterministic pipeline.
 * LLM produces this; RuleEngine expands it; Validator enforces; Compiler generates Fabric.
 * Stats (tool/armor) are derived deterministically from rarity + overrides, never invented by LLM.
 */

export const MODSPEC_V2_VERSION = 2 as const;
export const SUPPORTED_MINECRAFT_V2 = "1.21.1" as const;
export const SUPPORTED_FABRIC_V2 = "0.15" as const;

export type MaterialCategory =
  | "gem"
  | "ingot"
  | "wood"
  | "stone"
  | "metal"
  | "food"
  | "misc";

export type PowerProfile =
  | "default"
  | "cosmetic"
  | "glass_cannon"
  | "tank"
  | "utility";

export interface ModSpecV2Material {
  id: string;
  category: MaterialCategory;
  /** e.g. "yellow", "red", or "#RRGGBB" */
  palette?: string[];
  colorHints?: string[];
  powerProfile?: PowerProfile;
  styleOverPower?: boolean;
}

export type BlockKind = "basic" | "ore" | "workstationLike";

export interface TextureSpec {
  base: "stone" | "metal" | "wood" | "food" | "gem" | "generic";
  palette?: string[];
}

export type ToolTag = "pickaxe" | "axe" | "shovel" | "hoe" | "none";

export interface MiningSpec {
  toolTag: ToolTag;
  requiredLevel: number;
  hardness: number;
}

export interface DropsSpec {
  /** Item or block ID dropped when broken. */
  itemId: string;
  countMin?: number;
  countMax?: number;
  /** Optional fortune formula. */
  fortuneMultiplier?: number;
}

export interface ModSpecV2Block {
  id: string;
  name?: string;
  kind: BlockKind;
  textureSpec: TextureSpec;
  miningSpec?: MiningSpec;
  dropsSpec?: DropsSpec;
  /** Reference to material for ore/storage block. */
  materialRef?: string;
}

export interface ModSpecV2Worldgen {
  oreBlockId: string;
  minY: number;
  maxY: number;
  veinSize: number;
  veinsPerChunk: number;
  biomeTags?: string[];
  rarityNotes?: string;
}

export type ItemKind =
  | "gem"
  | "raw"
  | "ingot"
  | "nugget"
  | "tool"
  | "armor"
  | "food"
  | "misc";

export interface ModSpecV2Item {
  id: string;
  name?: string;
  kind: ItemKind;
  materialRef: string;
}

export type RecipeType =
  | "crafting_shaped"
  | "crafting_shapeless"
  | "smelting"
  | "blasting"
  | "smoking"
  | "campfire"
  | "stonecutting"
  | "smithing";

export interface RecipeIngredient {
  id: string;
  count?: number;
  tag?: string;
}

export interface ModSpecV2Recipe {
  id: string;
  type: RecipeType;
  inputs: RecipeIngredient[];
  result: { id: string; count?: number };
  /** Optional for smelting/blasting: experience. */
  experience?: number;
  /** Optional: cook time in ticks. */
  cookTimeTicks?: number;
}

export interface ModSpecV2Tag {
  tagId: string;
  /** e.g. "mineable/pickaxe", "fabric:item_group" */
  category: string;
  values: string[];
}

export interface ModSpecV2 {
  schemaVersion: 2;
  namespace: string;
  modId: string;
  modName: string;
  minecraftVersion: string;
  fabricVersion: string;
  materials?: ModSpecV2Material[];
  blocks?: ModSpecV2Block[];
  worldgen?: ModSpecV2Worldgen[];
  items?: ModSpecV2Item[];
  recipes?: ModSpecV2Recipe[];
  tags?: ModSpecV2Tag[];
  /** If true, RuleEngine may add tool/armor sets for ore materials (later). */
  autoExpandSets?: boolean;
}

export function isModSpecV2(spec: { schemaVersion?: number }): spec is ModSpecV2 {
  return spec.schemaVersion === 2;
}
