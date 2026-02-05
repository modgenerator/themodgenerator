/**
 * Recipe validation: fail fast if recipes are invalid for Minecraft 1.21.1.
 * - crafting_shapeless must have at least one ingredient
 * - smelting/blasting: ingredient must not equal result (no self-loop)
 * - every ingredient and result id that belongs to our mod must be in the (expanded) spec;
 *   minecraft:* and other vanilla/external ids are allowed.
 */

import type { ModSpecV1 } from "@themodgenerator/spec";

export interface ValidateRecipesResult {
  valid: boolean;
  errors: string[];
}

export interface ValidateRecipesOptions {
  /** When true (default), treat minecraft:* and common vanilla ids as valid ingredients/results. */
  allowVanillaIngredients?: boolean;
}

/** Ids that are valid as vanilla/external (no "must be in spec" check). */
function isVanillaOrExternalId(id: string): boolean {
  if (id.startsWith("minecraft:")) return true;
  const vanillaShort = new Set([
    "stick", "chest", "iron_ingot", "gold_ingot", "string", "leather", "paper", "slime_ball",
    "redstone", "gunpowder", "blaze_rod", "bowl", "clay_ball", "brick", "feather", "flint",
    "coal", "charcoal", "sugar", "egg", "wheat", "wheat_seeds", "bone", "bone_meal",
    "ender_pearl", "glowstone_dust", "nether_wart", "magma_cream", "phantom_membrane",
    "rabbit_hide", "rabbit_foot", "scute", "turtle_helmet", "nautilus_shell", "heart_of_the_sea",
    "nether_star", "shulker_shell", "echo_shard", "netherite_ingot", "netherite_scrap",
  ]);
  return vanillaShort.has(id);
}

function allIds(spec: ModSpecV1): Set<string> {
  const set = new Set<string>();
  for (const i of spec.items ?? []) set.add(i.id);
  for (const b of spec.blocks ?? []) set.add(b.id);
  return set;
}

/** True if id is valid: in our spec ids or allowed as vanilla/external when allowVanilla. */
function idOk(id: string, ids: Set<string>, allowVanilla: boolean): boolean {
  if (ids.has(id)) return true;
  if (!allowVanilla) return false;
  if (isVanillaOrExternalId(id)) return true;
  const colon = id.indexOf(":");
  if (colon !== -1 && id.slice(0, colon) === "minecraft") return true;
  return false;
}

export function validateRecipes(spec: ModSpecV1, options?: ValidateRecipesOptions): ValidateRecipesResult {
  const errors: string[] = [];
  const ids = allIds(spec);
  const allowVanilla = options?.allowVanillaIngredients !== false;

  const cookingTypes = ["smelting", "blasting", "smoking", "campfire_cooking"];
  for (const rec of spec.recipes ?? []) {
    if (rec.type === "crafting_shapeless") {
      const count = rec.ingredients?.length ?? 0;
      if (count === 0) errors.push(`Recipe ${rec.id}: crafting_shapeless must have at least one ingredient.`);
      for (const ing of rec.ingredients ?? []) {
        if (!idOk(ing.id, ids, allowVanilla)) errors.push(`Recipe ${rec.id}: ingredient "${ing.id}" is not an item or block in the spec.`);
      }
      if (!idOk(rec.result.id, ids, allowVanilla)) errors.push(`Recipe ${rec.id}: result "${rec.result.id}" is not an item or block in the spec.`);
    } else if (rec.type === "crafting_shaped") {
      const pattern = (rec as { pattern?: string[] }).pattern ?? [];
      const key = (rec as { key?: Record<string, { id: string }> }).key ?? {};
      if (pattern.length === 0) errors.push(`Recipe ${rec.id}: crafting_shaped must have pattern.`);
      if (Object.keys(key).length === 0) errors.push(`Recipe ${rec.id}: crafting_shaped must have key.`);
      for (const entry of Object.values(key)) {
        if (entry?.id && !idOk(entry.id, ids, allowVanilla)) errors.push(`Recipe ${rec.id}: key ingredient "${entry.id}" is not in spec.`);
        if (entry?.id === rec.result.id) errors.push(`Recipe ${rec.id}: crafting_shaped self-loop.`);
      }
      if (!idOk(rec.result.id, ids, allowVanilla)) errors.push(`Recipe ${rec.id}: result "${rec.result.id}" is not an item or block in the spec.`);
    } else if (cookingTypes.includes(rec.type)) {
      const ing = rec.ingredients?.[0];
      if (!ing?.id) errors.push(`Recipe ${rec.id}: ${rec.type} must have at least one ingredient.`);
      else {
        if (ing.id === rec.result.id) errors.push(`Recipe ${rec.id}: ${rec.type} self-loop.`);
        if (!idOk(ing.id, ids, allowVanilla)) errors.push(`Recipe ${rec.id}: ingredient "${ing.id}" is not in spec.`);
      }
      if (!idOk(rec.result.id, ids, allowVanilla)) errors.push(`Recipe ${rec.id}: result "${rec.result.id}" is not in spec.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
