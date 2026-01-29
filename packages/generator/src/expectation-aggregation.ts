/**
 * Aggregated Expectation Contract — Describes the entire mod from an AggregatedExecutionPlan.
 * whatItDoes from aggregated systems; howYouUseIt from interaction primitives;
 * limits only for missing systems; scalesWithCredits from futureExpansion union.
 * No reference to specific items; no credits as limits. Contract describes the whole mod.
 */

import type { ExpectationContract } from "./expectation-contract.js";
import type { AggregatedExecutionPlan } from "./plan-aggregation.js";
import { SYSTEM_REGISTRY } from "./system-units.js";
/**
 * Build expectation contract from aggregated execution plan.
 * whatItDoes: from aggregated systems (SYSTEM_REGISTRY explanations).
 * howYouUseIt: union of interaction-related usage from primitives.
 * limits: only include limits for systems that are NOT in the aggregate.
 * scalesWithCredits: union of plan.futureExpansion entries (no credits-as-limits language).
 */
export function buildAggregatedExpectationContract(
  plan: AggregatedExecutionPlan
): ExpectationContract {
  const whatItDoes: string[] = [];
  for (const sys of plan.systems) {
    const def = SYSTEM_REGISTRY[sys];
    if (def) whatItDoes.push(def.explanation);
  }
  if (whatItDoes.length === 0) {
    whatItDoes.push("Registers items and blocks with no special behavior");
  }

  const howYouUseIt: string[] = [];
  if (plan.primitives.includes("on_use")) {
    howYouUseIt.push("Right-click (or use key) to activate");
  }
  if (plan.primitives.includes("raycast_target")) {
    howYouUseIt.push("Aim at a target; effect applies where you look");
  }
  if (plan.primitives.includes("cooldown")) {
    howYouUseIt.push("Has a cooldown between uses");
  }
  if (howYouUseIt.length === 0) {
    howYouUseIt.push("Hold in inventory or place (block); no use action");
  }

  const limits: string[] = [];
  if (!plan.primitives.includes("spawn_entity")) {
    limits.push("Does not spawn entities");
  }
  if (!plan.primitives.includes("apply_damage")) {
    limits.push("Does not deal damage");
  }
  if (!plan.primitives.includes("apply_status_effect")) {
    limits.push("Does not apply status effects");
  }
  if (!plan.primitives.includes("area_of_effect")) {
    limits.push("No area-of-effect");
  }
  if (!plan.systems.includes("quest_logic") && !plan.systems.includes("npc_logic")) {
    limits.push("No quest or NPC logic");
  }
  if (!plan.systems.includes("world_generation")) {
    limits.push("No custom world generation");
  }
  if (limits.length === 0) {
    limits.push("Behavior is limited to what is listed above");
  }

  const scalesWithCredits: string[] = [];
  for (const entry of plan.futureExpansion ?? []) {
    const t = entry.trim();
    if (t) scalesWithCredits.push(t);
  }
  scalesWithCredits.push("More credits allow more items, blocks, and entities in one mod");

  return {
    whatItDoes,
    howYouUseIt,
    limits,
    scalesWithCredits,
  };
}
