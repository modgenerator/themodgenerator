import type { ModSpecV1 } from "@themodgenerator/spec";

/** Physics-breaking or otherwise forbidden mechanics. Request is rejected if detected. */
const FORBIDDEN_KEYWORDS = [
  "flight", "fly", "flying", "double jump", "dash", "gravity", "vehicle",
  "moving block", "physics engine", "time manipulation", "slow motion",
  "speed hack", "no-clip", "phase", "teleport block", "portable"
];

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Forbidden mechanics gate: reject prompts/specs that imply physics-breaking or
 * creative-only/command-only mechanics.
 */
export function validateForbiddenMechanics(spec: ModSpecV1, prompt?: string): ValidationResult {
  const text = [prompt ?? "", spec.modName, JSON.stringify(spec.features)].join(" ").toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      return { valid: false, reason: `Forbidden mechanics detected: "${kw}". We do not support flight, dash, double jump, gravity edits, vehicles, time manipulation, or moving blocks.` };
    }
  }
  return { valid: true };
}
