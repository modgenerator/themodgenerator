/**
 * Adapter: ExpandedModSpecV2 → ModSpecV1 for existing pipeline (expandSpecTier1 → materialize).
 * Minimal mapping so current compiler/materializer can consume V2 spec.
 * Attaches textureProfile so texture pipeline validators pass.
 */

import type { ModSpecV1, ModItem, ModBlock, ModOre, ModRecipe, TextureProfile } from "./types.js";
import { SUPPORTED_MINECRAFT_VERSION, SUPPORTED_LOADER } from "./types.js";
import type { ExpandedModSpecV2 } from "./rule-engine.js";

/** Minimal texture profile from display name and intent (V2→V1; materialHint from name). */
function textureProfileFromName(displayName: string, intent: "block" | "item" | "processed"): TextureProfile {
  const materialHint = displayName
    .replace(/\s+Block$/i, "")
    .replace(/\s+Item$/i, "")
    .replace(/^Melted\s+/i, "")
    .trim()
    .toLowerCase() || "custom";
  return {
    intent,
    materialHint,
    physicalTraits: ["textured"],
    surfaceStyle: ["flat"],
  };
}

export function expandedModSpecV2ToV1(expanded: ExpandedModSpecV2): ModSpecV1 {
  const features: ModSpecV1["features"] = ["hello-world"];
  if ((expanded.blocks ?? []).some((b) => b.kind === "ore")) features.push("ore");
  if ((expanded.items ?? []).some((i) => i.kind === "ingot" || i.kind === "gem")) features.push("ingot");

  const items: ModItem[] = (expanded.items ?? []).map((i) => {
    const name = i.name ?? i.id.replace(/_/g, " ");
    return {
      id: i.id,
      name,
      textureIntent: "item" as const,
      textureProfile: textureProfileFromName(name, "item"),
    };
  });

  const blocks: ModBlock[] = (expanded.blocks ?? []).map((b) => {
    const name = b.name ?? b.id.replace(/_/g, " ");
    return {
      id: b.id,
      name,
      textureIntent: "block" as const,
      textureProfile: textureProfileFromName(name, "block"),
    };
  });

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
