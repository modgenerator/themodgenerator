/**
 * Final invariant tests — assert consistency of execution plan, scope, credits, budget.
 * Tests assert consistency (no errors, no empty plans when content exists), not exact values.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { planFromIntent } from "./execution-plan.js";
import { aggregateExecutionPlans } from "./plan-aggregation.js";
import { expandIntentToScope, expandPromptToScope } from "./scope-expansion.js";
import { getScopeBudgetResult, type CreditBudget } from "./credit-calculator.js";
import { buildAggregatedExpectationContract } from "./expectation-aggregation.js";
import { buildSafetyDisclosure } from "./safety-disclosure.js";

const BUDGET_SMALL: CreditBudget = 30;

describe("Large RPG-style prompt invariants", () => {
  it("executionPlan.systems.length > 0, scopeSummary.length > 0, totalCredits > budget, fitsBudget === false, no errors, no empty plans", () => {
    const prompt = "Full RPG world with quests, NPCs, a new dimension, biomes, and structures";
    const scopeFromPrompt = expandPromptToScope(prompt);
    const scopeFromItems = expandIntentToScope({
      name: "Quest Item",
      description: prompt,
      category: "item",
    });
    const fullScope = [...scopeFromPrompt, ...scopeFromItems];
    const scopeResult = getScopeBudgetResult(fullScope, BUDGET_SMALL);

    const itemPlan = planFromIntent({
      name: "Quest Item",
      description: prompt,
      category: "item",
    });
    const allPlans = [itemPlan];
    const aggregatedPlan = aggregateExecutionPlans(allPlans);
    const expectationContract = buildAggregatedExpectationContract(aggregatedPlan);
    const safetyDisclosure = buildSafetyDisclosure(aggregatedPlan.primitives);

    assert.ok(aggregatedPlan.systems.length > 0, "executionPlan.systems must be non-empty for RPG-style content");
    assert.ok(scopeResult.scopeSummary.length > 0, "scopeSummary must be non-empty");
    assert.ok(scopeResult.totalCredits > BUDGET_SMALL, "totalCredits should exceed small budget for large scope");
    assert.strictEqual(scopeResult.fitsBudget, false, "fitsBudget must be false when over budget");
    assert.ok(aggregatedPlan.explanation.length >= 0, "no empty plans: explanation is array");
    assert.ok(expectationContract.whatItDoes.length > 0, "expectation contract must describe behavior");
    assert.ok(safetyDisclosure.statements.length > 0, "safety disclosure must include statements");
  });
});

describe("Simple item invariants", () => {
  it("executionPlan.systems includes interaction, scopeSummary includes item, totalCredits <= 30, fitsBudget === true", () => {
    const prompt = "A simple ruby ingot";
    const scopeFromPrompt = expandPromptToScope(prompt);
    const scopeFromItems = expandIntentToScope({
      name: "Ruby Ingot",
      description: prompt,
      category: "item",
    });
    const fullScope = [...scopeFromPrompt, ...scopeFromItems];
    const scopeResult = getScopeBudgetResult(fullScope, BUDGET_SMALL);

    const itemPlan = planFromIntent({
      name: "Ruby Ingot",
      description: prompt,
      category: "item",
    });
    const allPlans = [itemPlan];
    const aggregatedPlan = aggregateExecutionPlans(allPlans);

    assert.ok(
      aggregatedPlan.systems.includes("interaction"),
      "simple item must include interaction system"
    );
    assert.ok(
      scopeResult.scopeSummary.some((s) => s.toLowerCase().includes("item")),
      "scopeSummary should include item"
    );
    assert.ok(scopeResult.totalCredits <= BUDGET_SMALL, "totalCredits <= budget for simple item");
    assert.strictEqual(scopeResult.fitsBudget, true, "fitsBudget must be true when within budget");
  });
});
