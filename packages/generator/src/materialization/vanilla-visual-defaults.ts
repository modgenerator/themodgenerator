/**
 * Vanilla-clone default visuals: assign a vanilla visual template when the user
 * did not provide textures. Generic mapping by entity type + id/name patterns only;
 * no noun-specific hardcoding (e.g. no tin/ruby/cheese).
 *
 * Used so generated mods render "non-red" by copying vanilla textures until
 * custom texture generation is available.
 */

import type { ModItem, ModBlock } from "@themodgenerator/spec";

/** Entity shape accepted for classification (ModItem, ModBlock, or minimal with optional category). */
export type EntityForVisual =
  | (ModItem & { type?: "item"; category?: string })
  | (ModBlock & { type?: "block"; category?: string });

/** Minimal context passed to resolver (e.g. modId for texture refs). */
export interface SpecContext {
  modId?: string;
}

/** Visual kind derived from entity id/name/type/category — used to pick vanilla template. */
export enum VisualKind {
  INGOT = "INGOT",
  NUGGET = "NUGGET",
  RAW_ORE = "RAW_ORE",
  GEM = "GEM",
  DUST = "DUST",
  POWDER = "POWDER",
  ROD = "ROD",
  PLATE = "PLATE",
  FOOD = "FOOD",
  SIMPLE_ITEM = "SIMPLE_ITEM",
  TOOL_SWORD = "TOOL_SWORD",
  TOOL_PICKAXE = "TOOL_PICKAXE",
  TOOL_AXE = "TOOL_AXE",
  TOOL_SHOVEL = "TOOL_SHOVEL",
  TOOL_HOE = "TOOL_HOE",
  ARMOR_HELMET = "ARMOR_HELMET",
  ARMOR_CHESTPLATE = "ARMOR_CHESTPLATE",
  ARMOR_LEGGINGS = "ARMOR_LEGGINGS",
  ARMOR_BOOTS = "ARMOR_BOOTS",
  GENERIC_BLOCK = "GENERIC_BLOCK",
  ORE_BLOCK = "ORE_BLOCK",
  METAL_BLOCK = "METAL_BLOCK",
  LOG = "LOG",
  WOOD = "WOOD",
  PLANKS = "PLANKS",
  LEAVES = "LEAVES",
  SAPLING = "SAPLING",
  STAIRS = "STAIRS",
  SLAB = "SLAB",
  FENCE = "FENCE",
  FENCE_GATE = "FENCE_GATE",
  DOOR = "DOOR",
  TRAPDOOR = "TRAPDOOR",
  BUTTON = "BUTTON",
  PRESSURE_PLATE = "PRESSURE_PLATE",
  SIGN = "SIGN",
  HANGING_SIGN = "HANGING_SIGN",
  BOAT = "BOAT",
  CHEST_BOAT = "CHEST_BOAT",
}

/** Vanilla template: path relative to assets/minecraft/textures (no .png). */
const VANILLA_TEMPLATE: Record<VisualKind, string> = {
  [VisualKind.INGOT]: "item/iron_ingot",
  [VisualKind.NUGGET]: "item/iron_nugget",
  [VisualKind.RAW_ORE]: "item/raw_iron",
  [VisualKind.GEM]: "item/diamond",
  [VisualKind.DUST]: "item/redstone",
  [VisualKind.POWDER]: "item/redstone",
  [VisualKind.ROD]: "item/blaze_rod",
  [VisualKind.PLATE]: "item/iron_ingot",
  [VisualKind.FOOD]: "item/apple",
  [VisualKind.SIMPLE_ITEM]: "item/iron_ingot",
  [VisualKind.TOOL_SWORD]: "item/iron_sword",
  [VisualKind.TOOL_PICKAXE]: "item/iron_pickaxe",
  [VisualKind.TOOL_AXE]: "item/iron_axe",
  [VisualKind.TOOL_SHOVEL]: "item/iron_shovel",
  [VisualKind.TOOL_HOE]: "item/iron_hoe",
  [VisualKind.ARMOR_HELMET]: "item/iron_helmet",
  [VisualKind.ARMOR_CHESTPLATE]: "item/iron_chestplate",
  [VisualKind.ARMOR_LEGGINGS]: "item/iron_leggings",
  [VisualKind.ARMOR_BOOTS]: "item/iron_boots",
  [VisualKind.GENERIC_BLOCK]: "block/stone",
  [VisualKind.ORE_BLOCK]: "block/iron_ore",
  [VisualKind.METAL_BLOCK]: "block/iron_block",
  [VisualKind.LOG]: "block/oak_log",
  [VisualKind.WOOD]: "block/oak_wood",
  [VisualKind.PLANKS]: "block/oak_planks",
  [VisualKind.LEAVES]: "block/oak_leaves",
  [VisualKind.SAPLING]: "block/oak_sapling",
  [VisualKind.STAIRS]: "block/oak_stairs",
  [VisualKind.SLAB]: "block/oak_slab",
  [VisualKind.FENCE]: "block/oak_fence",
  [VisualKind.FENCE_GATE]: "block/oak_fence_gate",
  [VisualKind.DOOR]: "item/oak_door",
  [VisualKind.TRAPDOOR]: "block/oak_trapdoor",
  /** Buttons and wooden pressure plates have no dedicated texture in vanilla; models reference planks. */
  [VisualKind.BUTTON]: "block/oak_planks",
  [VisualKind.PRESSURE_PLATE]: "block/oak_planks",
  [VisualKind.SIGN]: "item/oak_sign",
  [VisualKind.HANGING_SIGN]: "item/oak_hanging_sign",
  [VisualKind.BOAT]: "item/oak_boat",
  [VisualKind.CHEST_BOAT]: "item/oak_chest_boat",
};

