/**
 * Tests for Deterministic Execution Planner.
 * Same intent → same systems → same plan; unknown → minimal (interaction only); no rejection.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { planFromIntent, calculateCredits, intentToSystems } from "./execution-plan.js";
import { primitivesFromSystems } from "./system-units.js";

describe("intentToSystems", () => {
  it("same intent yields same systems (determinism)", () => {
    const intent = { name: "Magic Wand", description: "shoots lightning", category: "item" as const };
    const a = intentToSystems(intent);
    const b = intentToSystems(intent);
    assert.deepStrictEqual(a, b);
  });

  it('"shoots lightning" includes targeting, chaining, cooldown', () => {
    const systems = intentToSystems({
      name: "Magic Wand",
      description: "shoots lightning",
      category: "item",
    });
    assert.ok(systems.includes("targeting"));
    assert.ok(systems.includes("chaining"));
    assert.ok(systems.includes("cooldown"));
  });

  it("unknown intent → minimal systems (interaction only)", () => {
    const systems = intentToSystems({
      name: "Thing",
      description: "something vague",
      category: "item",
    });
    assert.ok(systems.includes("interaction"));
  });
});

describe("planFromIntent", () => {
  it("same intent yields same plan (determinism)", () => {
    const intent = { name: "Magic Wand", description: "shoots lightning", category: "item" as const };
    const a = planFromIntent(intent);
    const b = planFromIntent(intent);
    assert.deepStrictEqual(a.primitives, b.primitives);
    assert.deepStrictEqual(a.systems, b.systems);
    assert.strictEqual(a.creditCost, b.creditCost);
  });

  it("systems are present and deterministically map to primitives", () => {
    const plan = planFromIntent({
      name: "Magic Wand",
      description: "shoots lightning",
      category: "item",
    });
    assert.ok(plan.systems.length > 0);
    const fromRegistry = primitivesFromSystems(plan.systems);
    for (const p of fromRegistry) {
      assert.ok(plan.primitives.includes(p), `plan should include primitive ${p} from systems`);
    }
  });

  it('"shoots lightning" includes on_use, raycast_target, spawn_entity, cooldown', () => {
    const plan = planFromIntent({
      name: "Magic Wand",
      description: "shoots lightning",
      category: "item",
    });
    assert.ok(plan.primitives.includes("on_use"));
    assert.ok(plan.primitives.includes("raycast_target"));
    assert.ok(plan.primitives.includes("spawn_entity"));
    assert.ok(plan.primitives.includes("cooldown"));
    assert.ok(plan.creditCost > 1);
  });

  it("unknown intent → minimal valid behavior (register_item)", () => {
    const plan = planFromIntent({
      name: "Thing",
      description: "something vague",
      category: "item",
    });
    assert.ok(plan.primitives.includes("register_item"));
    assert.ok(plan.primitives.length >= 1);
    assert.ok(plan.creditCost >= 1);
  });

  it("block category → register_block base", () => {
    const plan = planFromIntent({ name: "Glow Block", category: "block" });
    assert.ok(plan.primitives.includes("register_block"));
  });

  it("passive glowing block includes particle_effect", () => {
    const plan = planFromIntent({
      name: "Glowing Block",
      description: "passive glowing block",
      category: "block",
    });
    assert.ok(plan.primitives.includes("particle_effect"));
  });

  it("chaining system yields upgradePath / futureExpansion", () => {
    const plan = planFromIntent({
      name: "Magic Wand",
      description: "shoots lightning",
      category: "item",
    });
    assert.ok(plan.systems.includes("chaining"));
    assert.ok(Array.isArray(plan.upgradePath));
    assert.ok(Array.isArray(plan.futureExpansion));
    assert.ok(plan.upgradePath!.length > 0 || plan.futureExpansion!.length > 0);
  });
});

describe("calculateCredits", () => {
  it("credits = sum of primitive costs", () => {
    const plan = planFromIntent({
      name: "Wand",
      description: "shoots lightning",
      category: "item",
    });
    assert.strictEqual(calculateCredits(plan), plan.creditCost);
  });

  it("stable for identical plan", () => {
    const plan = planFromIntent({ name: "Item", category: "item" });
    assert.strictEqual(calculateCredits(plan), calculateCredits(plan));
  });
});
