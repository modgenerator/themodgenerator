/**
 * Vanilla-clone defaults: assign a vanilla visual template when user didn't provide textures.
 * Generic mapping by id/name patterns (suffix/prefix only). No noun-specific hardcoding.
 * Ensures "nothing is red" by copying vanilla assets.
 */

/** Vanilla template: path under assets/minecraft/ (no .png). Item = textures/item/<id>.png, block = textures/block/<id>.png. */
export type VanillaTemplate = string;

export enum VisualKind {
  INGOT = "INGOT",
  NUGGET = "NUGGET",
  RAW_ORE = "RAW_ORE",
  GEM = "GEM",
  DUST = "DUST",
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

export interface VanillaVisualResult {
  /** Parent model path (e.g. minecraft:item/generated, minecraft:item/handheld). */
  modelParent: string;
  /** Vanilla texture paths to copy (relative to assets/minecraft/textures/, without .png). */
  copyFromVanillaPaths: string[];
}

type EntityLike = { id: string; name: string };

/** Classify entity by id/name patterns only (suffix/prefix). Generic; no material nouns. */
export function classifyEntityVisualKind(entity: EntityLike, category: "item" | "block"): VisualKind {
  const id = entity.id.toLowerCase();
  const name = entity.name.toLowerCase();

  if (category === "block") {
    if (/\b(log|_log)$/.test(id) || /\blog\b/.test(name)) return VisualKind.LOG;
    if (/\b(wood|_wood)$/.test(id) && !/stripped/.test(id)) return VisualKind.WOOD;
    if (/\b(planks|_planks)$/.test(id)) return VisualKind.PLANKS;
    if (/\b(leaves|_leaves)$/.test(id)) return VisualKind.LEAVES;
    if (/\b(sapling|_sapling)$/.test(id)) return VisualKind.SAPLING;
    if (/\b(stairs|_stairs)$/.test(id)) return VisualKind.STAIRS;
    if (/\b(slab|_slab)$/.test(id)) return VisualKind.SLAB;
    if (/\b(fence|_fence)$/.test(id) && !/gate/.test(id)) return VisualKind.FENCE;
    if (/\b(fence_gate|_fence_gate)$/.test(id)) return VisualKind.FENCE_GATE;
    if (/\b(door|_door)$/.test(id)) return VisualKind.DOOR;
    if (/\b(trapdoor|_trapdoor)$/.test(id)) return VisualKind.TRAPDOOR;
    if (/\b(button|_button)$/.test(id)) return VisualKind.BUTTON;
    if (/\b(pressure_plate|_pressure_plate)$/.test(id)) return VisualKind.PRESSURE_PLATE;
    if (/\b(sign|_sign)$/.test(id) && !/hanging/.test(id)) return VisualKind.SIGN;
    if (/\b(hanging_sign|_hanging_sign)$/.test(id)) return VisualKind.HANGING_SIGN;
    if (/\b(ore|_ore)$/.test(id)) return VisualKind.ORE_BLOCK;
    if (/\b(block|_block)$/.test(id) && (/metal|ingot|_block$/.test(id) || name.includes("block"))) return VisualKind.METAL_BLOCK;
    return VisualKind.GENERIC_BLOCK;
  }

  if (category === "item") {
    if (/\b(ingot|_ingot)$/.test(id)) return VisualKind.INGOT;
    if (/\b(nugget|_nugget)$/.test(id)) return VisualKind.NUGGET;
    if (/\b(raw_|raw)\b/.test(id) && /\b(ore|metal)\b/.test(id)) return VisualKind.RAW_ORE;
    if (/\b(gem|_gem)$/.test(id) || /\b(shard|_shard)$/.test(id)) return VisualKind.GEM;
    if (/\b(dust|_dust)$/.test(id) || /\b(powder|_powder)$/.test(id)) return VisualKind.DUST;
    if (/\b(rod|_rod)$/.test(id)) return VisualKind.ROD;
    if (/\b(plate|_plate)$/.test(id) && !/pressure/.test(id)) return VisualKind.PLATE;
    if (/\b(sword|_sword)$/.test(id)) return VisualKind.TOOL_SWORD;
    if (/\b(pickaxe|_pickaxe)$/.test(id)) return VisualKind.TOOL_PICKAXE;
    if (/\b(axe|_axe)$/.test(id)) return VisualKind.TOOL_AXE;
    if (/\b(shovel|_shovel)$/.test(id)) return VisualKind.TOOL_SHOVEL;
    if (/\b(hoe|_hoe)$/.test(id)) return VisualKind.TOOL_HOE;
    if (/\b(helmet|_helmet)$/.test(id)) return VisualKind.ARMOR_HELMET;
    if (/\b(chestplate|_chestplate)$/.test(id)) return VisualKind.ARMOR_CHESTPLATE;
    if (/\b(leggings|_leggings)$/.test(id)) return VisualKind.ARMOR_LEGGINGS;
    if (/\b(boots|_boots)$/.test(id)) return VisualKind.ARMOR_BOOTS;
    if (/\b(boat|_boat)$/.test(id) && !/chest/.test(id)) return VisualKind.BOAT;
    if (/\b(chest_boat|_chest_boat)$/.test(id)) return VisualKind.CHEST_BOAT;
    if (/\b(sign|_sign)$/.test(id) && !/hanging/.test(id)) return VisualKind.SIGN;
    if (/\b(hanging_sign|_hanging_sign)$/.test(id)) return VisualKind.HANGING_SIGN;
    if (/\b(door|_door)$/.test(id)) return VisualKind.DOOR;
    if (/\b(food|_food)$/.test(id) || /\b(edible|eat)\b/.test(name)) return VisualKind.FOOD;
  }

  return category === "item" ? VisualKind.SIMPLE_ITEM : VisualKind.GENERIC_BLOCK;
}

const VANILLA_ITEM: Record<VisualKind, { parent: string; texture: string } | undefined> = {
  [VisualKind.INGOT]: { parent: "minecraft:item/generated", texture: "item/iron_ingot" },
  [VisualKind.NUGGET]: { parent: "minecraft:item/generated", texture: "item/iron_nugget" },
  [VisualKind.RAW_ORE]: { parent: "minecraft:item/generated", texture: "item/raw_iron" },
  [VisualKind.GEM]: { parent: "minecraft:item/generated", texture: "item/diamond" },
  [VisualKind.DUST]: { parent: "minecraft:item/generated", texture: "item/redstone" },
  [VisualKind.ROD]: { parent: "minecraft:item/handheld", texture: "item/blaze_rod" },
  [VisualKind.PLATE]: { parent: "minecraft:item/generated", texture: "item/iron_ingot" },
  [VisualKind.FOOD]: { parent: "minecraft:item/generated", texture: "item/apple" },
  [VisualKind.SIMPLE_ITEM]: { parent: "minecraft:item/generated", texture: "item/iron_ingot" },
  [VisualKind.TOOL_SWORD]: { parent: "minecraft:item/handheld", texture: "item/iron_sword" },
  [VisualKind.TOOL_PICKAXE]: { parent: "minecraft:item/handheld", texture: "item/iron_pickaxe" },
  [VisualKind.TOOL_AXE]: { parent: "minecraft:item/handheld", texture: "item/iron_axe" },
  [VisualKind.TOOL_SHOVEL]: { parent: "minecraft:item/handheld", texture: "item/iron_shovel" },
  [VisualKind.TOOL_HOE]: { parent: "minecraft:item/handheld", texture: "item/iron_hoe" },
  [VisualKind.ARMOR_HELMET]: { parent: "minecraft:item/generated", texture: "item/iron_helmet" },
  [VisualKind.ARMOR_CHESTPLATE]: { parent: "minecraft:item/generated", texture: "item/iron_chestplate" },
  [VisualKind.ARMOR_LEGGINGS]: { parent: "minecraft:item/generated", texture: "item/iron_leggings" },
  [VisualKind.ARMOR_BOOTS]: { parent: "minecraft:item/generated", texture: "item/iron_boots" },
  [VisualKind.GENERIC_BLOCK]: undefined,
  [VisualKind.ORE_BLOCK]: undefined,
  [VisualKind.METAL_BLOCK]: undefined,
  [VisualKind.LOG]: undefined,
  [VisualKind.WOOD]: undefined,
  [VisualKind.PLANKS]: undefined,
  [VisualKind.LEAVES]: undefined,
  [VisualKind.SAPLING]: undefined,
  [VisualKind.STAIRS]: undefined,
  [VisualKind.SLAB]: undefined,
  [VisualKind.FENCE]: undefined,
  [VisualKind.FENCE_GATE]: undefined,
  [VisualKind.DOOR]: { parent: "minecraft:item/generated", texture: "item/oak_door" },
  [VisualKind.TRAPDOOR]: undefined,
  [VisualKind.BUTTON]: undefined,
  [VisualKind.PRESSURE_PLATE]: undefined,
  [VisualKind.SIGN]: { parent: "minecraft:item/generated", texture: "item/oak_sign" },
  [VisualKind.HANGING_SIGN]: { parent: "minecraft:item/generated", texture: "item/oak_hanging_sign" },
  [VisualKind.BOAT]: { parent: "minecraft:item/generated", texture: "item/oak_boat" },
  [VisualKind.CHEST_BOAT]: { parent: "minecraft:item/generated", texture: "item/oak_chest_boat" },
};

const VANILLA_BLOCK: Record<VisualKind, string | undefined> = {
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
  [VisualKind.DOOR]: "block/oak_door_bottom",
  [VisualKind.TRAPDOOR]: "block/oak_trapdoor_bottom",
  /** Vanilla has no textures/block/oak_button.png; button models use planks texture. Same for wooden pressure plate. */
  [VisualKind.BUTTON]: "block/oak_planks",
  [VisualKind.PRESSURE_PLATE]: "block/oak_planks",
  [VisualKind.SIGN]: "block/oak_sign",
  [VisualKind.HANGING_SIGN]: "block/oak_hanging_sign",
  [VisualKind.INGOT]: undefined,
  [VisualKind.NUGGET]: undefined,
  [VisualKind.RAW_ORE]: undefined,
  [VisualKind.GEM]: undefined,
  [VisualKind.DUST]: undefined,
  [VisualKind.ROD]: undefined,
  [VisualKind.PLATE]: undefined,
  [VisualKind.FOOD]: undefined,
  [VisualKind.SIMPLE_ITEM]: undefined,
  [VisualKind.TOOL_SWORD]: undefined,
  [VisualKind.TOOL_PICKAXE]: undefined,
  [VisualKind.TOOL_AXE]: undefined,
  [VisualKind.TOOL_SHOVEL]: undefined,
  [VisualKind.TOOL_HOE]: undefined,
  [VisualKind.ARMOR_HELMET]: undefined,
  [VisualKind.ARMOR_CHESTPLATE]: undefined,
  [VisualKind.ARMOR_LEGGINGS]: undefined,
  [VisualKind.ARMOR_BOOTS]: undefined,
  [VisualKind.BOAT]: undefined,
  [VisualKind.CHEST_BOAT]: undefined,
};

export interface SpecContext {
  modId: string;
}

/**
 * Resolve vanilla visual defaults for an entity that has no user-provided texture.
 * Returns model parent + paths to copy from vanilla so builder can copy assets.
 */
export function resolveVanillaVisualDefaults(
  entity: EntityLike,
  category: "item" | "block",
  _specContext: SpecContext
): VanillaVisualResult {
  const kind = classifyEntityVisualKind(entity, category);

  if (category === "item") {
    const itemDef = VANILLA_ITEM[kind] ?? VANILLA_ITEM[VisualKind.SIMPLE_ITEM]!;
    return {
      modelParent: itemDef.parent,
      copyFromVanillaPaths: [itemDef.texture],
    };
  }

  const blockTex = VANILLA_BLOCK[kind] ?? VANILLA_BLOCK[VisualKind.GENERIC_BLOCK]!;
  return {
    modelParent: "minecraft:block/cube_all",
    copyFromVanillaPaths: [blockTex],
  };
}
