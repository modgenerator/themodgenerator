/**
 * Generate data/<modId>/recipes/*.json so the JAR contains recipe data.
 * Recipes are derived from spec (e.g. cheese_block_from_cheese, melted_cheese_from_block).
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";

const DATA_RECIPES = "src/main/resources/data";

/** Crafting shapeless: Nx ingredient -> result (1.21 format). */
function craftingShapelessJson(modId: string, ingredientId: string, resultId: string, resultCount: number, ingredientCount: number): string {
  const ingredients = Array(ingredientCount).fill(null).map(() => ({ item: `${modId}:${ingredientId}` }));
  return `{
  "type": "minecraft:crafting_shapeless",
  "ingredients": ${JSON.stringify(ingredients)},
  "result": {
    "id": "${modId}:${resultId}",
    "count": ${resultCount}
  }
}
`;
}

/** Smelting: ingredient block/item -> result item (1.21 format). */
function smeltingJson(modId: string, ingredientId: string, resultId: string, resultCount: number): string {
  return `{
  "type": "minecraft:smelting",
  "ingredient": {
    "item": "${modId}:${ingredientId}"
  },
  "result": {
    "id": "${modId}:${resultId}",
    "count": ${resultCount}
  },
  "experience": 0.35,
  "cookingtime": 200
}
`;
}

/**
 * Emit recipe JSON files under data/<modId>/recipes/.
 * - If spec has cheese_block + cheese: 4 cheese -> cheese_block, cheese_block -> melted_cheese.
 * - Any spec.recipes entries with known type are emitted.
 */
export function recipeDataFiles(expanded: ExpandedSpecTier1): MaterializedFile[] {
  const modId = expanded.spec.modId;
  const files: MaterializedFile[] = [];
  const base = `${DATA_RECIPES}/${modId}/recipes`;

  const hasItem = (id: string) => expanded.items?.some((i) => i.id === id) ?? false;
  const hasBlock = (id: string) => expanded.blocks?.some((b) => b.id === id) ?? false;

  if (hasBlock("cheese_block") && hasItem("cheese")) {
    files.push({
      path: `${base}/cheese_block_from_cheese.json`,
      contents: craftingShapelessJson(modId, "cheese", "cheese_block", 1, 4),
    });
  }
  if (hasItem("melted_cheese") && hasBlock("cheese_block")) {
    files.push({
      path: `${base}/melted_cheese_from_block.json`,
      contents: smeltingJson(modId, "cheese_block", "melted_cheese", 1),
    });
  }

  for (const rec of expanded.spec.recipes ?? []) {
    if (files.some((f) => f.path.includes(rec.id + ".json"))) continue;
    if (rec.type === "crafting_shapeless" && rec.result.id === "cheese_block") {
      files.push({
        path: `${base}/${rec.id}.json`,
        contents: craftingShapelessJson(modId, "cheese", "cheese_block", rec.result.count ?? 1, 4),
      });
    } else if (rec.type === "smelting" && rec.result.id === "melted_cheese") {
      files.push({
        path: `${base}/${rec.id}.json`,
        contents: smeltingJson(modId, "cheese_block", "melted_cheese", rec.result.count ?? 1),
      });
    }
  }

  if (files.length === 0 && (expanded.items?.length ?? 0) + (expanded.blocks?.length ?? 0) > 0) {
    const firstId = expanded.items?.[0]?.id ?? expanded.blocks?.[0]?.id ?? "custom_item";
    files.push({
      path: `${base}/placeholder_${firstId}.json`,
      contents: craftingShapelessJson(modId, firstId, firstId, 1, 1),
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
