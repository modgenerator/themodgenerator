import type { ModSpecV1 } from "@themodgenerator/spec";
import { validateForbiddenMechanics } from "./forbidden-mechanics.js";
import { validateSurvivalIntegration } from "./survival-integration.js";
import { validateFabricVersion } from "./fabric-version.js";
import { validateTextureGate } from "./texture-gate.js";
import { validateSpecConsistency } from "./spec-consistency.js";
import { validateRecipes } from "./validate-recipes.js";
import {
  validateTier1,
  TIER1_NO_FEATURES,
  TIER1_UNKNOWN_FEATURE,
  TIER1_FORBIDDEN_FEATURE,
  TIER1_ORES_FORBIDDEN,
  TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN,
} from "./validate-tier1.js";

export interface ValidationReport {
  valid: boolean;
  reason?: string;
  gate?: string;
}

/** Run all validation gates. Tier 1 gate runs first. First failure returns immediately. */
export function validateSpec(spec: ModSpecV1, options?: { prompt?: string }): ValidationReport {
  const gates = [
    { name: "tier1", fn: () => validateTier1(spec) },
    {
      name: "recipes",
      fn: () => {
        const r = validateRecipes(spec);
        return { valid: r.valid, reason: r.errors.join("; ") };
      },
    },
    { name: "spec-consistency", fn: () => validateSpecConsistency(spec) },
    { name: "fabric-version", fn: () => validateFabricVersion(spec) },
    { name: "forbidden-mechanics", fn: () => validateForbiddenMechanics(spec, options?.prompt) },
    { name: "survival-integration", fn: () => validateSurvivalIntegration(spec) },
    { name: "texture-gate", fn: () => validateTextureGate(spec) },
  ];
  for (const { name, fn } of gates) {
    const r = fn();
    if (!r.valid) {
      return { valid: false, reason: r.reason, gate: name };
    }
  }
  return { valid: true };
}

export {
  validateTier1,
  TIER1_NO_FEATURES,
  TIER1_UNKNOWN_FEATURE,
  TIER1_FORBIDDEN_FEATURE,
  TIER1_ORES_FORBIDDEN,
  TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN,
  validateForbiddenMechanics,
  validateSurvivalIntegration,
  validateFabricVersion,
  validateTextureGate,
  validateSpecConsistency,
};
export type { ValidateModSpecV2Result } from "./validate-modspec-v2.js";
export { validateModSpecV2 } from "./validate-modspec-v2.js";
export type { ValidateRecipesResult } from "./validate-recipes.js";
export { validateRecipes } from "./validate-recipes.js";
