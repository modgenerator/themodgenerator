/**
 * Scope-Based Credit Calculation.
 * Credits = sum of (scope unit cost × quantity). Deterministic; same scope → same credits.
 * Budget tiers: 30 | 60 | 120 | 300. No caps inside calculation; no blocking.
 *
 * HARD GUARANTEE:
 * - User intent is NEVER rejected.
 * - All requested functionality is planned and generated.
 * - Credits are economic only; they never disable features.
 * - If over budget, the mod is still fully generated.
 * - Budget only affects whether the user can download without upgrading.
 */

import type { ScopeUnit } from "./scope-metrics.js";
import { SCOPE_COSTS, SCOPE_UNIT_LABELS } from "./scope-metrics.js";

export type CreditBudget = 30 | 60 | 120 | 300;

/**
 * Calculate total credits for a list of scope units.
 * Each unit contributes its base cost; same unit appearing multiple times counts multiple times.
 * Deterministic: same scope array → same credits.
 */
export function calculateCreditsFromScope(scope: ScopeUnit[]): number {
  return scope.reduce((sum, unit) => sum + (SCOPE_COSTS[unit] ?? 0), 0);
}

/**
 * Check if total credits fit within one of the four budget tiers.
 */
export function fitsWithinBudget(
  credits: number,
  budget: CreditBudget
): boolean {
  return credits <= budget;
}

/**
 * Result when comparing credits to budget. Never used to block generation.
 * When over budget: still generate everything; return this for frontend messaging.
 */
export interface ScopeBudgetResult {
  totalCredits: number;
  budget: CreditBudget;
  fitsBudget: boolean;
  overBy: number;
  scopeSummary: string[];
  explanation: string;
}

/**
 * Build a human-readable list of scope categories (unique, labeled).
 */
function buildScopeSummary(scope: ScopeUnit[]): string[] {
  const seen = new Set<ScopeUnit>();
  const labels: string[] = [];
  for (const unit of scope) {
    if (seen.has(unit)) continue;
    seen.add(unit);
    labels.push(SCOPE_UNIT_LABELS[unit] ?? unit);
  }
  return labels;
}

/**
 * Build explanation when over budget. No mention of "tiers blocking features".
 */
function buildExplanation(
  scopeSummary: string[],
  _totalCredits: number,
  _budget: number,
  fits: boolean
): string {
  if (fits) {
    return "";
  }
  return `This mod includes: ${scopeSummary.join(", ")}. That scope exceeds the current credit budget. Upgrade to generate this mod.`;
}

/**
 * Compute scope-based credit result for frontend.
 * Never rejects or removes features; only informs.
 */
export function getScopeBudgetResult(
  scope: ScopeUnit[],
  budget: CreditBudget
): ScopeBudgetResult {
  const totalCredits = calculateCreditsFromScope(scope);
  const fitsBudget = fitsWithinBudget(totalCredits, budget);
  const overBy = fitsBudget ? 0 : totalCredits - budget;
  const scopeSummary = buildScopeSummary(scope);
  const explanation = buildExplanation(
    scopeSummary,
    totalCredits,
    budget,
    fitsBudget
  );
  return {
    totalCredits,
    budget,
    fitsBudget,
    overBy,
    scopeSummary,
    explanation,
  };
}
