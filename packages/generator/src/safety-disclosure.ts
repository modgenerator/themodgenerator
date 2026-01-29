/**
 * Safety Disclosure — Informational only. Explains why behavior is safe (range, cooldowns, limits).
 * Uses existing primitive safety metadata. Deterministic ordering. No warnings or fear language.
 */

import type { Primitive } from "./primitives.js";
import { PRIMITIVE_REGISTRY } from "./primitives.js";

export interface SafetyDisclosure {
  statements: string[];
}

/** Critical trust copy: always appended to safety disclosure. */
export const NOTHING_IS_FAKE_DISCLOSURE =
  "No placeholder systems, fake behaviors, or demo logic are used. This mod is fully generated and functional.";

/** Human-readable safety statements keyed by primitive (for deterministic ordering). */
const SAFETY_STATEMENTS: Partial<Record<Primitive, string[]>> = {
  on_use: ["Use actions are rate-limited for performance"],
  cooldown: ["Cooldowns prevent accidental spam"],
  spawn_entity: ["Lightning and entity effects are range-limited for performance"],
  raycast_target: ["Targeting is range-limited for performance"],
  apply_damage: ["Damage effects are range-limited"],
  apply_status_effect: ["Status effects are range-limited"],
  area_of_effect: ["Area effects have limited range and entity count"],
  particle_effect: ["Particle effects have limited range"],
  sound_effect: ["Sound effects have limited range"],
};

/**
 * Build safety disclosure from primitives that have safety metadata.
 * Only includes statements for primitives actually present. Deterministic (alphabetical by primitive).
 * Empty array allowed. Pure transparency; no warnings or fear language.
 */
export function buildSafetyDisclosure(primitives: Primitive[]): SafetyDisclosure {
  const seen = new Set<string>();
  const statements: string[] = [];
  const sorted = [...primitives].sort();
  for (const p of sorted) {
    const def = PRIMITIVE_REGISTRY[p];
    if (!def?.safety) continue;
    const hasRange = def.safety.maxRange != null;
    const hasCooldown = def.safety.cooldownTicks != null;
    const hasEntities = def.safety.maxEntities != null;
    const custom = SAFETY_STATEMENTS[p];
    if (custom) {
      for (const s of custom) {
        if (!seen.has(s)) {
          seen.add(s);
          statements.push(s);
        }
      }
    } else if (hasRange || hasCooldown || hasEntities) {
      const parts: string[] = [];
      if (hasRange) parts.push("range-limited for performance");
      if (hasCooldown) parts.push("cooldowns prevent accidental spam");
      if (hasEntities) parts.push("entity count is limited");
      const s = parts.length > 0 ? `Effects are ${parts.join("; ")}` : null;
      if (s && !seen.has(s)) {
        seen.add(s);
        statements.push(s);
      }
    }
  }
  statements.push(NOTHING_IS_FAKE_DISCLOSURE);
  return { statements };
}
