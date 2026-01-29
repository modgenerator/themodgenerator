/**
 * System Units — Intent → Systems → Primitives.
 * Maps user intent to gameplay systems (not just low-level primitives) for depth.
 * Deterministic; same intent → same systems → same primitives.
 */

import type { Primitive } from "./primitives.js";

export type SystemUnit =
  | "targeting"
  | "projectile"
  | "chaining"
  | "area_effect"
  | "status_effect"
  | "cooldown"
  | "movement"
  | "progression"
  | "interaction"
  | "world_generation"
  | "npc_logic"
  | "quest_logic";

export type PrimitiveId = Primitive;

export interface SystemDefinition {
  id: SystemUnit;
  primitives: PrimitiveId[];
  explanation: string;
}

/** Deterministic registry: each system maps to primitives. Same system → same primitives. */
export const SYSTEM_REGISTRY: Record<SystemUnit, SystemDefinition> = {
  targeting: {
    id: "targeting",
    primitives: ["raycast_target"],
    explanation: "Target selection via raycast",
  },
  projectile: {
    id: "projectile",
    primitives: ["spawn_entity", "particle_effect", "sound_effect"],
    explanation: "Spawns projectile or entity effect",
  },
  chaining: {
    id: "chaining",
    primitives: ["raycast_target", "spawn_entity", "apply_damage", "particle_effect", "sound_effect"],
    explanation: "Raycast, spawn, damage, particles, and sound (e.g. lightning)",
  },
  area_effect: {
    id: "area_effect",
    primitives: ["area_of_effect", "apply_damage", "particle_effect"],
    explanation: "Area-of-effect damage and particles",
  },
  status_effect: {
    id: "status_effect",
    primitives: ["apply_status_effect", "sound_effect"],
    explanation: "Applies status effect and sound",
  },
  cooldown: {
    id: "cooldown",
    primitives: ["cooldown"],
    explanation: "Cooldown between uses",
  },
  movement: {
    id: "movement",
    primitives: ["raycast_target", "persistent_state"],
    explanation: "Movement or teleport (raycast + state)",
  },
  progression: {
    id: "progression",
    primitives: ["persistent_state", "tick_behavior"],
    explanation: "Progression or persistent state over time",
  },
  interaction: {
    id: "interaction",
    primitives: ["on_use"],
    explanation: "Right-click or use interaction",
  },
  world_generation: {
    id: "world_generation",
    primitives: ["persistent_state", "tick_behavior"],
    explanation: "World or structure generation (state + tick)",
  },
  npc_logic: {
    id: "npc_logic",
    primitives: ["persistent_state", "tick_behavior", "sound_effect"],
    explanation: "NPC behavior (state, tick, sound)",
  },
  quest_logic: {
    id: "quest_logic",
    primitives: ["persistent_state", "on_use", "sound_effect"],
    explanation: "Quest or objective logic (state, use, sound)",
  },
};

/**
 * Collect all primitives for a set of systems (deduplicated, order preserved by first occurrence).
 */
export function primitivesFromSystems(systems: SystemUnit[]): PrimitiveId[] {
  const seen = new Set<PrimitiveId>();
  const out: PrimitiveId[] = [];
  for (const sys of systems) {
    const def = SYSTEM_REGISTRY[sys];
    if (!def) continue;
    for (const p of def.primitives) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out;
}
