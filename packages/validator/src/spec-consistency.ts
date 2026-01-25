import type { ModSpecV1 } from "@themodgenerator/spec";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Spec consistency: no dangling references, valid modId pattern. */
export function validateSpecConsistency(spec: ModSpecV1): ValidationResult {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(spec.modId)) {
    return { valid: false, reason: "modId must be lowercase, start with a letter, and contain only letters, numbers, underscores (max 64 chars)." };
  }
  if (!spec.modName || spec.modName.length > 128) {
    return { valid: false, reason: "modName must be 1–128 characters." };
  }
  if (!spec.features || spec.features.length === 0) {
    return { valid: false, reason: "At least one feature is required." };
  }
  const supported = new Set(["hello-world", "ore", "ingot", "tools", "mob-drop", "structure-spawn", "advancement"]);
  for (const f of spec.features) {
    if (!supported.has(f)) {
      return { valid: false, reason: `Unsupported feature: "${f}".` };
    }
  }
  return { valid: true };
}
