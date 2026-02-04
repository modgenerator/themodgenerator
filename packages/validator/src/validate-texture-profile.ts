import type { ModSpecV1 } from "@themodgenerator/spec";

export interface ValidateTextureProfileResult {
  valid: boolean;
  errors: string[];
}

/**
 * Fail if any texture-bearing entity (item or block) is missing or has incomplete textureProfile.
 * Required: intent, materialHint (non-empty), physicalTraits (non-empty array), surfaceStyle (non-empty array).
 */
export function validateTextureProfile(spec: ModSpecV1): ValidateTextureProfileResult {
  const errors: string[] = [];

  for (const item of spec.items ?? []) {
    const p = item.textureProfile;
    if (!p) {
      errors.push(`Item "${item.id}" missing textureProfile. Every texture-bearing entity must declare textureProfile.`);
      continue;
    }
    if (!p.intent || !["block", "item", "processed"].includes(p.intent)) {
      errors.push(`Item "${item.id}" textureProfile.intent must be "block", "item", or "processed".`);
    }
    if (typeof p.materialHint !== "string" || !p.materialHint.trim()) {
      errors.push(`Item "${item.id}" textureProfile.materialHint must be a non-empty string (from displayName or familyType).`);
    }
    if (!Array.isArray(p.physicalTraits) || p.physicalTraits.length === 0) {
      errors.push(`Item "${item.id}" textureProfile.physicalTraits must be a non-empty array (inferred by interpreter).`);
    }
    if (!Array.isArray(p.surfaceStyle) || p.surfaceStyle.length === 0) {
      errors.push(`Item "${item.id}" textureProfile.surfaceStyle must be a non-empty array (inferred by interpreter).`);
    }
  }

  for (const block of spec.blocks ?? []) {
    const p = block.textureProfile;
    if (!p) {
      errors.push(`Block "${block.id}" missing textureProfile. Every texture-bearing entity must declare textureProfile.`);
      continue;
    }
    if (!p.intent || !["block", "item", "processed"].includes(p.intent)) {
      errors.push(`Block "${block.id}" textureProfile.intent must be "block", "item", or "processed".`);
    }
    if (typeof p.materialHint !== "string" || !p.materialHint.trim()) {
      errors.push(`Block "${block.id}" textureProfile.materialHint must be a non-empty string (from displayName or familyType).`);
    }
    if (!Array.isArray(p.physicalTraits) || p.physicalTraits.length === 0) {
      errors.push(`Block "${block.id}" textureProfile.physicalTraits must be a non-empty array (inferred by interpreter).`);
    }
    if (!Array.isArray(p.surfaceStyle) || p.surfaceStyle.length === 0) {
      errors.push(`Block "${block.id}" textureProfile.surfaceStyle must be a non-empty array (inferred by interpreter).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
