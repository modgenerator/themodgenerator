/**
 * Capability vs Scope — Internal clarification types.
 * Do NOT intertwine: Capability answers "What does this mod do?";
 * ScopeCosting answers "How big is this mod?"
 */

import type { SystemUnit, PrimitiveId } from "./system-units.js";
import type { ScopeUnit } from "./scope-metrics.js";

/** Answers: "What does this mod do?" — systems and primitives only. */
export type Capability = {
  systems: SystemUnit[];
  primitives: PrimitiveId[];
};

/** Answers: "How big is this mod?" — scope units and credit totals only. */
export type ScopeCosting = {
  scopeUnits: ScopeUnit[];
  totalCredits: number;
  fitsBudget: boolean;
};
