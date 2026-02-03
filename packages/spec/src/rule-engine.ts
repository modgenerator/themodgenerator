/**
 * RuleEngine — deterministic expansion of ModSpecV2.
 * - Ore material → gem/raw item, ore block, smelting/blasting, 9↔storage_block.
 * - Food/cosmetic blocks → palette/texture rules, ensure at least one recipe.
 * No LLM; same input → same output.
 */

import type {
  ModSpecV2,
  ModSpecV2Material,
  ModSpecV2Block,
  ModSpecV2Item,
  ModSpecV2Recipe,
  ModSpecV2Worldgen,
  ModSpecV2Tag,
} from "./modspec-v2.js";

export interface ExpandedModSpecV2 extends ModSpecV2 {
  materials: ModSpecV2Material[];
  blocks: ModSpecV2Block[];
  worldgen: ModSpecV2Worldgen[];
  items: ModSpecV2Item[];
  recipes: ModSpecV2Recipe[];
  tags: ModSpecV2Tag[];
}

function hasId<T extends { id: string }>(arr: T[] | undefined, id: string): boolean {
  return (arr ?? []).some((x) => x.id === id);
}

/** Expand ore material: gem, raw, ore block, storage block, smelting, blasting, 9↔block. */
function expandOreMaterial(
  _ns: string,
  materialId: string,
  existingBlocks: ModSpecV2Block[],
  existingItems: ModSpecV2Item[],
  existingRecipes: ModSpecV2Recipe[],
  existingWorldgen: ModSpecV2Worldgen[]
): {
  blocks: ModSpecV2Block[];
  items: ModSpecV2Item[];
  recipes: ModSpecV2Recipe[];
  worldgen: ModSpecV2Worldgen[];
} {
  const blocks: ModSpecV2Block[] = [];
  const items: ModSpecV2Item[] = [];
  const recipes: ModSpecV2Recipe[] = [];
  const worldgen: ModSpecV2Worldgen[] = [];

  const gemId = materialId;
  const rawId = `raw_${materialId}`;
  const oreBlockId = `${materialId}_ore`;
  const storageBlockId = `${materialId}_block`;

  if (!hasId(existingItems, gemId)) {
    items.push({
      id: gemId,
      kind: "gem",
      materialRef: materialId,
    });
  }
  if (!hasId(existingItems, rawId)) {
    items.push({
      id: rawId,
      kind: "raw",
      materialRef: materialId,
    });
  }
  if (!hasId(existingBlocks, oreBlockId)) {
    blocks.push({
      id: oreBlockId,
      kind: "ore",
      textureSpec: { base: "gem", palette: ["stone"] },
      miningSpec: { toolTag: "pickaxe", requiredLevel: 1, hardness: 3 },
      dropsSpec: { itemId: rawId, countMin: 1, countMax: 1, fortuneMultiplier: 1 },
      materialRef: materialId,
    });
  }
  if (!hasId(existingBlocks, storageBlockId)) {
    blocks.push({
      id: storageBlockId,
      kind: "basic",
      textureSpec: { base: "metal", palette: [materialId] },
      miningSpec: { toolTag: "pickaxe", requiredLevel: 0, hardness: 5 },
      dropsSpec: { itemId: storageBlockId, countMin: 1, countMax: 1 },
      materialRef: materialId,
    });
  }

  const rawExists = hasId(existingItems, rawId) || items.some((i) => i.id === rawId);
  if (rawExists && !existingRecipes.some((r) => r.id === `smelt_${rawId}_to_${gemId}`)) {
    recipes.push({
      id: `smelt_${rawId}_to_${gemId}`,
      type: "smelting",
      inputs: [{ id: rawId, count: 1 }],
      result: { id: gemId, count: 1 },
      experience: 0.7,
    });
  }
  if (rawExists && !existingRecipes.some((r) => r.id === `blast_${rawId}_to_${gemId}`)) {
    recipes.push({
      id: `blast_${rawId}_to_${gemId}`,
      type: "blasting",
      inputs: [{ id: rawId, count: 1 }],
      result: { id: gemId, count: 1 },
      experience: 0.7,
    });
  }

  const gemExists = hasId(existingItems, gemId) || items.some((i) => i.id === gemId);
  const storageExists = hasId(existingBlocks, storageBlockId) || blocks.some((b) => b.id === storageBlockId);
  if (gemExists && storageExists) {
    if (!existingRecipes.some((r) => r.id === `compress_${gemId}_to_${storageBlockId}`)) {
      recipes.push({
        id: `compress_${gemId}_to_${storageBlockId}`,
        type: "crafting_shapeless",
        inputs: Array(9).fill({ id: gemId, count: 1 }),
        result: { id: storageBlockId, count: 1 },
      });
    }
    if (!existingRecipes.some((r) => r.id === `decompress_${storageBlockId}_to_${gemId}`)) {
      recipes.push({
        id: `decompress_${storageBlockId}_to_${gemId}`,
        type: "crafting_shapeless",
        inputs: [{ id: storageBlockId, count: 1 }],
        result: { id: gemId, count: 9 },
      });
    }
  }

  const oreExists = hasId(existingBlocks, oreBlockId) || blocks.some((b) => b.id === oreBlockId);
  if (oreExists && !existingWorldgen.some((w) => w.oreBlockId === oreBlockId)) {
    worldgen.push({
      oreBlockId,
      minY: -64,
      maxY: 64,
      veinSize: 4,
      veinsPerChunk: 2,
      biomeTags: ["minecraft:is_overworld"],
      rarityNotes: "default overworld ore",
    });
  }

  return { blocks, items, recipes, worldgen };
}

/** Enforce food block: texture category food; palette/yellow-ish enforced by validator. */
function enforceFoodBlockTexture(block: ModSpecV2Block): ModSpecV2Block {
  if (block.textureSpec?.base === "food") return block;
  return {
    ...block,
    textureSpec: { ...block.textureSpec, base: "food" as const },
  };
}

/**
 * Run RuleEngine on ModSpecV2. Returns expanded spec with all implied materials, blocks, items, recipes, worldgen, tags.
 */
export function expandModSpecV2(spec: ModSpecV2): ExpandedModSpecV2 {
  const materials = [...(spec.materials ?? [])];
  let blocks = [...(spec.blocks ?? [])];
  let items = [...(spec.items ?? [])];
  let recipes = [...(spec.recipes ?? [])];
  let worldgen = [...(spec.worldgen ?? [])];
  let tags = [...(spec.tags ?? [])];

  for (const mat of materials) {
    if (mat.category === "gem") {
      const ore = expandOreMaterial(spec.namespace, mat.id, blocks, items, recipes, worldgen);
      blocks = [...blocks, ...ore.blocks];
      items = [...items, ...ore.items];
      recipes = [...recipes, ...ore.recipes];
      worldgen = [...worldgen, ...ore.worldgen];
    }
  }

  blocks = blocks.map((b) =>
    b.textureSpec?.base === "food" ? enforceFoodBlockTexture(b) : b
  );

  return {
    ...spec,
    materials,
    blocks,
    items,
    recipes,
    worldgen,
    tags,
  };
}
