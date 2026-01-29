/**
 * Tests for aggregated expectation contract. Describes entire mod; no item-specific refs.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAggregatedExpectationContract } from "./expectation-aggregation.js";
import type { AggregatedExecutionPlan } from "./plan-aggregation.js";

describe("buildAggregatedExpectationContract", () => {
  it("whatItDoes derived from aggregated systems", () => {
    const plan: AggregatedExecutionPlan = {
      systems: ["interaction", "targeting", "chaining"],
      primitives: ["register_item", "on_use", "raycast_target", "spawn_entity"],
      explanation: ["Register item; Right-click use; Target raycast; Spawn entity (e.g. lightning)"],
    };
    const contract = buildAggregatedExpectationContract(plan);
    assert.ok(contract.whatItDoes.length >= 2);
  });

  it("howYouUseIt union of interaction-related usage", () => {
    const plan: AggregatedExecutionPlan = {
      systems: ["interaction", "cooldown"],
      primitives: ["register_item", "on_use", "cooldown"],
      explanation: [],
    };
    const contract = buildAggregatedExpectationContract(plan);
    assert.ok(contract.howYouUseIt.length >= 1);
  });

  it("limits only for missing systems", () => {
    const plan: AggregatedExecutionPlan = {
      systems: ["interaction"],
      primitives: ["register_item"],
      explanation: [],
    };
    const contract = buildAggregatedExpectationContract(plan);
    assert.ok(contract.limits.length >= 1);
  });

  it("scalesWithCredits includes futureExpansion entries", () => {
    const plan: AggregatedExecutionPlan = {
      systems: ["chaining"],
      primitives: ["raycast_target", "spawn_entity"],
      explanation: [],
      futureExpansion: ["Multi-target upgrades"],
    };
    const contract = buildAggregatedExpectationContract(plan);
    assert.ok(contract.scalesWithCredits.some((s) => s.includes("Multi-target") || s.includes("credits")));
  });
});
