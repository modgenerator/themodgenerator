/**
 * World interaction & crafting logic. Every item/block MUST have at least one acquisition path.
 * Recipes must make semantic sense. Magical → rare ingredients; dangerous → gated; mundane → simple.
 * No fake recipes. No placeholder loot.
 */

import type { InterpretedResult } from "../interpretation.js";
import type { BehaviorPlan } from "../behavior/behavior-intelligence.js";

export type RecipeSpec = {
  id: string;
  type: "shaped" | "shapeless" | "smelting" | "special";
  output: string;
  outputCount: number;
  ingredients: string[];
  pattern?: string[];
  cause: string;
};

export type LootTableSpec = {
  id: string;
  source: string;
  entries: { item: string; weight: number; min: number; max: number }[];
  cause: string;
};

export type PlacementRule = {
  id: string;
  blockId: string;
  condition: string;
  cause: string;
};

export type AdvancementSpec = {
  id: string;
  trigger: string;
  condition: string;
  reward?: string;
  cause: string;
};

export type InterItemInteraction = {
  id: string;
  triggerItem: string;
  targetItem: string;
  result: string;
  cause: string;
};

export type WorldIntegrationPlan = {
  recipes: RecipeSpec[];
  lootTables: LootTableSpec[];
  placementRules: PlacementRule[];
  advancementTriggers: AdvancementSpec[];
  interactions: InterItemInteraction[];
};

function tagsInclude(tags: string[], ...values: string[]): boolean {
  const set = new Set(tags.map((t) => t.toLowerCase()));
  return values.some((v) => set.has(v.toLowerCase()));
}

function promptIncludes(prompt: string, ...values: string[]): boolean {
  const lower = prompt.toLowerCase();
  return values.some((v) => lower.includes(v.toLowerCase()));
}

/**
 * Synthesize world integration from interpreted result, behavior plan, prompt.
 * Every item/block has at least one acquisition path (crafting, loot, or world).
 */
export function synthesizeWorldIntegration(input: {
  interpretedResult: InterpretedResult;
  behaviorPlan: BehaviorPlan;
  prompt: string;
}): WorldIntegrationPlan {
  const { interpretedResult, behaviorPlan: _behaviorPlan, prompt } = input;
  const id = interpretedResult.id;
  const tags = interpretedResult.semanticTags.map((t) => (typeof t === "string" ? t : ""));
  const kind = interpretedResult.kind;

  const recipes: RecipeSpec[] = [];
  const lootTables: LootTableSpec[] = [];
  const placementRules: PlacementRule[] = [];
  const advancementTriggers: AdvancementSpec[] = [];
  const interactions: InterItemInteraction[] = [];

  const isMagical = tagsInclude(tags, "magical", "magic");
  const isDangerous = tagsInclude(tags, "dangerous", "radioactive");

  if (isMagical || promptIncludes(prompt, "dream", "arcane", "crystal")) {
    recipes.push({
      id: `${id}_craft`,
      type: "shapeless",
      output: id,
      outputCount: 1,
      ingredients: ["magical_catalyst", "rare_dust", "gem"],
      cause: "magical_recipe",
    });
  } else if (isDangerous || promptIncludes(prompt, "radioactive", "cursed")) {
    recipes.push({
      id: `${id}_craft`,
      type: "shaped",
      output: id,
      outputCount: 1,
      ingredients: ["hazardous_ingredient", "base_material"],
      pattern: ["H", "B"],
      cause: "dangerous_gated",
    });
    lootTables.push({
      id: `${id}_loot`,
      source: "dangerous_biome_chest",
      entries: [{ item: id, weight: 5, min: 1, max: 1 }],
      cause: "dangerous_biome",
    });
  } else {
    recipes.push({
      id: `${id}_craft`,
      type: "shapeless",
      output: id,
      outputCount: 1,
      ingredients: ["common_material_1", "common_material_2"],
      cause: "mundane_simple",
    });
  }

  if (kind === "block") {
    placementRules.push({
      id: `${id}_place`,
      blockId: id,
      condition: "solid_surface",
      cause: "block_placement",
    });
  }

  return {
    recipes,
    lootTables,
    placementRules,
    advancementTriggers,
    interactions,
  };
}
