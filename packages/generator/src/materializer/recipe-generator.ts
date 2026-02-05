/**
 * Generate data/<modId>/recipe/*.json from spec only (1.21+ singular folder).
 * No keyword or id-based branches; all recipes come from expanded.spec.recipes[].
 * Minecraft 1.21.1: crafting_shapeless, crafting_shaped, smelting, blasting, smoking, campfire_cooking.
 * Crafting result: { "id": "<modid>:<id>", "count": N }.
 * Cooking result: { "id": "<modid>:<id>", "count": N } (item stack JSON).
 */

import type { ExpandedSpecTier1, ModRecipe } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";

const DATA_RECIPES = "src/main/resources/data";

/**
 * Resolve a recipe key ingredient id to a stable item/tag id for JSON.
 * If id already contains ":" (e.g. "minecraft:stick" or "#minecraft:logs"), return as-is.
 * Otherwise treat as mod-local id and return `${modId}:${id}`.
 */
export function resolveIngredientId(modId: string, id: string): string {
  if (id.includes(":")) return id;
  return `${modId}:${id}`;
}

/**
 * Resolve recipe result id for JSON. If id is already namespaced (e.g. "minecraft:stick"), return as-is; else prefix with modId.
 */
function resolveResultId(modId: string, id: string): string {
  if (id.includes(":")) return id;
  return `${modId}:${id}`;
}

/** Crafting shapeless from spec: ingredients[] MUST have at least one entry. MC 1.21.1 result uses "id". */
function craftingShapelessFromSpec(modId: string, rec: ModRecipe): string {
  const ingredients = (rec.ingredients ?? []).flatMap((ing) =>
    Array(ing.count ?? 1).fill(null).map(() => ({ item: resolveIngredientId(modId, ing.id) }))
  );
  if (ingredients.length === 0) {
    throw new Error(`Recipe ${rec.id}: crafting_shapeless must have at least one ingredient.`);
  }
  return JSON.stringify(
    {
      type: "minecraft:crafting_shapeless",
      ingredients,
      result: {
        id: resolveResultId(modId, rec.result.id),
        count: rec.result.count ?? 1,
      },
    },
    null,
    2
  );
}

/** Crafting shaped from spec: pattern + key; result { id, count }. MC 1.21.1. */
function craftingShapedFromSpec(modId: string, rec: ModRecipe): string {
  const pattern = rec.pattern ?? [];
  const key = rec.key ?? {};
  if (pattern.length === 0 || Object.keys(key).length === 0) {
    throw new Error(`Recipe ${rec.id}: crafting_shaped must have pattern and key.`);
  }
  const keyOut: Record<string, { item: string }> = {};
  for (const [chr, val] of Object.entries(key)) {
    if (val?.id) keyOut[chr] = { item: resolveIngredientId(modId, val.id) };
  }
  return JSON.stringify(
    {
      type: "minecraft:crafting_shaped",
      pattern,
      key: keyOut,
      result: {
        id: resolveResultId(modId, rec.result.id),
        count: rec.result.count ?? 1,
      },
    },
    null,
    2
  );
}

/** Smelting from spec. MC 1.21.1: result is item stack { id, count }. */
function smeltingFromSpec(modId: string, rec: ModRecipe): string {
  const ing = rec.ingredients?.[0];
  if (!ing?.id) {
    throw new Error(`Recipe ${rec.id}: smelting must have at least one ingredient.`);
  }
  if (ing.id === rec.result.id) {
    throw new Error(`Recipe ${rec.id}: smelting ingredient must not equal result (no self-loop).`);
  }
  const experience = rec.experience ?? 0.35;
  const cookingtime = rec.cookingtime ?? 200;
  return JSON.stringify(
    {
      type: "minecraft:smelting",
      ingredient: { item: resolveIngredientId(modId, ing.id) },
      result: { id: resolveResultId(modId, rec.result.id), count: rec.result.count ?? 1 },
      experience,
      cookingtime,
    },
    null,
    2
  );
}

