/**
 * Visual Fidelity Pipeline — Phase 5 integration.
 * Enriches texture MaterializedFiles with visual metadata (blueprint, recipe, source).
 * Paths and keys unchanged. Deterministic.
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";
import type { VisualLevel } from "../visual-levels.js";
import { resolveVisualBlueprint } from "../visual-blueprints.js";
import { recipeFromBlueprint } from "../texture-recipe.js";
import { selectTextureSource } from "../texture-sources.js";
import type { ArchetypeId } from "../canonical-interpretation.js";

const TEXTURES_ITEM = "/textures/item/";
const TEXTURES_BLOCK = "/textures/block/";

function parseTexturePath(path: string): { contentId: string; category: "item" | "block" } | null {
  if (path.includes(TEXTURES_ITEM)) {
    const suffix = path.split(TEXTURES_ITEM)[1];
    const contentId = suffix?.replace(/\.png$/, "") ?? "";
    return contentId ? { contentId, category: "item" } : null;
  }
  if (path.includes(TEXTURES_BLOCK)) {
    const suffix = path.split(TEXTURES_BLOCK)[1];
    const contentId = suffix?.replace(/\.png$/, "") ?? "";
    return contentId ? { contentId, category: "block" } : null;
  }
  return null;
}

function nameForId(expanded: ExpandedSpecTier1, id: string, category: "item" | "block"): string {
  if (category === "item") {
    const item = expanded.items.find((i) => i.id === id);
    return item?.name ?? id;
  }
  const block = expanded.blocks.find((b) => b.id === id);
  return block?.name ?? id;
}

function blueprintSummary(blueprint: { baseShape: string; materialFinish: string; colorPalette: string[] }): string {
  const colors = blueprint.colorPalette.slice(0, 2).join(", ");
  return `${blueprint.baseShape} ${blueprint.materialFinish} (${colors})`;
}

function visualFeaturesFromLevel(visualLevel: VisualLevel): string[] {
  const features: string[] = [];
  if (visualLevel === "enhanced" || visualLevel === "advanced" || visualLevel === "legendary") features.push("emissive");
  if (visualLevel === "advanced" || visualLevel === "legendary") {
    features.push("glow");
    features.push("layered");
  }
  return features;
}

/**
 * Enrich texture files with visual metadata. Only touches .png texture files.
 * Same expanded + visualLevel → same metadata. Paths unchanged.
 */
export function enrichTextureFilesWithVisualMetadata(
  files: MaterializedFile[],
  expanded: ExpandedSpecTier1,
  visualLevel: VisualLevel
): MaterializedFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".png")) return file;
    const parsed = parseTexturePath(file.path);
    if (!parsed) return file;
    const { contentId, category } = parsed;
    const archetype = (file.archetype ?? "creative_item") as ArchetypeId;
    const intentText = nameForId(expanded, contentId, category);
    const blueprint = resolveVisualBlueprint({
      archetype,
      intentText,
      visualLevel,
      category,
    });
    const recipe = recipeFromBlueprint(blueprint, visualLevel);
    const source = selectTextureSource(recipe, visualLevel);
    const features = visualFeaturesFromLevel(visualLevel);
    return {
      ...file,
      visualLevel,
      blueprintSummary: blueprintSummary(blueprint),
      textureResolution: recipe.resolution,
      textureSourceKey: source.sourceKey,
      visualFeatures: features.length > 0 ? features : undefined,
    };
  });
}
