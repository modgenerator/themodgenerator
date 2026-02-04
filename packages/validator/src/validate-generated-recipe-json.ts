/**
 * Post-materialize validation: parsed recipe JSON files must match Minecraft 1.21.1 schema.
 * Fail fast if Minecraft would ignore a recipe.
 * - crafting_shapeless / crafting_shaped: result MUST be { item: "modid:id", count: N }
 * - cooking (smelting, blasting, smoking, campfire_cooking): result MUST be string "modid:id"
 * - ingredients non-empty where required; referenced ids in spec; no self-loop.
 */

import type { ModSpecV1 } from "@themodgenerator/spec";

export interface ValidateGeneratedRecipeJsonResult {
  valid: boolean;
  errors: string[];
}

function specIds(spec: ModSpecV1): Set<string> {
  const set = new Set<string>();
  for (const i of spec.items ?? []) set.add(i.id);
  for (const b of spec.blocks ?? []) set.add(b.id);
  return set;
}

function parseIdFromItemString(itemStr: string): string | null {
  const m = /^[a-z0-9_]+:([a-z0-9_]+)$/.exec(itemStr);
  return m ? m[1] : null;
}

/**
 * Validate one parsed recipe JSON object. type is e.g. "minecraft:crafting_shapeless".
 */
function validateOneRecipe(
  modId: string,
  recipeId: string,
  data: Record<string, unknown>,
  ids: Set<string>
): string[] {
  const errors: string[] = [];
  const type = data.type as string | undefined;
  if (!type || typeof type !== "string") {
    errors.push(`Recipe ${recipeId}: missing or invalid "type".`);
    return errors;
  }

  if (type === "minecraft:crafting_shapeless" || type === "minecraft:crafting_shaped") {
    const result = data.result;
    if (result == null || typeof result !== "object" || Array.isArray(result)) {
      errors.push(`Recipe ${recipeId}: crafting result must be an object.`);
      return errors;
    }
    const robj = result as Record<string, unknown>;
    if (typeof robj.item !== "string" || !robj.item) {
      errors.push(`Recipe ${recipeId}: crafting result must have "item" string (got result.id or missing).`);
    } else {
      const id = parseIdFromItemString(robj.item);
      if (id && !ids.has(id)) {
        errors.push(`Recipe ${recipeId}: result item "${robj.item}" is not in spec.`);
      }
    }
    if (robj.count != null && typeof robj.count !== "number") {
      errors.push(`Recipe ${recipeId}: result count must be a number.`);
    }
    const ingredients = data.ingredients ?? data.ingredient;
    const arr = Array.isArray(ingredients) ? ingredients : ingredients != null ? [ingredients] : [];
    if (arr.length === 0) {
      errors.push(`Recipe ${recipeId}: crafting must have at least one ingredient.`);
    }
    for (const ing of arr) {
      const item = (ing as Record<string, unknown>)?.item;
      if (typeof item === "string") {
        const id = parseIdFromItemString(item);
        if (id && !ids.has(id)) {
          errors.push(`Recipe ${recipeId}: ingredient "${item}" is not in spec.`);
        }
        if (id && robj.item && parseIdFromItemString(robj.item as string) === id) {
          errors.push(`Recipe ${recipeId}: self-loop (ingredient equals result).`);
        }
      }
    }
    return errors;
  }

  if (
    type === "minecraft:smelting" ||
    type === "minecraft:blasting" ||
    type === "minecraft:smoking" ||
    type === "minecraft:campfire_cooking"
  ) {
    const result = data.result;
    if (typeof result !== "string" || !result) {
      errors.push(`Recipe ${recipeId}: cooking result must be a string "modid:id" (not an object).`);
    } else {
      const id = parseIdFromItemString(result);
      if (id && !ids.has(id)) {
        errors.push(`Recipe ${recipeId}: result "${result}" is not in spec.`);
      }
    }
    const ing = (data.ingredient as Record<string, unknown>) ?? data.ingredients?.[0];
    const item = (ing as Record<string, unknown>)?.item;
    if (typeof item !== "string" || !item) {
      errors.push(`Recipe ${recipeId}: cooking must have one ingredient with "item" string.`);
    } else {
      const id = parseIdFromItemString(item);
      if (id && !ids.has(id)) {
        errors.push(`Recipe ${recipeId}: ingredient "${item}" is not in spec.`);
      }
      if (typeof data.result === "string" && id && parseIdFromItemString(data.result) === id) {
        errors.push(`Recipe ${recipeId}: self-loop (ingredient equals result).`);
      }
    }
    return errors;
  }

  return errors;
}

/**
 * Validate a map of recipe file path -> parsed JSON.
 * spec is the ModSpecV1 used to generate the recipes (for id registry).
 */
export function validateGeneratedRecipeJson(
  spec: ModSpecV1,
  recipesByPath: Map<string, unknown>
): ValidateGeneratedRecipeJsonResult {
  const errors: string[] = [];
  const modId = spec.modId ?? "generated";
  const ids = specIds(spec);

  for (const [path, raw] of recipesByPath) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`${path}: invalid JSON or not an object.`);
      continue;
    }
    const data = raw as Record<string, unknown>;
    const recipeId = path.replace(/^.*\//, "").replace(/\.json$/, "");
    const one = validateOneRecipe(modId, recipeId, data, ids);
    errors.push(...one.map((e) => `${path}: ${e}`));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
