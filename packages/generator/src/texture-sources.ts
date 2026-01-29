/**
 * Visual Fidelity Pipeline — Phase 4.
 * Texture source selection. Priority: user-provided (future) → curated pack → procedural fallback.
 * Same recipe → same chosen source. No random or abstract textures. Deterministic.
 */

import type { TextureRecipe } from "./texture-recipe.js";
import type { VisualLevel } from "./visual-levels.js";

export type TextureSourceKind = "user_provided" | "curated" | "procedural_fallback";

export interface TextureSourceResult {
  kind: TextureSourceKind;
  /** Cacheable key for curated or procedural (same recipe → same key). */
  sourceKey: string;
  /** Human-readable label for frontend. */
  label: string;
}

/**
 * Select texture source for a recipe and visual level.
 * 1. User-provided asset (future: when present, return user_provided).
 * 2. Curated internal texture pack (human-made, indexed by deterministic key).
 * 3. Procedural fallback (simple gradient/noise; respects recipe description).
 * Same recipe + level → same sourceKey. No randomness.
 */
export function selectTextureSource(
  recipe: TextureRecipe,
  visualLevel: VisualLevel,
  _userProvidedKey?: string | null
): TextureSourceResult {
  if (_userProvidedKey != null && _userProvidedKey.length > 0) {
    return {
      kind: "user_provided",
      sourceKey: _userProvidedKey,
      label: "User texture",
    };
  }

  const curatedKey = getCuratedSourceKey(recipe, visualLevel);
  if (curatedKey !== null) {
    return {
      kind: "curated",
      sourceKey: curatedKey,
      label: "Curated pack: " + curatedKey,
    };
  }

  const proceduralKey = getProceduralFallbackKey(recipe);
  return {
    kind: "procedural_fallback",
    sourceKey: proceduralKey,
    label: "Procedural: " + (recipe.layers[0]?.description ?? "base"),
  };
}

/**
 * Deterministic key into curated pack. When we have a curated pack, index by
 * resolution + level + layer structure. Returns null when no curated asset exists (use procedural).
 * Currently no curated pack is populated; always returns null so procedural fallback is used.
 */
function getCuratedSourceKey(_recipe: TextureRecipe, _visualLevel: VisualLevel): string | null {
  return null;
}

/**
 * Procedural fallback key. Deterministic from recipe; procedural generator
 * (elsewhere) will use this key to produce a simple gradient/noise that
 * respects the recipe description. No random pixels here.
 */
function getProceduralFallbackKey(recipe: TextureRecipe): string {
  const parts: string[] = [
    "proc",
    String(recipe.resolution),
    recipe.layers.map((l) => l.type + ":" + l.description.slice(0, 32)).join("_"),
  ];
  return parts.join("_").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
}
