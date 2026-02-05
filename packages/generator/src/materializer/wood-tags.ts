/**
 * Data-pack tag files so vanilla recipes (sticks, crafting table, etc.) accept generated wood.
 * Adds generated wood blocks/items to minecraft tags: planks, logs, logs_that_burn, mineable/axe.
 * Path: src/main/resources/data/minecraft/tags/...
 * Use "replace": false so our values merge with vanilla.
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";

const DATA_BASE = "src/main/resources/data";

/** Wood family block/item id suffixes (must match expand-wood-type.ts). */
const WOOD_SUFFIXES = [
  "_log",
  "_stripped_log",
  "_wood",
  "_stripped_wood",
  "_planks",
  "_stairs",
  "_slab",
  "_fence",
  "_fence_gate",
  "_door",
  "_trapdoor",
  "_pressure_plate",
  "_button",
  "_sign",
  "_hanging_sign",
] as const;

const LOG_SUFFIXES = ["_log", "_stripped_log", "_wood", "_stripped_wood"] as const;
const PLANKS_SUFFIX = "_planks";

function isWoodBlockId(blockId: string, woodIds: string[]): boolean {
  for (const woodId of woodIds) {
    for (const suffix of WOOD_SUFFIXES) {
      if (blockId === woodId + suffix) return true;
    }
  }
  return false;
}

function isPlanksId(id: string, woodIds: string[]): boolean {
  return woodIds.some((w) => id === w + PLANKS_SUFFIX);
}

function isLogId(id: string, woodIds: string[]): boolean {
  return woodIds.some((w) => LOG_SUFFIXES.some((s) => id === w + s));
}

/**
 * Emit tag JSON files that add generated wood to vanilla tags.
 * Only runs when spec has woodTypes; otherwise returns [].
 */
export function woodTagDataFiles(expanded: ExpandedSpecTier1): MaterializedFile[] {
  const woodTypes = expanded.spec.woodTypes ?? [];
  if (woodTypes.length === 0) return [];

  const modId = expanded.spec.modId;
  const woodIds = woodTypes.map((w) => w.id);

  const planksItems = new Set<string>();
  const planksBlocks = new Set<string>();
  const logItems = new Set<string>();
  const logBlocks = new Set<string>();
  const mineableAxe: string[] = [];

  for (const block of expanded.blocks) {
    if (!isWoodBlockId(block.id, woodIds)) continue;
    const ref = `${modId}:${block.id}`;
    if (isPlanksId(block.id, woodIds)) {
      planksItems.add(ref);
      planksBlocks.add(ref);
    }
    if (isLogId(block.id, woodIds)) {
      logItems.add(ref);
      logBlocks.add(ref);
    }
    mineableAxe.push(ref);
  }

  for (const item of expanded.items) {
    if (isPlanksId(item.id, woodIds)) planksItems.add(`${modId}:${item.id}`);
    if (isLogId(item.id, woodIds)) logItems.add(`${modId}:${item.id}`);
  }

  const files: MaterializedFile[] = [];

  if (planksItems.size > 0) {
    files.push({
      path: `${DATA_BASE}/minecraft/tags/items/planks.json`,
      contents: JSON.stringify({ replace: false, values: [...planksItems].sort() }, null, 2),
    });
  }
  if (planksBlocks.size > 0) {
    files.push({
      path: `${DATA_BASE}/minecraft/tags/blocks/planks.json`,
      contents: JSON.stringify({ replace: false, values: [...planksBlocks].sort() }, null, 2),
    });
  }
  if (logItems.size > 0) {
    files.push({
      path: `${DATA_BASE}/minecraft/tags/items/logs.json`,
      contents: JSON.stringify({ replace: false, values: [...logItems].sort() }, null, 2),
    });
  }
  if (logBlocks.size > 0) {
    files.push({
      path: `${DATA_BASE}/minecraft/tags/blocks/logs.json`,
      contents: JSON.stringify({ replace: false, values: [...logBlocks].sort() }, null, 2),
    });
    files.push({
      path: `${DATA_BASE}/minecraft/tags/blocks/logs_that_burn.json`,
      contents: JSON.stringify({ replace: false, values: [...logBlocks].sort() }, null, 2),
    });
  }
  if (mineableAxe.length > 0) {
    files.push({
      path: `${DATA_BASE}/minecraft/tags/blocks/mineable/axe.json`,
      contents: JSON.stringify({ replace: false, values: mineableAxe }, null, 2),
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
