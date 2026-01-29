/**
 * Visual Fidelity Pipeline — Phase 2.
 * Visual blueprints describe WHAT something should look like, not HOW it is drawn.
 * Deterministic: same inputs → same blueprint. No randomness.
 */

import type { ArchetypeId } from "./canonical-interpretation.js";
import type { VisualLevel } from "./visual-levels.js";
import { getVisualLevelDefinition } from "./visual-levels.js";

export type BaseShape = "rod" | "cube" | "orb" | "totem" | "device" | "artifact";
export type MaterialFinish = "raw" | "polished" | "etched" | "cracked" | "infused";
export type OverlayMotif = "runes" | "circuits" | "veins" | "glyphs";

export interface VisualBlueprint {
  archetype: ArchetypeId;
  baseShape: BaseShape;
  materialFinish: MaterialFinish;
  colorPalette: string[];
  overlayMotifs?: OverlayMotif[];
  emissiveZones?: string[];
}

export interface ResolveBlueprintInput {
  archetype: ArchetypeId;
  /** Combined name + description for intent (e.g. "magic wand shoots lightning"). */
  intentText: string;
  visualLevel: VisualLevel;
  category: "item" | "block";
}

/**
 * Resolve a visual blueprint from archetype, intent, and visual level.
 * Deterministic. Lightning/magic intent → emissive zones when level allows.
 * Unknown intent → coherent creative blueprint, never generic stick/block.
 */
export function resolveVisualBlueprint(input: ResolveBlueprintInput): VisualBlueprint {
  const { archetype, intentText, visualLevel, category } = input;
  const def = getVisualLevelDefinition(visualLevel);
  const text = intentText.toLowerCase().trim();

  const baseShape = resolveBaseShape(archetype, category);
  const materialFinish = resolveMaterialFinish(archetype, text);
  const colorPalette = resolveColorPalette(archetype, text);
  const overlayMotifs = def.allowsLayeredOverlays ? resolveOverlayMotifs(archetype, text) : undefined;
  const emissiveZones =
    def.allowsEmissive && hasEmissiveIntent(archetype, text) ? resolveEmissiveZones(archetype) : undefined;

  return {
    archetype,
    baseShape,
    materialFinish,
    colorPalette,
    overlayMotifs,
    emissiveZones,
  };
}

function resolveBaseShape(archetype: ArchetypeId, category: "item" | "block"): BaseShape {
  if (category === "block") {
    if (archetype === "crystal_object" || archetype === "mystical_block") return "orb";
    if (archetype === "industrial_block") return "device";
    return "cube";
  }
  if (archetype === "magical_wand" || archetype === "ancient_relic") return "rod";
  if (archetype === "tech_device") return "device";
  if (archetype === "crystal_object") return "orb";
  if (archetype === "corrupted_item") return "artifact";
  return "rod";
}

function resolveMaterialFinish(archetype: ArchetypeId, _text: string): MaterialFinish {
  if (archetype === "corrupted_item") return "cracked";
  if (archetype === "ancient_relic" || archetype === "mystical_block") return "etched";
  if (archetype === "tech_device" || archetype === "industrial_block") return "polished";
  if (archetype === "crystal_object") return "polished";
  if (archetype === "organic_material") return "raw";
  return "polished";
}

function resolveColorPalette(archetype: ArchetypeId, text: string): string[] {
  if (/\blightning\b|\belectric\b|\bblue\b/.test(text)) return ["electric_blue", "white", "cyan"];
  if (/\bfire\b|\bflame\b|\bred\b/.test(text)) return ["flame_red", "orange", "yellow"];
  if (/\bmagic\b|\barcane\b|\bpurple\b/.test(text)) return ["arcane_purple", "magenta", "white"];
  if (archetype === "magical_wand") return ["arcane_purple", "white"];
  if (archetype === "tech_device" || archetype === "industrial_block") return ["steel", "cyan", "white"];
  if (archetype === "crystal_object") return ["crystal_blue", "white"];
  if (archetype === "corrupted_item") return ["dark_purple", "black", "crimson"];
  if (archetype === "organic_material") return ["organic_green", "brown"];
  if (archetype === "ancient_relic") return ["aged_gold", "bronze"];
  return ["creative_primary", "creative_secondary"];
}

function resolveOverlayMotifs(archetype: ArchetypeId, text: string): OverlayMotif[] {
  if (/\brune\b|\bglyph\b|\barcane\b/.test(text) || archetype === "mystical_block" || archetype === "ancient_relic")
    return ["runes", "glyphs"];
  if (/\bcircuit\b|\btech\b/.test(text) || archetype === "tech_device" || archetype === "industrial_block")
    return ["circuits"];
  if (archetype === "organic_material" || /\bvein\b/.test(text)) return ["veins"];
  if (archetype === "magical_wand") return ["runes"];
  return [];
}

function hasEmissiveIntent(archetype: ArchetypeId, text: string): boolean {
  if (/\blightning\b|\bmagic\b|\bglow\b|\bemissive\b|\barcane\b/.test(text)) return true;
  if (archetype === "magical_wand" || archetype === "mystical_block" || archetype === "tech_device") return true;
  if (archetype === "crystal_object" || archetype === "corrupted_item") return true;
  return false;
}

function resolveEmissiveZones(archetype: ArchetypeId): string[] {
  if (archetype === "magical_wand") return ["tip", "core"];
  if (archetype === "crystal_object") return ["surface", "core"];
  if (archetype === "tech_device") return ["accents", "edges"];
  if (archetype === "mystical_block") return ["surface", "edges"];
  if (archetype === "corrupted_item") return ["cracks", "core"];
  return ["accent"];
}
