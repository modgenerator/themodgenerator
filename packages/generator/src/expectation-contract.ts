/**
 * Expectation Contract — User trust layer.
 * Guarantees users know exactly what they are getting before build.
 * No marketing language; no vague wording.
 *
 * HARD GUARANTEE:
 * - User intent is NEVER rejected.
 * - All requested functionality is planned and generated.
 * - Credits are economic only; they never disable features.
 * - If over budget, the mod is still fully generated.
 * - Budget only affects whether the user can download without upgrading.
 */

import type { ExecutionPlan } from "./execution-plan.js";
import { SYSTEM_REGISTRY } from "./system-units.js";

export interface ExpectationContract {
  whatItDoes: string[];
  howYouUseIt: string[];
  limits: string[];
  scalesWithCredits: string[];
}

/**
 * Build expectation contract from execution plan.
 * whatItDoes from systems + primitives; howYouUseIt from interaction; limits = what is NOT included; scalesWithCredits = what higher scope enables.
 */
export function buildExpectationContract(plan: ExecutionPlan): ExpectationContract {
  const whatItDoes: string[] = [];
  for (const sys of plan.systems) {
    const def = SYSTEM_REGISTRY[sys];
    if (def) whatItDoes.push(def.explanation);
  }
  if (whatItDoes.length === 0) {
    whatItDoes.push("Registers the item or block with no special behavior");
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
  if (plan.systems.includes("chaining") || plan.systems.includes("projectile")) {
    scalesWithCredits.push("Higher scope can add multi-target or chain effects");
  }
  if (plan.systems.includes("status_effect")) {
    scalesWithCredits.push("Higher scope can add more effect types or durations");
  }
  if (!plan.systems.includes("quest_logic")) {
    scalesWithCredits.push("More credits enable quests and branching paths");
  }
  if (!plan.systems.includes("world_generation")) {
    scalesWithCredits.push("More credits enable dimensions and structures");
  }
  scalesWithCredits.push("More credits allow more items, blocks, and entities in one mod");

  return {
    whatItDoes,
    howYouUseIt,
    limits,
    scalesWithCredits,
  };
}
