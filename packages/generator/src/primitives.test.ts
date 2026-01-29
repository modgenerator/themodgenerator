/**
 * Tests for execution primitives registry.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { PRIMITIVE_REGISTRY } from "./primitives.js";
import type { Primitive } from "./primitives.js";

const ALL_PRIMITIVES: Primitive[] = [
  "register_item",
  "register_block",
  "on_use",
  "cooldown",
  "spawn_entity",
  "raycast_target",
  "apply_damage",
  "apply_status_effect",
  "area_of_effect",
  "particle_effect",
  "sound_effect",
  "persistent_state",
  "tick_behavior",
];

describe("PRIMITIVE_REGISTRY", () => {
  it("every primitive has a definition", () => {
    for (const id of ALL_PRIMITIVES) {
      const def = PRIMITIVE_REGISTRY[id];
      assert.ok(def, `missing definition for ${id}`);
      assert.strictEqual(def.id, id);
      assert.ok(typeof def.creditCost === "number" && def.creditCost >= 0);
      assert.ok(def.safety && typeof def.safety === "object");
    }
  });

  it("register_item and register_block have cost 1", () => {
    assert.strictEqual(PRIMITIVE_REGISTRY.register_item.creditCost, 1);
    assert.strictEqual(PRIMITIVE_REGISTRY.register_block.creditCost, 1);
  });

  it("spawn_entity has safety bounds", () => {
    const def = PRIMITIVE_REGISTRY.spawn_entity;
    assert.ok(def.safety.maxRange !== undefined || def.safety.cooldownTicks !== undefined);
  });
});
