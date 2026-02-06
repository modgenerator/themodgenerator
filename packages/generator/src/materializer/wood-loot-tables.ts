/**
 * Loot tables for wood-family blocks so they drop themselves in survival.
 * Path: src/main/resources/data/<modId>/loot_tables/blocks/<block_id>.json
 * MC 1.21: type "minecraft:block", one pool, one entry type "minecraft:item" with name.
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";
import { isWoodBlock } from "./vanilla-wood-family.js";

const DATA_BASE = "src/main/resources/data";

/** One pool, one entry: drop self. */
function dropSelfLootTable(modId: string, blockId: string): string {
  return JSON.stringify(
    {
      type: "minecraft:block",
      pools: [
        {
          rolls: 1,
          entries: [{ type: "minecraft:item", name: `${modId}:${blockId}` }],
        },
      ],
    },
    null,
    2
  );
}

/** Slab: drop 1 for single (bottom/top), 2 for double. Block state property "type". */
function slabLootTable(modId: string, blockId: string): string {
  const blockRef = `${modId}:${blockId}`;
  return JSON.stringify(
    {
      type: "minecraft:block",
      pools: [
        {
          rolls: 1,
          entries: [
            {
              type: "minecraft:item",
              name: blockRef,
              conditions: [
                {
                  condition: "minecraft:block_state_property",
                  block: blockRef,
                  properties: { type: "bottom" },
                },
              ],
            },
            {
              type: "minecraft:item",
              name: blockRef,
              conditions: [
                {
                  condition: "minecraft:block_state_property",
                  block: blockRef,
                  properties: { type: "top" },
                },
              ],
            },
            {
              type: "minecraft:item",
              name: blockRef,
              count: 2,
              conditions: [
                {
                  condition: "minecraft:block_state_property",
                  block: blockRef,
                  properties: { type: "double" },
                },
              ],
            },
          ],
        },
      ],
    },
    null,
    2
  );
}

/**
 * Emit loot table JSON for every wood-family block so survival break drops the block.
 * Only runs when spec has woodTypes; otherwise returns [].
 */
export function woodLootTableFiles(expanded: ExpandedSpecTier1): MaterializedFile[] {
  const woodTypes = expanded.spec.woodTypes ?? [];
  if (woodTypes.length === 0) return [];

  const modId = expanded.spec.modId;
  const woodIds = woodTypes.map((w) => w.id);

  const files: MaterializedFile[] = [];
  for (const block of expanded.blocks) {
    if (!isWoodBlock(block.id, woodIds)) continue;
    const isSlab = woodIds.some((w) => block.id === w + "_slab");
    const contents = isSlab ? slabLootTable(modId, block.id) : dropSelfLootTable(modId, block.id);
    files.push({
      path: `${DATA_BASE}/${modId}/loot_tables/blocks/${block.id}.json`,
      contents,
    });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
