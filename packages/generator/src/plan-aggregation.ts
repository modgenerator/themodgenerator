/**
 * Plan Aggregation — Union of multiple execution plans into a single mod-level view.
 * Purely structural: union systems, union primitives, flatten explanations, dedupe upgrade paths.
 * No inference of new systems; no collapse of meaning. Deterministic ordering (alphabetical).
 *
 * HARD GUARANTEE:
 * - User intent is NEVER rejected.
 * - All requested functionality is planned and generated.
 * - Credits are economic only; they never disable features.
 * - If over budget, the mod is still fully generated.
 * - Budget only affects whether the user can download without upgrading.
 */

import type { ExecutionPlan } from "./execution-plan.js";
import type { SystemUnit, PrimitiveId } from "./system-units.js";

export interface AggregatedExecutionPlan {
  systems: SystemUnit[];
  primitives: PrimitiveId[];
  explanation: string[];
  upgradePath?: string[];
  futureExpansion?: string[];
}

/**
 * Deterministic ordering: systems and primitives sorted alphabetically for stable output.
 * explanation: flattened list of each plan's explanation in input order, then deduped by string (first occurrence wins).
 * upgradePath / futureExpansion: concatenate all, dedupe by string (first occurrence wins).
 */
export function aggregateExecutionPlans(plans: ExecutionPlan[]): AggregatedExecutionPlan {
  if (plans.length === 0) {
    return {
      systems: [],
      primitives: [],
      explanation: [],
    };
  }

  const systemsSet = new Set<SystemUnit>();
  const primitivesSet = new Set<PrimitiveId>();
  const explanationList: string[] = [];
  const upgradePathSeen = new Set<string>();
  const upgradePathList: string[] = [];
  const futureExpansionSeen = new Set<string>();
  const futureExpansionList: string[] = [];

  for (const plan of plans) {
    for (const s of plan.systems) {
      systemsSet.add(s);
    }
    for (const p of plan.primitives) {
      primitivesSet.add(p);
    }
    if (plan.explanation?.trim()) {
      explanationList.push(plan.explanation.trim());
    }
    for (const u of plan.upgradePath ?? []) {
      const key = u.trim();
      if (key && !upgradePathSeen.has(key)) {
        upgradePathSeen.add(key);
        upgradePathList.push(u.trim());
      }
    }
    for (const f of plan.futureExpansion ?? []) {
      const key = f.trim();
      if (key && !futureExpansionSeen.has(key)) {
        futureExpansionSeen.add(key);
        futureExpansionList.push(f.trim());
      }
    }
  }

  const systems = Array.from(systemsSet).sort();
  const primitives = Array.from(primitivesSet).sort();

  const explanationSeen = new Set<string>();
  const explanation: string[] = [];
  for (const e of explanationList) {
    if (!explanationSeen.has(e)) {
      explanationSeen.add(e);
      explanation.push(e);
    }
  }

  return {
    systems,
    primitives,
    explanation,
    upgradePath: upgradePathList.length > 0 ? upgradePathList : undefined,
    futureExpansion: futureExpansionList.length > 0 ? futureExpansionList : undefined,
  };
}
