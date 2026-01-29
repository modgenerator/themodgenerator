/**
 * Implicit expansion engine — Plane 1 logic only.
 * An item IMPLIES: texture, model, registry, creative tab.
 * A block IMPLIES: blockstate, model, item form, texture.
 * Handled in logic, not in Fabric code.
 *
 * Deterministic ordering: same input spec always yields same descriptor order.
 * Descriptors are emitted in stable order: all items first (in spec.items order),
 * then all blocks (in spec.blocks order). No Tier 2+ branching.
 */

import type { ModSpecV1 } from "./types.js";
import type { ItemSpec, BlockSpec } from "./specs.js";
import { itemSpecFromModItem, blockSpecFromModBlock } from "./specs.js";
import { TIER_1 } from "./tier.js";
import type { VisualDescriptorTier1, HandheldItemDescriptor, CubeBlockDescriptor } from "./descriptor.js";

export interface ExpandedSpecTier1 {
  /** Original spec. */
  spec: ModSpecV1;
  /** Logic-layer item specs (Tier 1). */
  items: ItemSpec[];
  /** Logic-layer block specs (Tier 1). */
  blocks: BlockSpec[];
  /** Implied visual descriptors for assets. Order: items then blocks, stable. */
  descriptors: VisualDescriptorTier1[];
}

/**
 * Items expand to HandheldItemDescriptor because Tier 1 items are handheld
 * (ingots, gems, etc.): one texture, one model type. No block states or entities.
 */
function itemToDescriptor(item: ItemSpec): HandheldItemDescriptor {
  return {
    type: "handheld_item",
    contentId: item.id,
    material: item.material ?? "generic",
    rarity: item.rarity ?? "common",
  };
}

/**
 * Blocks expand to CubeBlockDescriptor because Tier 1 blocks are simple cubes:
 * one texture, one model. No block states, loot, or worldgen.
 */
function blockToDescriptor(block: BlockSpec): CubeBlockDescriptor {
  return {
    type: "cube_block",
    contentId: block.id,
    material: block.material ?? "generic",
  };
}

/** Expand a Tier 1 spec: derive ItemSpec/BlockSpec and implied visual descriptors. Same input → same output order. */
export function expandSpecTier1(spec: ModSpecV1): ExpandedSpecTier1 {
  const items: ItemSpec[] = (spec.items ?? []).map((m) =>
    itemSpecFromModItem(m, TIER_1)
  );
  const blocks: BlockSpec[] = (spec.blocks ?? []).map((m) =>
    blockSpecFromModBlock(m, TIER_1)
  );
  const descriptors: VisualDescriptorTier1[] = [
    ...items.map(itemToDescriptor),
    ...blocks.map(blockToDescriptor),
  ];

  return {
    spec,
    items,
    blocks,
    descriptors,
  };
}
