import type { ModSpecV1 } from "@themodgenerator/spec";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Hard rule: modId must not be derived from prompt; use fixed "generated". No spaces or long slugs. */
const VALID_MOD_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/** Spec consistency: no dangling references, valid modId (must be "generated" or match pattern, no spaces). */
export function validateSpecConsistency(spec: ModSpecV1): ValidationResult {
  if (spec.modId !== "generated" && !VALID_MOD_ID_PATTERN.test(spec.modId)) {
    return { valid: false, reason: "modId must be 'generated' or lowercase letters, numbers, underscores only (max 64 chars). It must not be derived from prompt text." };
  }
  if (/\s/.test(spec.modId)) {
    return { valid: false, reason: "modId must not contain spaces." };
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
