/**
 * Behavior intelligence pipeline. Behavior MUST exist for every item/block.
 * Dangerous/magical/machine/sentient/radioactive/melting/corrupting ALWAYS manifest behaviorally.
 * No empty behavior plans. No cosmetic-only items. DATA ONLY — no Fabric code yet.
 */

import type { SemanticTag } from "../item-block-primitives.js";
import type { GameplayTraits } from "../item-block-primitives.js";

export type TickBehavior = {
  id: string;
  cause: string;
  intervalTicks: number;
  effect: string;
  condition?: string;
};

export type InteractionBehavior = {
  id: string;
  trigger: "right_click" | "left_click" | "use";
  cause: string;
  effect: string;
  cooldownTicks?: number;
};

export type AreaEffect = {
  id: string;
  cause: string;
  radius: number;
  effect: string;
  durationTicks?: number;
};

export type StateMachine = {
  id: string;
  cause: string;
  states: string[];
  transitions: { from: string; to: string; condition: string }[];
};

export type AIHook = {
  id: string;
  cause: string;
  behavior: string;
  priority: number;
};

export type BehaviorPlan = {
  tickBehaviors: TickBehavior[];
  interactionBehaviors: InteractionBehavior[];
  areaEffects: AreaEffect[];
  stateMachines: StateMachine[];
  aiHooks: AIHook[];
  invariants: string[];
};

function tagsInclude(tags: SemanticTag[], ...values: string[]): boolean {
  const set = new Set(tags.map((t) => (typeof t === "string" ? t.toLowerCase() : "")));
  return values.some((v) => set.has(v.toLowerCase()));
}

function promptIncludes(prompt: string, ...values: string[]): boolean {
  const lower = prompt.toLowerCase();
  return values.some((v) => lower.includes(v.toLowerCase()));
}

/**
 * Synthesize behavior plan from semantic tags, kind, gameplay traits, prompt.
 * No empty plans. Every behavior references a semantic cause.
 */
export function synthesizeBehavior(input: {
  semanticTags: SemanticTag[];
  interpretedKind: "item" | "block";
  gameplayTraits: GameplayTraits;
  prompt: string;
}): BehaviorPlan {
  const { semanticTags, interpretedKind, gameplayTraits, prompt } = input;

  const tickBehaviors: TickBehavior[] = [];
  const interactionBehaviors: InteractionBehavior[] = [];
  const areaEffects: AreaEffect[] = [];
  const stateMachines: StateMachine[] = [];
  const aiHooks: AIHook[] = [];
  const invariants: string[] = ["behavior_exists", "semantic_cause"];

  const idBase = "gen_" + (prompt.replace(/\s+/g, "_").slice(0, 20) || "item");

  if (tagsInclude(semanticTags, "dangerous") || tagsInclude(semanticTags, "radioactive")) {
    areaEffects.push({
      id: `${idBase}_area`,
      cause: "radioactive_or_dangerous",
      radius: 3,
      effect: "status_effect",
      durationTicks: 100,
    });
    invariants.push("dangerous_manifests");
  }

  if (tagsInclude(semanticTags, "magical")) {
    interactionBehaviors.push({
      id: `${idBase}_use`,
      trigger: "right_click",
      cause: "magical",
      effect: "particle_effect",
      cooldownTicks: 20,
    });
    invariants.push("magical_manifests");
  }

  if (promptIncludes(prompt, "melt", "melts", "melting")) {
    tickBehaviors.push({
      id: `${idBase}_melt`,
      cause: "melting",
      intervalTicks: 40,
      effect: "transform_over_time",
      condition: "exposed_to_heat",
    });
    invariants.push("melting_has_tick");
  }

  if (promptIncludes(prompt, "ice cream") || (tagsInclude(semanticTags, "cold") && tagsInclude(semanticTags, "food"))) {
    tickBehaviors.push({
      id: `${idBase}_melt`,
      cause: "ice_cream_melts",
      intervalTicks: 60,
      effect: "decay_or_transform",
      condition: "warm_biome",
    });
  }

  if (promptIncludes(prompt, "sentient", "alive", "conscious") || tagsInclude(semanticTags, "magical")) {
    aiHooks.push({
      id: `${idBase}_ai`,
      cause: "sentient_or_magical",
      behavior: "idle_awareness",
      priority: 1,
    });
    stateMachines.push({
      id: `${idBase}_sm`,
      cause: "sentient",
      states: ["idle", "active", "cooldown"],
      transitions: [
        { from: "idle", to: "active", condition: "player_near" },
        { from: "active", to: "cooldown", condition: "after_effect" },
        { from: "cooldown", to: "idle", condition: "ticks_elapsed" },
      ],
    });
    invariants.push("sentient_has_ai");
  }

  if (promptIncludes(prompt, "machine", "ancient machine") || tagsInclude(semanticTags, "technological")) {
    tickBehaviors.push({
      id: `${idBase}_tick`,
      cause: "machine_ticking",
      intervalTicks: 20,
      effect: "inventory_or_activation",
    });
    interactionBehaviors.push({
      id: `${idBase}_activate`,
      trigger: "right_click",
      cause: "machine_activation",
      effect: "run_logic",
      cooldownTicks: 40,
    });
    invariants.push("machine_has_logic");
  }

  if (promptIncludes(prompt, "corrupt", "corrupting")) {
    areaEffects.push({
      id: `${idBase}_corrupt`,
      cause: "corrupting",
      radius: 2,
      effect: "block_entity_transform",
      durationTicks: 200,
    });
  }

  if (gameplayTraits.food) {
    interactionBehaviors.push({
      id: `${idBase}_consume`,
      trigger: "use",
      cause: "edible",
      effect: "consume_restore_hunger",
    });
  }

  if (gameplayTraits.weapon) {
    interactionBehaviors.push({
      id: `${idBase}_attack`,
      trigger: "left_click",
      cause: "weapon",
      effect: "damage_entity",
    });
  }

  if (interpretedKind === "block" && gameplayTraits.block) {
    interactionBehaviors.push({
      id: `${idBase}_place`,
      trigger: "right_click",
      cause: "block_placement",
      effect: "place_block",
    });
  }

  if (
    tickBehaviors.length === 0 &&
    interactionBehaviors.length === 0 &&
    areaEffects.length === 0 &&
    aiHooks.length === 0
  ) {
    tickBehaviors.push({
      id: `${idBase}_passive`,
      cause: "passive_flavor",
      intervalTicks: 100,
      effect: "ambient_particle",
    });
    invariants.push("passive_flavor_fallback");
  }

  return {
    tickBehaviors,
    interactionBehaviors,
    areaEffects,
    stateMachines,
    aiHooks,
    invariants,
  };
}