/** Item kinds use minecraft:item/generated; tools/armor use minecraft:item/handheld. */
const ITEM_MODEL_PARENT: Record<VisualKind, string> = {
  [VisualKind.INGOT]: "minecraft:item/generated",
  [VisualKind.NUGGET]: "minecraft:item/generated",
  [VisualKind.RAW_ORE]: "minecraft:item/generated",
  [VisualKind.GEM]: "minecraft:item/generated",
  [VisualKind.DUST]: "minecraft:item/generated",
  [VisualKind.POWDER]: "minecraft:item/generated",
  [VisualKind.ROD]: "minecraft:item/handheld",
  [VisualKind.PLATE]: "minecraft:item/generated",
  [VisualKind.FOOD]: "minecraft:item/generated",
  [VisualKind.SIMPLE_ITEM]: "minecraft:item/generated",
  [VisualKind.TOOL_SWORD]: "minecraft:item/handheld",
  [VisualKind.TOOL_PICKAXE]: "minecraft:item/handheld",
  [VisualKind.TOOL_AXE]: "minecraft:item/handheld",
  [VisualKind.TOOL_SHOVEL]: "minecraft:item/handheld",
  [VisualKind.TOOL_HOE]: "minecraft:item/handheld",
  [VisualKind.ARMOR_HELMET]: "minecraft:item/generated",
  [VisualKind.ARMOR_CHESTPLATE]: "minecraft:item/generated",
  [VisualKind.ARMOR_LEGGINGS]: "minecraft:item/generated",
  [VisualKind.ARMOR_BOOTS]: "minecraft:item/generated",
  [VisualKind.GENERIC_BLOCK]: "minecraft:block/cube_all",
  [VisualKind.ORE_BLOCK]: "minecraft:block/cube_all",
  [VisualKind.METAL_BLOCK]: "minecraft:block/cube_all",
  [VisualKind.LOG]: "minecraft:block/cube_all",
  [VisualKind.WOOD]: "minecraft:block/cube_all",
  [VisualKind.PLANKS]: "minecraft:block/cube_all",
  [VisualKind.LEAVES]: "minecraft:block/cube_all",
  [VisualKind.SAPLING]: "minecraft:block/cube_all",
  [VisualKind.STAIRS]: "minecraft:block/cube_all",
  [VisualKind.SLAB]: "minecraft:block/cube_all",
  [VisualKind.FENCE]: "minecraft:block/fence_post",
  [VisualKind.FENCE_GATE]: "minecraft:block/template_fence_gate",
  [VisualKind.DOOR]: "minecraft:item/generated",
  [VisualKind.TRAPDOOR]: "minecraft:block/template_orientable_trapdoor_bottom",
  [VisualKind.BUTTON]: "minecraft:block/button_inventory",
  [VisualKind.PRESSURE_PLATE]: "minecraft:block/pressure_plate_up",
  [VisualKind.SIGN]: "minecraft:item/generated",
  [VisualKind.HANGING_SIGN]: "minecraft:item/generated",
  [VisualKind.BOAT]: "minecraft:item/generated",
  [VisualKind.CHEST_BOAT]: "minecraft:item/generated",
};

function isItemLike(e: EntityForVisual): e is ModItem & { type?: "item"; category?: string } {
  return "id" in e && !("type" in e && e.type === "block");
}

/**
 * Classify entity into a VisualKind using id/name patterns and optional category.
 * No noun-specific branches (e.g. no "tin", "ruby", "cheese").
 */
