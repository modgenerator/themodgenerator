/**
 * Derive capability flags from execution plans (generated-code view).
 * Used so API never says "no behavior" when the plan includes right-click, damage, or effects.
 * Capability summary is derived from plan/source, not prompt heuristics.
 */

import type { ExecutionPlan } from "./execution-plan.js";
import type { AggregatedExecutionPlan } from "./plan-aggregation.js";

export interface CapabilitySummary {
  hasUseAction: boolean;
  dealsDamage: boolean;
  appliesEffects: boolean;
}

/**
 * Derive capability flags from aggregated plan and per-item/block plans.
 * - hasUseAction: plan includes interaction (right-click/use) or interaction behaviors
 * - dealsDamage: plan primitives include apply_damage (chaining, area_effect)
 * - appliesEffects: plan includes status_effect, chaining (lightning), area effects, or apply_status_effect
 */
export function deriveCapabilitiesFromPlan(
  allPlans: ExecutionPlan[],
  aggregated: AggregatedExecutionPlan
): CapabilitySummary {
  const hasUseAction =
    aggregated.systems.includes("interaction") ||
    allPlans.some(
      (p) =>
        (p.behaviorPlan?.interactionBehaviors?.length ?? 0) > 0
    );

  const dealsDamage = aggregated.primitives.includes("apply_damage");

  const appliesEffects =
    aggregated.primitives.includes("apply_status_effect") ||
    aggregated.systems.includes("status_effect") ||
    aggregated.systems.includes("chaining") ||
    aggregated.systems.includes("area_effect") ||
    aggregated.primitives.includes("particle_effect") ||
    allPlans.some(
      (p) => (p.behaviorPlan?.areaEffects?.length ?? 0) > 0
    );

  return {
    hasUseAction,
    dealsDamage,
    appliesEffects,
  };
}
