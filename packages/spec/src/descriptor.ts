/**
 * Visual Descriptor schema — Plane 2 representation input.
 * Semantic, structured; no pixels or file paths. Deterministic and reproducible.
 */

/** Tier 1 handheld item descriptor (e.g. ingot, gem). */
export interface HandheldItemDescriptor {
  type: "handheld_item";
  contentId: string;
  material: string;
  rarity: "common" | "uncommon" | "rare" | "epic";
  color?: string;
}

/** Tier 1 simple cube block descriptor. */
export interface CubeBlockDescriptor {
  type: "cube_block";
  contentId: string;
  material: string;
  color?: string;
}

export type VisualDescriptorTier1 = HandheldItemDescriptor | CubeBlockDescriptor;

export function isHandheldItemDescriptor(
  d: VisualDescriptorTier1
): d is HandheldItemDescriptor {
  return d.type === "handheld_item";
}

export function isCubeBlockDescriptor(
  d: VisualDescriptorTier1
): d is CubeBlockDescriptor {
  return d.type === "cube_block";
}