export function classifyEntityVisualKind(entity: EntityForVisual): VisualKind {
  const id = (entity.id ?? "").toLowerCase();
  const name = ("name" in entity ? entity.name ?? "" : "").toLowerCase();
  const category = "category" in entity ? (entity as { category?: string }).category?.toLowerCase() : undefined;
  const combined = `${id} ${name} ${category ?? ""}`.trim();

  const has = (suffix: string) => id.endsWith(suffix) || id.includes(suffix) || combined.includes(suffix);

  // Blocks first (by id/name patterns)
  if (has("_log") && !id.includes("stripped")) return VisualKind.LOG;
  if (has("stripped_") && (id.includes("_log") || id.includes("_wood"))) return VisualKind.LOG;
  if (has("_wood") && !id.includes("stripped")) return VisualKind.WOOD;
  if (has("_planks")) return VisualKind.PLANKS;
  if (has("_leaves")) return VisualKind.LEAVES;
  if (has("_sapling")) return VisualKind.SAPLING;
  if (has("_stairs")) return VisualKind.STAIRS;
  if (has("_slab")) return VisualKind.SLAB;
  if (has("_fence") && !id.includes("fence_gate")) return VisualKind.FENCE;
  if (has("_fence_gate") || has("fence_gate")) return VisualKind.FENCE_GATE;
  if (has("_door")) return VisualKind.DOOR;
  if (has("_trapdoor") || has("trapdoor")) return VisualKind.TRAPDOOR;
  if (has("_button") || has("button")) return VisualKind.BUTTON;
  if (has("_pressure_plate") || has("pressure_plate")) return VisualKind.PRESSURE_PLATE;
  if (has("_sign") && !id.includes("hanging")) return VisualKind.SIGN;
  if (has("hanging_sign") || has("_hanging_sign")) return VisualKind.HANGING_SIGN;
  if (has("_boat") && !id.includes("chest")) return VisualKind.BOAT;
  if (has("chest_boat") || has("_chest_boat")) return VisualKind.CHEST_BOAT;

  if (has("_ore") || category === "ore") return VisualKind.ORE_BLOCK;
  if ((id.endsWith("_block") || has("_block")) && (has("ingot") || has("metal") || category === "metal")) return VisualKind.METAL_BLOCK;

  // Items
  if (has("_ingot") || category === "ingot") return VisualKind.INGOT;
  if (has("_nugget") || category === "nugget") return VisualKind.NUGGET;
  if (has("raw_") && (id.includes("_ore") || id.includes("raw"))) return VisualKind.RAW_ORE;
  if (has("_gem") || has("gem") || category === "gem") return VisualKind.GEM;
  if (has("_dust") || has("dust")) return VisualKind.DUST;
  if (has("_powder") || has("powder")) return VisualKind.POWDER;
  if (has("_rod") || has("rod")) return VisualKind.ROD;
  if (has("_plate") || has("plate")) return VisualKind.PLATE;
  if (category === "food" || has("_food") || (has("apple") || has("berry") || has("meat"))) return VisualKind.FOOD;

  if (has("_sword") || has("sword")) return VisualKind.TOOL_SWORD;
  if (has("_pickaxe") || has("pickaxe")) return VisualKind.TOOL_PICKAXE;
  if (has("_axe") || has("axe")) return VisualKind.TOOL_AXE;
  if (has("_shovel") || has("shovel")) return VisualKind.TOOL_SHOVEL;
  if (has("_hoe") || has("hoe")) return VisualKind.TOOL_HOE;

  if (has("_helmet") || has("helmet")) return VisualKind.ARMOR_HELMET;
  if (has("_chestplate") || has("chestplate")) return VisualKind.ARMOR_CHESTPLATE;
  if (has("_leggings") || has("leggings")) return VisualKind.ARMOR_LEGGINGS;
  if (has("_boots") || has("boots")) return VisualKind.ARMOR_BOOTS;

  // Block fallback
  if (!isItemLike(entity)) return VisualKind.GENERIC_BLOCK;

  return VisualKind.SIMPLE_ITEM;
}

export interface VanillaVisualDefaultResult {
  /** Parent model path (e.g. minecraft:item/generated, minecraft:item/handheld). */
  modelParent: string;
  /** Vanilla texture paths to copy (relative to assets/minecraft/textures, no .png). */
  copyFromVanillaPaths: string[];
  /** Resolved VisualKind. */
  visualKind: VisualKind;
}

/**
 * Resolve vanilla visual defaults for an entity that has no user-provided texture.
 * Returns model parent and vanilla paths to copy so the builder can pull assets from jar/bundled pack.
 */
export function resolveVanillaVisualDefaults(
  entity: EntityForVisual,
  _specContext?: SpecContext
): VanillaVisualDefaultResult {
  const visualKind = classifyEntityVisualKind(entity);
  const templatePath = VANILLA_TEMPLATE[visualKind];
  // Blocks: use cube_all so one copied texture (copyFromVanillaPaths[0]) suffices; no multi-texture templates yet.
  const modelParent = isItemLike(entity)
    ? ITEM_MODEL_PARENT[visualKind]
    : "minecraft:block/cube_all";

  return {
    modelParent,
    copyFromVanillaPaths: [templatePath],
    visualKind,
  };
}
