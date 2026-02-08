/**
 * Wood family expansion: one WoodType → full set of ItemSpec, BlockSpec, and ModRecipes.
 * Descriptors are built by expansion from merged items/blocks (same as explicit spec items/blocks).
 * Matches vanilla wood family (log, planks, stairs, slab, fence, door, boat, etc.).
 * Deterministic order: same woodTypes array → same output order.
 */

import type { WoodType, ModRecipe } from "./types.js";
import type { ItemSpec, BlockSpec } from "./specs.js";
import { TIER_1 } from "./tier.js";

/** Single wood-family member: id suffix (e.g. "_log"), display suffix (" Log"), and whether it's block-only, item-only, or both. */
const WOOD_FAMILY_MEMBERS: ReadonlyArray<{
  idSuffix: string;
  displaySuffix: string;
  kind: "block" | "item" | "both";
  material?: string;
}> = [
  { idSuffix: "_log", displaySuffix: " Log", kind: "both", material: "wood" },
  { idSuffix: "_stripped_log", displaySuffix: " Stripped Log", kind: "both", material: "wood" },
  { idSuffix: "_wood", displaySuffix: " Wood", kind: "both", material: "wood" },
  { idSuffix: "_stripped_wood", displaySuffix: " Stripped Wood", kind: "both", material: "wood" },
  { idSuffix: "_planks", displaySuffix: " Planks", kind: "both", material: "wood" },
  { idSuffix: "_stairs", displaySuffix: " Stairs", kind: "both", material: "wood" },
  { idSuffix: "_slab", displaySuffix: " Slab", kind: "both", material: "wood" },
  { idSuffix: "_fence", displaySuffix: " Fence", kind: "both", material: "wood" },
  { idSuffix: "_fence_gate", displaySuffix: " Fence Gate", kind: "both", material: "wood" },
  { idSuffix: "_door", displaySuffix: " Door", kind: "both", material: "wood" },
  { idSuffix: "_trapdoor", displaySuffix: " Trapdoor", kind: "both", material: "wood" },
  { idSuffix: "_pressure_plate", displaySuffix: " Pressure Plate", kind: "both", material: "wood" },
  { idSuffix: "_button", displaySuffix: " Button", kind: "both", material: "wood" },
  { idSuffix: "_sign", displaySuffix: " Sign", kind: "both", material: "wood" },
  { idSuffix: "_hanging_sign", displaySuffix: " Hanging Sign", kind: "both", material: "wood" },
  { idSuffix: "_wall_hanging_sign", displaySuffix: " Wall Hanging Sign", kind: "block", material: "wood" },
  // Boat/chest_boat omitted until entity+renderer implemented
];

export interface WoodExpansionResult {
  itemSpecs: ItemSpec[];
  blockSpecs: BlockSpec[];
}

function toBlockSpec(wood: WoodType, idSuffix: string, displaySuffix: string, material: string): BlockSpec {
  const id = `${wood.id}${idSuffix}`;
  const name = `${wood.displayName}${displaySuffix}`;
  return {
    id,
    name,
    tier: TIER_1,
    material,
  };
}

function toItemSpec(wood: WoodType, idSuffix: string, displaySuffix: string, material: string): ItemSpec {
  const id = `${wood.id}${idSuffix}`;
  const name = `${wood.displayName}${displaySuffix}`;
  return {
    id,
    name,
    tier: TIER_1,
    material,
  };
}

/** Expand a single WoodType into the full wood family. Order: by WOOD_FAMILY_MEMBERS. */
export function expandWoodType(wood: WoodType): WoodExpansionResult {
  const itemSpecs: ItemSpec[] = [];
  const blockSpecs: BlockSpec[] = [];

  for (const member of WOOD_FAMILY_MEMBERS) {
    const material = member.material ?? "wood";

    if (member.kind === "block" || member.kind === "both") {
      blockSpecs.push(toBlockSpec(wood, member.idSuffix, member.displaySuffix, material));
    }
    if (member.kind === "item" || member.kind === "both") {
      itemSpecs.push(toItemSpec(wood, member.idSuffix, member.displaySuffix, material));
    }
  }

  return { itemSpecs, blockSpecs };
}

/** Expand all wood types. Order: all members of first wood, then all of second, etc. Deterministic. */
export function expandWoodTypes(woodTypes: WoodType[]): WoodExpansionResult {
  const itemSpecs: ItemSpec[] = [];
  const blockSpecs: BlockSpec[] = [];

  for (const wood of woodTypes) {
    const result = expandWoodType(wood);
    itemSpecs.push(...result.itemSpecs);
    blockSpecs.push(...result.blockSpecs);
  }

  return { itemSpecs, blockSpecs };
}

