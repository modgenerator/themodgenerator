/**
 * Tests for plan aggregation. Multiple items aggregate; item + block merge; determinism; empty safe.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { aggregateExecutionPlans } from "./plan-aggregation.js";
import { planFromIntent } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";

function makePlan(overrides: Partial<ExecutionPlan>): ExecutionPlan {
  return {
    primitives: ["register_item"],
    explanation: "Minimal",
    creditCost: 1,
    systems: ["interaction"],
    ...overrides,
  };
}

describe("aggregateExecutionPlans", () => {
  it("empty plans return valid empty structure", () => {
    const out = aggregateExecutionPlans([]);
    assert.deepStrictEqual(out.systems, []);
    assert.deepStrictEqual(out.primitives, []);
    assert.deepStrictEqual(out.explanation, []);
    assert.strictEqual(out.upgradePath, undefined);
    assert.strictEqual(out.futureExpansion, undefined);
  });

  it("multiple items aggregate correctly", () => {
    const plan1 = planFromIntent({
      name: "Magic Wand",
      description: "shoots lightning",
      category: "item",
    });
    const plan2 = planFromIntent({
      name: "Healing Potion",
      description: "heals the player",
      category: "item",
    });
    const aggregated = aggregateExecutionPlans([plan1, plan2]);
    assert.ok(aggregated.systems.length >= 2);
    assert.ok(aggregated.systems.includes("targeting"));
    assert.ok(aggregated.systems.includes("chaining") || aggregated.systems.includes("status_effect"));
    assert.ok(aggregated.primitives.length >= 2);
    assert.ok(aggregated.explanation.length >= 1);
  });

  it("item + block plans merge systems", () => {
    const itemPlan = planFromIntent({
      name: "Wand",
      description: "shoots lightning",
      category: "item",
    });
    const blockPlan = planFromIntent({
      name: "Glowing Block",
      description: "passive glowing block",
      category: "block",
    });
    const aggregated = aggregateExecutionPlans([itemPlan, blockPlan]);
    assert.ok(aggregated.systems.length >= 1);
    assert.ok(aggregated.primitives.length >= 1);
    assert.ok(Array.isArray(aggregated.explanation));
  });

  it("determinism: same inputs → same output", () => {
    const plans: ExecutionPlan[] = [
      makePlan({ systems: ["interaction", "chaining"], primitives: ["register_item", "on_use", "raycast_target"], explanation: "A" }),
      makePlan({ systems: ["interaction", "cooldown"], primitives: ["register_item", "on_use", "cooldown"], explanation: "B" }),
    ];
    const a = aggregateExecutionPlans(plans);
    const b = aggregateExecutionPlans(plans);
    assert.deepStrictEqual(a.systems, b.systems);
    assert.deepStrictEqual(a.primitives, b.primitives);
    assert.deepStrictEqual(a.explanation, b.explanation);
  });

  it("union systems and primitives, dedupe upgradePath and futureExpansion", () => {
    const plans: ExecutionPlan[] = [
      makePlan({
        systems: ["interaction", "chaining"],
        primitives: ["register_item", "on_use", "raycast_target"],
        explanation: "First",
        upgradePath: ["Can add multi-target"],
        futureExpansion: ["Multi-target upgrades"],
      }),
      makePlan({
        systems: ["interaction", "chaining"],
        primitives: ["register_item", "on_use", "raycast_target"],
        explanation: "First",
        upgradePath: ["Can add multi-target"],
        futureExpansion: ["Multi-target upgrades"],
      }),
    ];
    const aggregated = aggregateExecutionPlans(plans);
    assert.strictEqual(aggregated.systems.length, 2);
    assert.strictEqual(aggregated.primitives.length, 3);
    assert.strictEqual(aggregated.explanation.length, 1);
    assert.strictEqual(aggregated.upgradePath?.length, 1);
    assert.strictEqual(aggregated.futureExpansion?.length, 1);
  });
});
