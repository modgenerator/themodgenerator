/**
 * Plane 3 materializer — interfaces only.
 * Pure; no filesystem writes; output is an in-memory file tree.
 * Tier 1 only. Consumer of Plane 1/2 (ExpandedSpecTier1, AssetKey).
 *
 * Phase C: Semantic metadata (archetype, hints) does NOT change file paths or keys.
 * Enables future replacement with real art, frontend previews, and higher tiers.
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { AssetKey } from "../composer-stub.js";
import type { CanonicalMaterial, ArchetypeId, ArchetypeGuarantees } from "../canonical-interpretation.js";
import type { TextureProfile } from "@themodgenerator/spec";

export interface MaterializedFile {
  path: string;
  contents: string;
  /** When present, texture file uses this canonical placeholder (wood/stone/metal/gem/generic). */
  placeholderMaterial?: CanonicalMaterial;
  /** Optional color hint for placeholder texture (e.g. "yellow", "red"). From spec/interpretation. */
  colorHint?: string;
  /** Semantic intent so block/item/processed get distinct textures. */
  textureIntent?: "block" | "item" | "processed";
  /** Semantic profile for texture generation (intent, materialHint, traits). Drives prompt and seed. */
  textureProfile?: TextureProfile;
  /** Constructed texture prompt from textureProfile for logging/manifest. */
  texturePrompt?: string;
  /** Expressive archetype for this asset (fallback only). Set only when user has not provided asset. */
  archetype?: ArchetypeId;
  /** Hint: emissive. From archetype definition. */
  emissiveHint?: boolean;
  /** Hint: translucency. From archetype definition. */
  translucencyHint?: boolean;
  /** Hint: glow. From archetype definition. */
  glowHint?: boolean;
  /** Semantic visual guarantees (silhouette, contrast, motion, emissive). Attached as metadata to texture files. */
  archetypeGuarantees?: ArchetypeGuarantees;
  /** Visual Fidelity: level from credits (basic | enhanced | advanced | legendary). */
  visualLevel?: "basic" | "enhanced" | "advanced" | "legendary";
  /** One-line blueprint summary for frontend. */
  blueprintSummary?: string;
  /** Texture resolution (16 | 32 | 64 | 128). */
  textureResolution?: number;
  /** Chosen texture source key (curated or procedural). */
  textureSourceKey?: string;
  /** Visual features enabled (emissive, glow, layered). */
  visualFeatures?: string[];
  /** When set, builder copies these vanilla texture paths (relative to assets/minecraft/textures, no .png) instead of generating. */
  copyFromVanillaPaths?: string[];
  /** When set, builder uses collectVanillaDepsForBlock(vanillaTemplateBlockId) to resolve textures from blockstate+models (no guessed paths). */
  vanillaTemplateBlockId?: string;
}

export interface FabricMaterializerTier1 {
  materialize(expanded: ExpandedSpecTier1, assets: AssetKey[]): MaterializedFile[];
}
