/**
 * Stub primitive composer — Plane 2 representation.
 * Maps visual descriptors to deterministic asset keys. No pixels, no file IO.
 * Rasterizer and actual PNG generation are deferred.
 *
 * Canonical naming scheme for AssetKey:
 * - category: "item" | "block" — namespace separation; item/x and block/x are distinct.
 * - kind: "texture" | "model" — texture keys and model keys share the same key string
 *   (e.g. item/ruby) but differ by kind; execution layer may map to different paths.
 * - key: "{category}/{contentId}" — e.g. "item/ruby", "block/ruby_block".
 *   No file extensions; no Fabric paths. Same descriptor always yields same keys.
 * Collisions: items and blocks are in separate categories, so contentId "ruby"
 * as item vs block produce different AssetKeys (item/ruby vs block/ruby).
 */

import type { VisualDescriptorTier1 } from "@themodgenerator/spec";
import { isHandheldItemDescriptor, isCubeBlockDescriptor } from "@themodgenerator/spec";

export interface AssetKey {
  kind: "texture" | "model";
  category: "item" | "block";
  /** Canonical key: "{category}/{contentId}", e.g. "item/ruby", "block/ruby_block". */
  key: string;
}

/** Build canonical key for a descriptor: category/contentId. */
function canonicalKey(category: "item" | "block", contentId: string): string {
  return `${category}/${contentId}`;
}

/**
 * Stub: map Tier 1 descriptors to deterministic asset keys.
 * Enforces canonical scheme: item/block namespace, texture/model kind, category/contentId key.
 */
export function composeTier1Stub(descriptors: VisualDescriptorTier1[]): AssetKey[] {
  const keys: AssetKey[] = [];
  for (const d of descriptors) {
    if (isHandheldItemDescriptor(d)) {
      const key = canonicalKey("item", d.contentId);
      keys.push({ kind: "texture", category: "item", key });
      keys.push({ kind: "model", category: "item", key });
    } else if (isCubeBlockDescriptor(d)) {
      const key = canonicalKey("block", d.contentId);
      keys.push({ kind: "texture", category: "block", key });
      keys.push({ kind: "model", category: "block", key });
    }
  }
  return keys;
}