/** Blasting from spec. MC 1.21.1: result { id, count }. No self-loop. */
function blastingFromSpec(modId: string, rec: ModRecipe): string {
  const ing = rec.ingredients?.[0];
  if (!ing?.id) throw new Error(`Recipe ${rec.id}: blasting must have at least one ingredient.`);
  if (ing.id === rec.result.id) throw new Error(`Recipe ${rec.id}: blasting self-loop.`);
  const experience = rec.experience ?? 0.35;
  const cookingtime = rec.cookingtime ?? 100;
  return JSON.stringify(
    { type: "minecraft:blasting", ingredient: { item: resolveIngredientId(modId, ing.id) }, result: { id: resolveResultId(modId, rec.result.id), count: rec.result.count ?? 1 }, experience, cookingtime },
    null,
    2
  );
}

/** Smoking from spec. MC 1.21.1: result { id, count }. */
function smokingFromSpec(modId: string, rec: ModRecipe): string {
  const ing = rec.ingredients?.[0];
  if (!ing?.id) throw new Error(`Recipe ${rec.id}: smoking must have at least one ingredient.`);
  if (ing.id === rec.result.id) throw new Error(`Recipe ${rec.id}: smoking self-loop.`);
  const experience = rec.experience ?? 0.35;
  const cookingtime = rec.cookingtime ?? 100;
  return JSON.stringify(
    { type: "minecraft:smoking", ingredient: { item: resolveIngredientId(modId, ing.id) }, result: { id: resolveResultId(modId, rec.result.id), count: rec.result.count ?? 1 }, experience, cookingtime },
    null,
    2
  );
}

/** Campfire cooking from spec. MC 1.21.1: result { id, count }. */
function campfireCookingFromSpec(modId: string, rec: ModRecipe): string {
  const ing = rec.ingredients?.[0];
  if (!ing?.id) throw new Error(`Recipe ${rec.id}: campfire_cooking must have at least one ingredient.`);
  if (ing.id === rec.result.id) throw new Error(`Recipe ${rec.id}: campfire_cooking self-loop.`);
  const experience = rec.experience ?? 0.35;
  const cookingtime = rec.cookingtime ?? 600;
  return JSON.stringify(
    { type: "minecraft:campfire_cooking", ingredient: { item: resolveIngredientId(modId, ing.id) }, result: { id: resolveResultId(modId, rec.result.id), count: rec.result.count ?? 1 }, experience, cookingtime },
    null,
    2
  );
}

/**
 * Emit recipe JSON files under data/<modId>/recipe/ (1.21+ singular) from spec.recipes only.
 * Path: src/main/resources/data/<modId>/recipe/<id>.json. modId must match registration.
 * Supported: crafting_shapeless, crafting_shaped, smelting, blasting, smoking, campfire_cooking.
 */
export function recipeDataFiles(expanded: ExpandedSpecTier1): MaterializedFile[] {
  const modId = expanded.spec.modId;
  const files: MaterializedFile[] = [];
  const base = `${DATA_RECIPES}/${modId}/recipe`;

  for (const rec of expanded.spec.recipes ?? []) {
    const path = `${base}/${rec.id}.json`;
    let contents: string;
    if (rec.type === "crafting_shapeless") {
      contents = craftingShapelessFromSpec(modId, rec);
    } else if (rec.type === "crafting_shaped") {
      contents = craftingShapedFromSpec(modId, rec);
    } else if (rec.type === "smelting") {
      contents = smeltingFromSpec(modId, rec);
    } else if (rec.type === "blasting") {
      contents = blastingFromSpec(modId, rec);
    } else if (rec.type === "smoking") {
      contents = smokingFromSpec(modId, rec);
    } else if (rec.type === "campfire_cooking") {
      contents = campfireCookingFromSpec(modId, rec);
    } else {
      continue;
    }
    files.push({ path, contents });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
