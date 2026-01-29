/**
 * Deterministic Execution Planner — Plane 3.
 * Closed set of execution primitives with credit cost and safety bounds.
 * No tier-based blocking; capability is universal; cost scales with complexity.
 *
 * PRIMITIVE INVARIANT
 * - Primitives describe WHAT exists, not HOW complex it is
 * - Missing primitives never block generation
 * - Unsupported primitives degrade to no-op systems, never errors
 * - Items and blocks MUST always fully materialize
 */

export type Primitive =
  | "register_item"
  | "register_block"
  | "on_use"
  | "cooldown"
  | "spawn_entity"
  | "raycast_target"
  | "apply_damage"
  | "apply_status_effect"
  | "area_of_effect"
  | "particle_effect"
  | "sound_effect"
  | "persistent_state"
  | "tick_behavior";

export interface PrimitiveSafety {
  maxRange?: number;
  maxFrequency?: number;
  maxEntities?: number;
  cooldownTicks?: number;
}

export interface PrimitiveDefinition {
  id: Primitive;
  creditCost: number;
  safety: PrimitiveSafety;
}

/** Deterministic registry. Same primitive → same cost and safety. */
export const PRIMITIVE_REGISTRY: Record<Primitive, PrimitiveDefinition> = {
  register_item: {
    id: "register_item",
    creditCost: 1,
    safety: {},
  },
  register_block: {
    id: "register_block",
    creditCost: 1,
    safety: {},
  },
  on_use: {
    id: "on_use",
    creditCost: 2,
    safety: { maxFrequency: 20, cooldownTicks: 1 },
  },
  cooldown: {
    id: "cooldown",
    creditCost: 1,
    safety: { cooldownTicks: 20 },
  },
  spawn_entity: {
    id: "spawn_entity",
    creditCost: 5,
    safety: { maxEntities: 1, maxRange: 64, cooldownTicks: 40 },
  },
  raycast_target: {
    id: "raycast_target",
    creditCost: 3,
    safety: { maxRange: 64 },
  },
  apply_damage: {
    id: "apply_damage",
    creditCost: 2,
    safety: { maxRange: 64 },
  },
  apply_status_effect: {
    id: "apply_status_effect",
    creditCost: 3,
    safety: { maxRange: 32 },
  },
  area_of_effect: {
    id: "area_of_effect",
    creditCost: 4,
    safety: { maxRange: 8, maxEntities: 16 },
  },
  particle_effect: {
    id: "particle_effect",
    creditCost: 1,
    safety: { maxRange: 16 },
  },
  sound_effect: {
    id: "sound_effect",
    creditCost: 1,
    safety: { maxRange: 32 },
  },
  persistent_state: {
    id: "persistent_state",
    creditCost: 3,
    safety: {},
  },
  tick_behavior: {
    id: "tick_behavior",
    creditCost: 4,
    safety: { maxFrequency: 20 },
  },
};
