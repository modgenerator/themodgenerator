import type { ModSpecV1 } from "@themodgenerator/spec";
import { validateForbiddenMechanics } from "./forbidden-mechanics.js";
import { validateSurvivalIntegration } from "./survival-integration.js";
import { validateFabricVersion } from "./fabric-version.js";
import { validateTextureGate } from "./texture-gate.js";
import { validateSpecConsistency } from "./spec-consistency.js";

export interface ValidationReport {
  valid: boolean;
  reason?: string;
  gate?: string;
}

/** Run all validation gates. First failure returns immediately. */
export function validateSpec(spec: ModSpecV1, options?: { prompt?: string }): ValidationReport {
  const gates = [
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

export { validateForbiddenMechanics, validateSurvivalIntegration, validateFabricVersion, validateTextureGate, validateSpecConsistency };
