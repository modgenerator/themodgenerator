/**
 * Build-time validators: fail the build if invariants are violated.
 * These ensure vanillaWoodFamily stays correct and recipes never use #minecraft:planks.
 */

import type { MaterializedFile } from "./types.js";
import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import { isWoodBlock, woodBlocksNeedingMultipartBlockstate } from "./vanilla-wood-family.js";

/** Throws if any recipe file is under data/<modid>/recipes/ (plural). MC 1.21.1 requires recipe/ (singular). */
export function validateNoRecipesPluralFolder(files: MaterializedFile[]): void {
  const bad = files.filter((f) => f.path.match(/\/data\/[^/]+\/recipes\//) && f.path.endsWith(".json"));
  if (bad.length > 0) {
    throw new Error(
      `JAR-GATE: Recipe files must be under data/<modid>/recipe/ (singular), not recipes/. Invalid paths: ${bad.map((f) => f.path).join(", ")}`
    );
  }
}

/** Throws if any recipe JSON is invalid or missing required fields (type, result). */
export function validateRecipeJsonSchema(files: MaterializedFile[]): void {
  const recipeFiles = files.filter((f) => f.path.includes("/recipe/") && f.path.endsWith(".json"));
  for (const f of recipeFiles) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(f.contents);
    } catch (e) {
      throw new Error(`JAR-GATE: Recipe ${f.path} invalid JSON: ${e}`);
    }
    const r = parsed as Record<string, unknown>;
    if (typeof r.type !== "string") {
      throw new Error(`JAR-GATE: Recipe ${f.path} must have "type"`);
    }
    if (!("result" in r)) {
      throw new Error(`JAR-GATE: Recipe ${f.path} must have "result"`);
    }
  }
}

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

  const lootBase = `src/main/resources/data/${expanded.spec.modId}/loot_table/blocks/`;
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

/** Expected structure for block loot table (drop-self). Loot table id = <modid>:blocks/<block_id>. */
interface LootTableStructure {
  type: string;
  pools?: Array<{
    rolls?: number;
    entries?: Array<{
      type?: string;
      name?: string;
      count?: number;
      conditions?: unknown[];
    }>;
  }>;
}

/**
 * Throws if any loot table JSON is invalid or doesn't match expected structure.
 * Validates files at data/<modid>/loot_table/blocks/<block_id>.json (MC 1.21.1 singular).
 * Loot table id in-game = <modid>:blocks/<block_id>.
 */
export function validateLootTableJson(files: MaterializedFile[]): void {
  const lootFiles = files.filter(
    (f) => f.path.includes("/loot_table/blocks/") && f.path.endsWith(".json")
  );
  for (const f of lootFiles) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(f.contents);
    } catch (e) {
      throw new Error(`VALIDATOR: Loot table ${f.path} is invalid JSON: ${e}`);
    }
    const lt = parsed as LootTableStructure;
    if (typeof lt.type !== "string" || lt.type !== "minecraft:block") {
      throw new Error(`VALIDATOR: Loot table ${f.path} must have type "minecraft:block"`);
    }
    if (!Array.isArray(lt.pools) || lt.pools.length === 0) {
      throw new Error(`VALIDATOR: Loot table ${f.path} must have at least one pool`);
    }
    const pool = lt.pools[0];
    if (pool.rolls === undefined) {
      throw new Error(`VALIDATOR: Loot table ${f.path} pool must have rolls`);
    }
    if (!Array.isArray(pool.entries) || pool.entries.length === 0) {
      throw new Error(`VALIDATOR: Loot table ${f.path} pool must have at least one entry`);
    }
    const entry = pool.entries[0];
    if (entry.type !== "minecraft:item") {
      throw new Error(`VALIDATOR: Loot table ${f.path} entry must have type "minecraft:item"`);
    }
    if (typeof entry.name !== "string" || !entry.name.includes(":")) {
      throw new Error(`VALIDATOR: Loot table ${f.path} entry must have name "<modid>:<block_id>"`);
    }
  }
}
