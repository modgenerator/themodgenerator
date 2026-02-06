/**
 * Build-time validators: fail the build if invariants are violated.
 * These ensure vanillaWoodFamily stays correct and recipes never use #minecraft:planks.
 */

import type { MaterializedFile } from "./types.js";
import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import { isWoodBlock, woodBlocksNeedingMultipartBlockstate } from "./vanilla-wood-family.js";

/** Throws if any recipe file references #minecraft:planks (tag fragility). */
export function validateNoMinecraftPlanksInRecipes(files: MaterializedFile[]): void {
  const recipeFiles = files.filter((f) => f.path.includes("/recipe/") && f.path.endsWith(".json"));
  for (const f of recipeFiles) {
    if (f.contents.includes("#minecraft:planks")) {
      throw new Error(
        `VALIDATOR: Recipe ${f.path} must NOT reference #minecraft:planks. Use generated planks (e.g. maple_planks) directly.`
      );
    }
  }
}

/** Throws if any wood block lacks a loot table (unless whitelisted). */
export function validateWoodBlocksHaveLootTables(
  expanded: ExpandedSpecTier1,
  files: MaterializedFile[],
  whitelistNonDropping: string[] = []
): void {
  const woodIds = (expanded.spec.woodTypes ?? []).map((w) => w.id);
  if (woodIds.length === 0) return;

  const lootBase = `src/main/resources/data/${expanded.spec.modId}/loot_tables/blocks/`;
  for (const block of expanded.blocks) {
    if (!isWoodBlock(block.id, woodIds)) continue;
    if (whitelistNonDropping.includes(block.id)) continue;

    const lootPath = `${lootBase}${block.id}.json`;
    const hasLoot = files.some((f) => f.path === lootPath);
    if (!hasLoot) {
      throw new Error(
        `VALIDATOR: Wood block ${block.id} must have loot table at ${lootPath}. Add to whitelistNonDropping if intentional.`
      );
    }
  }
}

/** Throws if wood types exist but expected recipes (tools, barrel, shield) are missing. */
export function validateWoodRecipeCoverage(expanded: ExpandedSpecTier1, files: MaterializedFile[]): void {
  const woodTypes = expanded.spec.woodTypes ?? [];
  if (woodTypes.length === 0) return;

  const recipeIds = files
    .filter((f) => f.path.includes("/recipe/") && f.path.endsWith(".json"))
    .map((f) => f.path.replace(/^.*\/recipe\//, "").replace(/\.json$/, ""));

  const requiredSuffixes = [
    "wooden_sword_from_",
    "wooden_pickaxe_from_",
    "barrel_from_",
    "bowl_from_",
    "shield_from_",
  ];

  for (const wood of woodTypes) {
    const suffix = `${wood.id}_planks`;
    for (const prefix of requiredSuffixes) {
      const expectedId = `${prefix}${suffix}`;
      const has = recipeIds.some((id) => id === expectedId);
      if (!has) {
        throw new Error(
          `VALIDATOR: Wood type ${wood.id} must have recipe ${expectedId}. Check woodRecipesFromWoodTypes.`
        );
      }
    }
  }
}

/** Logs blocks that need multipart blockstate (door, trapdoor). Does not throw; informational. */
export function getWoodBlocksNeedingMultipartBlockstate(expanded: ExpandedSpecTier1): string[] {
  return woodBlocksNeedingMultipartBlockstate(expanded);
}