/** Vanilla-style recipes for one wood type (log→planks, planks→stairs/slab/fence/.../boat/chest_boat). MC 1.21.1 format. */
export function woodRecipesFromWoodTypes(woodTypes: WoodType[]): ModRecipe[] {
  const recipes: ModRecipe[] = [];
  for (const wood of woodTypes) {
    const woodId = wood.id;
    const planks = `${woodId}_planks`;
    const log = `${woodId}_log`;

    recipes.push({
      id: `${woodId}_planks_from_log`,
      type: "crafting_shapeless",
      ingredients: [{ id: log, count: 1 }],
      result: { id: planks, count: 4 },
    });
    // Vanilla-equivalent recipes using our planks only (no dependency on #minecraft:planks)
    recipes.push({
      id: `sticks_from_${woodId}_planks`,
      type: "crafting_shapeless",
      ingredients: [{ id: planks, count: 2 }],
      result: { id: "minecraft:stick", count: 4 },
    });
    recipes.push({
      id: `crafting_table_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: ["##", "##"],
      key: { "#": { id: planks } },
      result: { id: "minecraft:crafting_table", count: 1 },
    });
    recipes.push({
      id: `chest_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: ["###", "# #", "###"],
      key: { "#": { id: planks } },
      result: { id: "minecraft:chest", count: 1 },
    });
    recipes.push({
      id: `${woodId}_stairs`,
      type: "crafting_shaped",
      pattern: ["#  ", "## ", "###"],
      key: { "#": { id: planks } },
      result: { id: `${woodId}_stairs`, count: 4 },
    });
    recipes.push({
      id: `${woodId}_slab`,
      type: "crafting_shaped",
      pattern: ["###"],
      key: { "#": { id: planks } },
      result: { id: `${woodId}_slab`, count: 6 },
    });
    recipes.push({
      id: `${woodId}_fence`,
      type: "crafting_shaped",
      pattern: ["#/#", "#/#"],
      key: { "#": { id: planks }, "/": { id: "minecraft:stick" } },
      result: { id: `${woodId}_fence`, count: 3 },
    });
    recipes.push({
      id: `${woodId}_fence_gate`,
      type: "crafting_shaped",
      pattern: ["/#/", "#/#"],
      key: { "#": { id: planks }, "/": { id: "minecraft:stick" } },
      result: { id: `${woodId}_fence_gate`, count: 1 },
    });
    recipes.push({
      id: `${woodId}_door`,
      type: "crafting_shaped",
      pattern: ["##", "##", "##"],
      key: { "#": { id: planks } },
      result: { id: `${woodId}_door`, count: 3 },
    });
    recipes.push({
      id: `${woodId}_trapdoor`,
      type: "crafting_shaped",
      pattern: ["###", "###"],
      key: { "#": { id: planks } },
      result: { id: `${woodId}_trapdoor`, count: 2 },
    });
    recipes.push({
      id: `${woodId}_button`,
      type: "crafting_shapeless",
      ingredients: [{ id: planks }],
      result: { id: `${woodId}_button`, count: 1 },
    });
    recipes.push({
      id: `${woodId}_pressure_plate`,
      type: "crafting_shaped",
      pattern: ["##"],
      key: { "#": { id: planks } },
      result: { id: `${woodId}_pressure_plate`, count: 1 },
    });
    recipes.push({
      id: `${woodId}_sign`,
      type: "crafting_shaped",
      pattern: ["###", "###", " - "],
      key: { "#": { id: planks }, "-": { id: "minecraft:stick" } },
      result: { id: `${woodId}_sign`, count: 3 },
    });
    recipes.push({
      id: `${woodId}_hanging_sign`,
      type: "crafting_shaped",
      pattern: ["A A", "BBB", "BBB"],
      key: {
        A: { id: "minecraft:chain" },
        B: { id: `${woodId}_stripped_log` },
      },
      result: { id: `${woodId}_hanging_sign`, count: 6 },
    });
    // Vanilla-equivalent recipes using generated planks only (no #minecraft:planks)
    recipes.push({
      id: `wooden_sword_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: [" # ", " # ", " - "],
      key: { "#": { id: planks }, "-": { id: "minecraft:stick" } },
      result: { id: "minecraft:wooden_sword", count: 1 },
    });
    recipes.push({
      id: `wooden_pickaxe_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: ["###", " - ", " - "],
      key: { "#": { id: planks }, "-": { id: "minecraft:stick" } },
      result: { id: "minecraft:wooden_pickaxe", count: 1 },
    });
    recipes.push({
      id: `wooden_axe_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: ["##", "#-", " -"],
      key: { "#": { id: planks }, "-": { id: "minecraft:stick" } },
      result: { id: "minecraft:wooden_axe", count: 1 },
    });
    recipes.push({
      id: `wooden_shovel_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: [" # ", " - ", " - "],
      key: { "#": { id: planks }, "-": { id: "minecraft:stick" } },
      result: { id: "minecraft:wooden_shovel", count: 1 },
    });
    recipes.push({
      id: `wooden_hoe_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: ["##", " -", " -"],
      key: { "#": { id: planks }, "-": { id: "minecraft:stick" } },
      result: { id: "minecraft:wooden_hoe", count: 1 },
    });
    recipes.push({
      id: `barrel_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: ["#-#", "# #", "#-#"],
      key: { "#": { id: planks }, "-": { id: "minecraft:stick" } },
      result: { id: "minecraft:barrel", count: 1 },
    });
    recipes.push({
      id: `bowl_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: ["# #", " # "],
      key: { "#": { id: planks } },
      result: { id: "minecraft:bowl", count: 4 },
    });
    recipes.push({
      id: `shield_from_${woodId}_planks`,
      type: "crafting_shaped",
      pattern: ["#-#", "###", " - "],
      key: { "#": { id: planks }, "-": { id: "minecraft:iron_ingot" } },
      result: { id: "minecraft:shield", count: 1 },
    });
  }
  return recipes;
}
