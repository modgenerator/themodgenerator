/**
 * Scope-based credit calculation. Deterministic; same scope → same credits.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateCreditsFromScope,
  fitsWithinBudget,
  getScopeBudgetResult,
  type CreditBudget,
} from "./credit-calculator.js";
import type { ScopeUnit } from "./scope-metrics.js";

describe("calculateCreditsFromScope", () => {
  it("sums cost × count per unit", () => {
    const scope: ScopeUnit[] = ["item", "item", "item_behavior"];
    const credits = calculateCreditsFromScope(scope);
    assert.strictEqual(credits, 5 + 5 + 10, "item(5)+item(5)+item_behavior(10)=20");
  });

  it("is deterministic", () => {
    const scope: ScopeUnit[] = ["dimension", "biome", "quest"];
    assert.strictEqual(calculateCreditsFromScope(scope), calculateCreditsFromScope(scope));
  });
});

describe("fitsWithinBudget", () => {
  it("returns true when credits <= budget", () => {
    assert.strictEqual(fitsWithinBudget(20, 30), true);
    assert.strictEqual(fitsWithinBudget(30, 30), true);
    assert.strictEqual(fitsWithinBudget(60, 60), true);
  });
  it("returns false when credits > budget", () => {
    assert.strictEqual(fitsWithinBudget(31, 30), false);
    assert.strictEqual(fitsWithinBudget(100, 60), false);
  });
});

describe("getScopeBudgetResult", () => {
  it("fitsBudget true when within budget", () => {
    const scope: ScopeUnit[] = ["item", "item_behavior"];
    const budget: CreditBudget = 30;
    const result = getScopeBudgetResult(scope, budget);
    assert.strictEqual(result.fitsBudget, true);
    assert.strictEqual(result.overBy, 0);
    // totalCredits is snapped to nearest tier (5, 30, 60, 120, 300). Raw 15 snaps to 5.
    assert.strictEqual(result.totalCredits, 5);
    assert.strictEqual(result.budget, 30);
    assert.strictEqual(result.explanation, "");
  });

  it("fitsBudget false and overBy when over budget", () => {
    const scope: ScopeUnit[] = ["dimension", "biome", "structure", "entity"];
    const budget: CreditBudget = 30;
    const result = getScopeBudgetResult(scope, budget);
    assert.strictEqual(result.fitsBudget, false);
    assert.ok(result.overBy > 0);
    assert.ok(result.explanation.length > 0);
    assert.ok(result.explanation.includes("exceeds"));
    assert.ok(result.scopeSummary.length > 0);
  });
});
