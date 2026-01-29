/**
 * Visual Fidelity Pipeline — Phase 3.
 * Texture recipes are instructional, not generative. No pixels generated here.
 * Human-readable, stable descriptions. Deterministic.
 */

import type { VisualBlueprint } from "./visual-blueprints.js";
import type { VisualLevel } from "./visual-levels.js";
import { getVisualLevelDefinition } from "./visual-levels.js";

export type LayerType = "base" | "overlay" | "emissive";

export interface TextureRecipeLayer {
  type: LayerType;
  description: string;
}

export interface TextureRecipe {
  resolution: number;
  layers: TextureRecipeLayer[];
}

/**
 * Derive a texture recipe from a visual blueprint and visual level.
 * Base layer always exists. Overlay only if visualLevel.allowsLayeredOverlays.
 * Emissive only if visualLevel.allowsEmissive.
 * Deterministic; same blueprint + level → same recipe.
 */
export function recipeFromBlueprint(
  blueprint: VisualBlueprint,
  visualLevel: VisualLevel
): TextureRecipe {
  const def = getVisualLevelDefinition(visualLevel);
  const layers: TextureRecipeLayer[] = [];

  const baseDescription = describeBaseLayer(blueprint);
  layers.push({ type: "base", description: baseDescription });

  if (def.allowsLayeredOverlays && blueprint.overlayMotifs && blueprint.overlayMotifs.length > 0) {
    const overlayDescription = describeOverlayLayer(blueprint);
    layers.push({ type: "overlay", description: overlayDescription });
  }

  if (def.allowsEmissive && blueprint.emissiveZones && blueprint.emissiveZones.length > 0) {
    const emissiveDescription = describeEmissiveLayer(blueprint);
    layers.push({ type: "emissive", description: emissiveDescription });
  }

  return {
    resolution: def.textureResolution,
    layers,
  };
}

function describeBaseLayer(blueprint: VisualBlueprint): string {
  const shape = blueprint.baseShape;
  const finish = blueprint.materialFinish;
  const colors = blueprint.colorPalette.slice(0, 3).join(", ");
  return `${shape} shape, ${finish} finish, palette: ${colors}`;
}

function describeOverlayLayer(blueprint: VisualBlueprint): string {
  const motifs = (blueprint.overlayMotifs ?? []).join(" and ");
  return `layered overlay: ${motifs}`;
}

function describeEmissiveLayer(blueprint: VisualBlueprint): string {
  const zones = (blueprint.emissiveZones ?? []).join(", ");
  return `emissive zones: ${zones}`;
}
