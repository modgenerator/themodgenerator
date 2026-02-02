/**
 * Scope-Based Credit Calculation.
 * Credits = sum of (scope unit cost × quantity). Result snaps to nearest tier.
 * Tiers: 5 (items only) | 30 (items + behaviors) | 60 (+ entities) | 120 (+ world) | 300 (full).
 * No auto-escalate; credits snap to nearest tier only.
 */

import type { ScopeUnit } from "./scope-metrics.js";
import { SCOPE_COSTS, SCOPE_UNIT_LABELS } from "./scope-metrics.js";

/** Strict tiers. Magic wand with right-click, damage, lightning = 30. */
export const CREDIT_TIERS = [5, 30, 60, 120, 300] as const;
export type CreditBudget = (typeof CREDIT_TIERS)[number];

/**
 * Snap raw credits to the nearest tier. Never return non-tier values (e.g. 35 → 30).
 */
export function snapToTier(rawCredits: number): CreditBudget {
  if (rawCredits <= 0) return CREDIT_TIERS[0];
  let nearest: CreditBudget = CREDIT_TIERS[0];
  let best = Math.abs(rawCredits - nearest);
  for (const tier of CREDIT_TIERS) {
    const d = Math.abs(rawCredits - tier);
    if (d < best) {
      best = d;
      nearest = tier;
    }
  }
  return nearest;
}

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
 * totalCredits is always a tier value (5, 30, 60, 120, 300). No "estimated 35" style.
 */
export function getScopeBudgetResult(
  scope: ScopeUnit[],
  budget: CreditBudget
): ScopeBudgetResult {
  const rawCredits = calculateCreditsFromScope(scope);
  const totalCredits = snapToTier(rawCredits);
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
