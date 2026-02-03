/**
 * Adapter: ExpandedModSpecV2 → ModSpecV1 for existing pipeline (expandSpecTier1 → materialize).
 * Minimal mapping so current compiler/materializer can consume V2 spec.
 */

import type { ModSpecV1, ModItem, ModBlock, ModOre, ModRecipe } from "./types.js";
import { SUPPORTED_MINECRAFT_VERSION, SUPPORTED_LOADER } from "./types.js";
import type { ExpandedModSpecV2 } from "./rule-engine.js";

export function expandedModSpecV2ToV1(expanded: ExpandedModSpecV2): ModSpecV1 {
  const features: ModSpecV1["features"] = ["hello-world"];
  if ((expanded.blocks ?? []).some((b) => b.kind === "ore")) features.push("ore");
  if ((expanded.items ?? []).some((i) => i.kind === "ingot" || i.kind === "gem")) features.push("ingot");

  const items: ModItem[] = (expanded.items ?? []).map((i) => ({
    id: i.id,
    name: i.name ?? i.id.replace(/_/g, " "),
  }));

  const blocks: ModBlock[] = (expanded.blocks ?? []).map((b) => ({
    id: b.id,
    name: b.name ?? b.id.replace(/_/g, " "),
  }));

  const ores: ModOre[] = (expanded.blocks ?? [])
    .filter((b) => b.kind === "ore")
    .map((b) => ({
      id: b.id,
      blockId: b.id,
    }));

  const recipes: ModRecipe[] = (expanded.recipes ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    result: { id: r.result.id, count: r.result.count ?? 1 },
  }));

  return {
    schemaVersion: 1,
    minecraftVersion: SUPPORTED_MINECRAFT_VERSION,
    loader: SUPPORTED_LOADER,
    modId: "generated",
    modName: expanded.modName,
    features,
    items,
    blocks,
    ores: ores.length > 0 ? ores : undefined,
    recipes: recipes.length > 0 ? recipes : undefined,
  };
}
