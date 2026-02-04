/**
 * Block families: fail fast if any requested variant is not in the registry.
 * No material-specific logic; extensible via SUPPORTED_VARIANTS.
 */

import type { ModSpecV1 } from "@themodgenerator/spec";

/** Variants that the materializer can resolve. Extended as generation is implemented. */
export const SUPPORTED_VARIANTS = new Set<string>([
  "block",
  "polished_block",
  "bricks",
  "stairs",
  "slab",
  "wall",
  "door",
  "trapdoor",
  "fence",
  "fence_gate",
  "button",
  "pressure_plate",
  "sign",
  "hanging_sign",
  "post",
  "rod",
  "path_block",
]);

export interface ValidateBlockFamiliesResult {
  valid: boolean;
  errors: string[];
}

export function validateBlockFamilies(spec: ModSpecV1): ValidateBlockFamiliesResult {
  const errors: string[] = [];
  const families = spec.blockFamilies ?? [];
  for (const family of families) {
    for (const v of family.variants) {
      if (!SUPPORTED_VARIANTS.has(v)) {
        const supported = [...SUPPORTED_VARIANTS].sort().join(", ");
        errors.push(
          `Unknown variant "${v}" in block family "${family.baseId}". Supported variants: ${supported}`
        );
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
