/**
 * Generate data/<modId>/recipes/*.json from spec only.
 * No keyword or id-based branches; all recipes come from expanded.spec.recipes[].
 * Minecraft 1.21.1: crafting_shapeless, smelting, blasting.
 */

import type { ExpandedSpecTier1, ModRecipe } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";

const DATA_RECIPES = "src/main/resources/data";

/** Crafting shapeless from spec: ingredients[] and result (1.21 format). */
function craftingShapelessFromSpec(modId: string, rec: ModRecipe): string {
  const ingredients = (rec.ingredients ?? []).flatMap((ing) =>
    Array(ing.count ?? 1).fill(null).map(() => ({ item: `${modId}:${ing.id}` }))
  );
  return JSON.stringify(
    {
      type: "minecraft:crafting_shapeless",
      ingredients,
      result: {
        id: `${modId}:${rec.result.id}`,
        count: rec.result.count ?? 1,
      },
    },
    null,
    2
  );
}

/** Smelting from spec: first ingredient -> result (1.21 format). */
function smeltingFromSpec(modId: string, rec: ModRecipe): string {
  const ing = rec.ingredients?.[0];
  const ingredientId = ing?.id ?? rec.result.id;
  return JSON.stringify(
    {
      type: "minecraft:smelting",
      ingredient: { item: `${modId}:${ingredientId}` },
      result: {
        id: `${modId}:${rec.result.id}`,
        count: rec.result.count ?? 1,
      },
      experience: 0.35,
      cookingtime: 200,
    },
    null,
    2
  );
}

/** Blasting from spec (1.21 format). */
function blastingFromSpec(modId: string, rec: ModRecipe): string {
  const ing = rec.ingredients?.[0];
  const ingredientId = ing?.id ?? rec.result.id;
  return JSON.stringify(
    {
      type: "minecraft:blasting",
      ingredient: { item: `${modId}:${ingredientId}` },
      result: {
        id: `${modId}:${rec.result.id}`,
        count: rec.result.count ?? 1,
      },
      experience: 0.35,
      cookingtime: 100,
    },
    null,
    2
  );
}

/**
 * Emit recipe JSON files under data/<modId>/recipes/ from spec.recipes only.
 * Supported types: crafting_shapeless, smelting, blasting.
 * No placeholder recipes; if spec has no recipes, returns [].
 */
export function recipeDataFiles(expanded: ExpandedSpecTier1): MaterializedFile[] {
  const modId = expanded.spec.modId;
  const files: MaterializedFile[] = [];
  const base = `${DATA_RECIPES}/${modId}/recipes`;

  for (const rec of expanded.spec.recipes ?? []) {
    const path = `${base}/${rec.id}.json`;
    let contents: string;
    if (rec.type === "crafting_shapeless") {
      contents = craftingShapelessFromSpec(modId, rec);
    } else if (rec.type === "smelting") {
      contents = smeltingFromSpec(modId, rec);
    } else if (rec.type === "blasting") {
      contents = blastingFromSpec(modId, rec);
    } else {
      continue;
    }
    files.push({ path, contents });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
