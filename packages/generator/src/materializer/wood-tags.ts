/**
 * Data-pack tag files for generated wood.
 * - Mod namespace: data/<modId>/tags/... (our planks, logs, mineable/axe).
 * - Vanilla merge: data/minecraft/tags/items/planks.json with replace:false to add our
 *   planks to #minecraft:planks so vanilla wooden tools etc. work. Never use replace:true.
 * Path: src/main/resources/data/...
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
/** Planks go in minecraft:planks tag so sticks/crafting table/chest work. */
const PLANKS_SUFFIXES = ["_planks"] as const;

function isWoodBlockId(blockId: string, woodIds: string[]): boolean {
  for (const woodId of woodIds) {
    for (const suffix of WOOD_SUFFIXES) {
      if (blockId === woodId + suffix) return true;
    }
  }
  return false;
}

function isPlanksId(id: string, woodIds: string[]): boolean {
  return woodIds.some((w) => PLANKS_SUFFIXES.some((s) => id === w + s));
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
  const tagBase = `${DATA_BASE}/${modId}/tags`;

  if (planksItems.size > 0) {
    files.push({
      path: `${tagBase}/items/planks.json`,
      contents: JSON.stringify({ replace: false, values: [...planksItems].sort() }, null, 2),
    });
    // Add our planks to #minecraft:planks so vanilla wooden tools work. Merge-safe (replace: false).
    // Runtime: /execute if items entity @s weapon.mainhand #minecraft:planks run say TAG_OK succeeds when holding generated:maple_planks.
    const planksItemIds = [...planksItems].sort();
    files.push({
      path: `${DATA_BASE}/minecraft/tags/items/planks.json`,
      contents: JSON.stringify({ replace: false, values: planksItemIds }, null, 2),
    });
  }
  if (planksBlocks.size > 0) {
    files.push({
      path: `${tagBase}/blocks/planks.json`,
      contents: JSON.stringify({ replace: false, values: [...planksBlocks].sort() }, null, 2),
    });
  }
  if (logItems.size > 0) {
    files.push({
      path: `${tagBase}/items/logs.json`,
      contents: JSON.stringify({ replace: false, values: [...logItems].sort() }, null, 2),
    });
  }
  if (logBlocks.size > 0) {
    files.push({
      path: `${tagBase}/blocks/logs.json`,
      contents: JSON.stringify({ replace: false, values: [...logBlocks].sort() }, null, 2),
    });
    files.push({
      path: `${tagBase}/blocks/logs_that_burn.json`,
      contents: JSON.stringify({ replace: false, values: [...logBlocks].sort() }, null, 2),
    });
  }
  if (mineableAxe.length > 0) {
    files.push({
      path: `${tagBase}/blocks/mineable/axe.json`,
      contents: JSON.stringify({ replace: false, values: mineableAxe }, null, 2),
    });
    // Additive merge into data/minecraft so mining speed + tool (axe) work correctly
    files.push({
      path: `${DATA_BASE}/minecraft/tags/blocks/mineable/axe.json`,
      contents: JSON.stringify({ replace: false, values: mineableAxe }, null, 2),
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
