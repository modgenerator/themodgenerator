import type { ModSpecV1 } from "@themodgenerator/spec";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Texture gate: all required textures must exist and have correct resolution.
 * In the builder we do a defense-in-depth check on disk; here we only check
 * that the spec's assetsRequired are consistent. Actual file existence is
 * validated at build time.
 */
export function validateTextureGate(spec: ModSpecV1, _resolvedPaths?: Map<string, { w: number; h: number }>): ValidationResult {
  if (!spec.assetsRequired || spec.assetsRequired.length === 0) {
    return { valid: true };
  }
  for (const ref of spec.assetsRequired) {
    if (!ref.path || !ref.path.endsWith(".png")) {
      return { valid: false, reason: `Asset "${ref.path}" must be a .png texture.` };
    }
    if (ref.expectedWidth != null && (ref.expectedWidth !== 16 && ref.expectedWidth !== 32 && ref.expectedWidth % 16 !== 0)) {
      return { valid: false, reason: `Texture "${ref.path}" should use standard resolution (e.g. 16, 32).` };
    }
  }
  return { valid: true };
}
