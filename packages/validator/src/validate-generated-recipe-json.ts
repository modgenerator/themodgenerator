/**
 * Post-materialize validation: parsed recipe JSON files must match Minecraft 1.21.1 schema.
 * Fail fast if Minecraft would ignore a recipe.
 * - crafting_shapeless / crafting_shaped: result MUST be { id: "modid:id", count: N }
 * - cooking (smelting, blasting, smoking, campfire_cooking): result MUST be { id: "modid:id", count: N }
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
    const resultItemStr = (robj.id ?? robj.item) as string | undefined;
    if (typeof resultItemStr !== "string" || !resultItemStr) {
      errors.push(`Recipe ${recipeId}: crafting result must have "id" string (MC 1.21.1).`);
    } else {
      const resultId = parseIdFromItemString(resultItemStr);
      if (resultId && !ids.has(resultId)) {
        errors.push(`Recipe ${recipeId}: result "${resultItemStr}" is not in spec.`);
      }
    }
    if (robj.count != null && typeof robj.count !== "number") {
      errors.push(`Recipe ${recipeId}: result count must be a number.`);
    }
    let ingredientItems: string[] = [];
    if (type === "minecraft:crafting_shaped" && data.key && typeof data.key === "object" && !Array.isArray(data.key)) {
      const key = data.key as Record<string, { item?: string }>;
      for (const v of Object.values(key)) {
        if (v?.item && typeof v.item === "string") ingredientItems.push(v.item);
      }
    } else {
      const ingredients = data.ingredients ?? data.ingredient;
      const arr = Array.isArray(ingredients) ? ingredients : ingredients != null ? [ingredients] : [];
      for (const ing of arr) {
        const item = (ing as Record<string, unknown>)?.item;
        if (typeof item === "string") ingredientItems.push(item);
      }
    }
    if (ingredientItems.length === 0) {
      errors.push(`Recipe ${recipeId}: crafting must have at least one ingredient.`);
    }
    for (const item of ingredientItems) {
      const id = parseIdFromItemString(item);
      if (id && !ids.has(id)) {
        errors.push(`Recipe ${recipeId}: ingredient "${item}" is not in spec.`);
      }
      if (id && resultItemStr && parseIdFromItemString(resultItemStr) === id) {
        errors.push(`Recipe ${recipeId}: self-loop (ingredient equals result).`);
      }
    }
    if (type === "minecraft:crafting_shaped" && (!Array.isArray(data.pattern) || data.pattern.length === 0)) {
      errors.push(`Recipe ${recipeId}: crafting_shaped must have non-empty pattern.`);
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
    if (result == null || typeof result !== "object" || Array.isArray(result)) {
      errors.push(`Recipe ${recipeId}: cooking result must be object { id, count } (MC 1.21.1).`);
    } else {
      const robj = result as Record<string, unknown>;
      const resultIdStr = robj.id as string | undefined;
      if (typeof resultIdStr !== "string" || !resultIdStr) {
        errors.push(`Recipe ${recipeId}: cooking result must have "id" string.`);
      } else {
        const id = parseIdFromItemString(resultIdStr);
        if (id && !ids.has(id)) {
          errors.push(`Recipe ${recipeId}: result "${resultIdStr}" is not in spec.`);
        }
      }
    }
    const ingredientRaw = data.ingredient as Record<string, unknown> | undefined;
    const ingredientsArr = data.ingredients;
    const firstIngredient =
      Array.isArray(ingredientsArr) && ingredientsArr.length > 0 ? (ingredientsArr[0] as Record<string, unknown>) : undefined;
    const ing = ingredientRaw ?? firstIngredient;
    const item = ing?.item;
    if (typeof item !== "string" || !item) {
      errors.push(`Recipe ${recipeId}: cooking must have one ingredient with "item" string.`);
    } else {
      const id = parseIdFromItemString(item);
      if (id && !ids.has(id)) {
        errors.push(`Recipe ${recipeId}: ingredient "${item}" is not in spec.`);
      }
      const resultObj = data.result as Record<string, unknown> | undefined;
      const resultIdStr = resultObj?.id;
      if (typeof resultIdStr === "string" && id && parseIdFromItemString(resultIdStr) === id) {
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
  const ids = specIds(spec);

  for (const [path, raw] of recipesByPath) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`${path}: invalid JSON or not an object.`);
      continue;
    }
    const data = raw as Record<string, unknown>;
    const recipeId = path.replace(/^.*\//, "").replace(/\.json$/, "");
    const one = validateOneRecipe(recipeId, data, ids);
    errors.push(...one.map((e) => `${path}: ${e}`));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
