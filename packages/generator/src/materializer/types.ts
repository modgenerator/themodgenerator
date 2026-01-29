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

export interface MaterializedFile {
  path: string;
  contents: string;
  /** When present, texture file uses this canonical placeholder (wood/stone/metal/gem/generic). */
  placeholderMaterial?: CanonicalMaterial;
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
}

export interface FabricMaterializerTier1 {
  materialize(expanded: ExpandedSpecTier1, assets: AssetKey[]): MaterializedFile[];
}
