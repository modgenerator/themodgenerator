/**
 * Scope-Based Credit System — Content Surface Accounting.
 * Scope units represent how much of Minecraft is being modified.
 * Credits scale with scope (and count), NOT with visual quality or feature blocking.
 */

export type ScopeUnit =
  | "item"
  | "block"
  | "item_behavior"
  | "block_behavior"
  | "entity"
  | "entity_ai"
  | "biome"
  | "structure"
  | "dimension"
  | "npc"
  | "quest"
  | "world_rule";

export interface ScopeCost {
  unit: ScopeUnit;
  credits: number;
}

/** Baseline credit cost per scope unit. Costs stack by count (unit × quantity). */
export const SCOPE_COSTS: Record<ScopeUnit, number> = {
  item: 5,
  block: 5,
  item_behavior: 10,
  block_behavior: 10,
  entity: 20,
  entity_ai: 20,
  biome: 30,
  structure: 30,
  dimension: 100,
  npc: 30,
  quest: 40,
  world_rule: 15,
};

/** Human-readable label for each scope unit (for scopeSummary). */
export const SCOPE_UNIT_LABELS: Record<ScopeUnit, string> = {
  item: "Items",
  block: "Blocks",
  item_behavior: "Item behavior",
  block_behavior: "Block behavior",
  entity: "Entities",
  entity_ai: "Entity AI",
  biome: "Biomes",
  structure: "Structures",
  dimension: "Dimension",
  npc: "NPCs",
  quest: "Quests",
  world_rule: "World rules",
};
