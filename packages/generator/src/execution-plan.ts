/**
 * Deterministic Execution Planner — Plane 3.
 * UserIntent → SystemUnits → Primitives → ExecutionPlan.
 * No rejection; unknown → minimal systems (interaction only). Same intent → same systems → same primitives.
 *
 * HARD GUARANTEE:
 * - User intent is NEVER rejected.
 * - All requested functionality is planned and generated.
 * - Credits are economic only; they never disable features.
 * - If over budget, the mod is still fully generated.
 * - Budget only affects whether the user can download without upgrading.
 *
 * UNSUPPORTED SYSTEMS (quests, NPCs, worldgen, dimensions):
 * - Record intent in execution plan and scope costing
 * - Generate no-op system stubs; DO NOT error
 * - DO NOT invent fake gameplay
 */

import type { Primitive } from "./primitives.js";
import { PRIMITIVE_REGISTRY } from "./primitives.js";
import type { SystemUnit } from "./system-units.js";
import { primitivesFromSystems } from "./system-units.js";
import type { BehaviorPlan } from "./behavior/behavior-intelligence.js";
import type { WorldIntegrationPlan } from "./world/world-integration.js";

export interface UserIntent {
  name: string;
  description?: string;
  category: "item" | "block" | "entity";
  material?: string;
}

/** Texture data (rasterized). Optional; if present, embed. If rasterization fails → scaffold, DO NOT BLOCK. */
export type ExecutionPlanTextureData = {
  inventoryIcon?: { size: number; pixels: Uint8ClampedArray; hash: string };
  blockFace?: { size: number; pixels: Uint8ClampedArray; hash: string };
  emissiveMask?: Uint8ClampedArray;
};

export interface ExecutionPlan {
  primitives: Primitive[];
  explanation: string;
  creditCost: number;
  systems: SystemUnit[];
  upgradePath?: string[];
  futureExpansion?: string[];
  /** Rasterized texture data. Completeness required when generation proceeds. */
  textureData?: ExecutionPlanTextureData;
  /** Behavior plan. Every item/block has behavior. */
  behaviorPlan?: BehaviorPlan;
  /** World integration: recipes, loot, placement. Every item/block has acquisition path. */
  worldIntegration?: WorldIntegrationPlan;
}

/**
 * Deterministic mapping: name + description → system units.
 * No rejection. Unknown intent → minimal systems (interaction only). Same intent → same systems.
 */
export function intentToSystems(intent: UserIntent): SystemUnit[] {
  const name = (intent.name ?? "").toLowerCase().trim();
  const desc = (intent.description ?? "").toLowerCase().trim();
  const combined = `${name} ${desc}`;
  const category = intent.category;
  const systems: SystemUnit[] = [];

  // Base: interaction for any use/click; cooldown when there is behavior.
  // Semantic enrichment: interpret prompts so plans get appropriate systems (no enforcement).
  const hasUse =
    /\b(shoots?|shoot|casts?|cast)\s*lightning\b/.test(combined) ||
    /\blightning\s*(bolt|strike|attack)\b/.test(combined) ||
    (/\blightning\b/.test(combined) && /\b(wand|staff|rod|item)\b/.test(combined)) ||
    /\b(magic|magical)\s*wand\b/.test(combined) ||
    (/\bwand\b/.test(combined) && (/\bshoot|cast|use\b/.test(combined) || desc.length > 0)) ||
    /\b(fire|flame|burn|burning)\b/.test(combined) ||
    /\b(heal|healing|potion|restore)\b/.test(combined) ||
    /\bteleport\b/.test(combined) ||
    /\b(use|right-?click|activates?)\b/.test(combined) ||
    /\bspell(s?)\b/.test(combined) ||
    /\bcast(s?)\b/.test(combined) ||
    (/\bmagic\b/.test(combined) && category === "item") ||
    /\bchain(s?|ing)?\b/.test(combined) ||
    /\bexplosion\b/.test(combined) ||
    /\bexplode(s?)\b/.test(combined);

  if (hasUse || category === "item") {
    systems.push("interaction");
  }

  // Lightning / magic wand shoot → targeting, chaining, cooldown
  if (
    /\b(shoots?|shoot|casts?|cast)\s*lightning\b/.test(combined) ||
    /\blightning\s*(bolt|strike|attack)\b/.test(combined) ||
    (/\blightning\b/.test(combined) && /\b(wand|staff|rod|item)\b/.test(combined))
  ) {
    systems.push("targeting", "chaining", "cooldown");
  }
  // Magic wand with use (no explicit lightning)
  else if (/\b(magic|magical)\s*wand\b/.test(combined) || (/\bwand\b/.test(combined) && (/\bshoot|cast|use\b/.test(combined) || desc.length > 0))) {
    systems.push("targeting", "projectile", "cooldown");
  }
  // Fire / flame / burns / explosion
  else if (/\b(fire|flame|burn|burning)\b/.test(combined) && category === "item") {
    systems.push("targeting", "chaining", "cooldown");
  }
  else if (/\bexplosion\b/.test(combined) || /\bexplode(s?)\b/.test(combined)) {
    systems.push("targeting", "area_effect", "cooldown");
  }
  // Spell / cast (generic) → status or projectile
  else if (/\bspell(s?)\b/.test(combined) || (/\bcast(s?)\b/.test(combined) && !/\blightning\b/.test(combined))) {
    systems.push("status_effect", "cooldown");
  }
  // Chain (e.g. chain lightning, chain effect) without lightning branch
  else if (/\bchain(s?|ing)?\b/.test(combined) && category === "item") {
    systems.push("targeting", "chaining", "cooldown");
  }
  // Healing / potion
  else if (/\b(heal|healing|potion|restore)\b/.test(combined)) {
    systems.push("status_effect", "cooldown");
  }
  // Generic magic item (no wand)
  else if (/\bmagic\b/.test(combined) && category === "item") {
    systems.push("targeting", "projectile", "cooldown");
  }
  // Glowing block
  else if (/\b(glowing|glow|emissive)\s*block\b/.test(combined) || /\bblock\s*that\s*glows?\b/.test(combined)) {
    if (category === "block") {
      systems.push("interaction"); // particle_effect from interaction context; add minimal
    }
  }
  // Teleport
  else if (/\bteleport\b/.test(combined)) {
    systems.push("movement", "cooldown");
  }
  // Generic use
  else if (/\b(use|right-?click|activates?)\b/.test(combined) && category === "item") {
    systems.push("cooldown");
  }

  // Unknown or minimal: interaction only (already added above for item)
  if (systems.length === 0 && category === "block") {
    systems.push("interaction");
  }

  return systems;
}

/**
 * Derive upgradePath and futureExpansion from systems (informational only).
 */
function deriveProgressionHooks(systems: SystemUnit[]): { upgradePath: string[]; futureExpansion: string[] } {
  const upgradePath: string[] = [];
  const futureExpansion: string[] = [];
  if (systems.includes("chaining")) {
    upgradePath.push("Can later add multi-target or chain bounce");
    futureExpansion.push("Multi-target upgrades");
  }
  if (systems.includes("projectile")) {
    futureExpansion.push("Different projectile types or trajectories");
  }
  if (systems.includes("status_effect")) {
    futureExpansion.push("Additional effects or duration tiers");
  }
  if (systems.includes("quest_logic")) {
    upgradePath.push("Can later add branching paths and rewards");
    futureExpansion.push("Branching quest paths");
  }
  if (systems.includes("npc_logic")) {
    futureExpansion.push("Dialogue and behavior trees");
  }
  if (systems.includes("world_generation")) {
    futureExpansion.push("More structures or biomes");
  }
  return { upgradePath, futureExpansion };
}

/**
 * Deterministic mapping: UserIntent → SystemUnits → Primitives → ExecutionPlan.
 * No rejection. Unknown intent → minimal valid behavior (interaction only).
 */
export function planFromIntent(intent: UserIntent): ExecutionPlan {
  const category = intent.category;
  const systems = intentToSystems(intent);

  const base: Primitive[] =
    category === "item" ? ["register_item"] : category === "block" ? ["register_block"] : ["register_item"];
  const systemPrimitives = primitivesFromSystems(systems);
  const seen = new Set<Primitive>(base);
  const primitives: Primitive[] = [...base];
  for (const p of systemPrimitives) {
    if (!seen.has(p)) {
      seen.add(p);
      primitives.push(p);
    }
  }
  // Passive glowing block: no system gives particle_effect alone; preserve existing behavior.
  const combined = `${(intent.name ?? "").toLowerCase().trim()} ${(intent.description ?? "").toLowerCase().trim()}`;
  if (
    category === "block" &&
    (/\b(glowing|glow|emissive)\s*block\b/.test(combined) || /\bblock\s*that\s*glows?\b/.test(combined)) &&
    !primitives.includes("particle_effect")
  ) {
    primitives.push("particle_effect");
  }

  const creditCost = primitives.reduce((sum, p) => sum + (PRIMITIVE_REGISTRY[p]?.creditCost ?? 0), 0);
  const explanation = buildExplanation(primitives, category);
  const { upgradePath, futureExpansion } = deriveProgressionHooks(systems);

  return {
    primitives,
    explanation,
    creditCost,
    systems,
    upgradePath: upgradePath.length > 0 ? upgradePath : undefined,
    futureExpansion: futureExpansion.length > 0 ? futureExpansion : undefined,
  };
}

function buildExplanation(primitives: Primitive[], category: string): string {
  const parts: string[] = [];
  if (primitives.includes("register_item")) parts.push("Register item");
  if (primitives.includes("register_block")) parts.push("Register block");
  if (primitives.includes("on_use")) parts.push("Right-click use");
  if (primitives.includes("raycast_target")) parts.push("Target raycast");
  if (primitives.includes("spawn_entity")) parts.push("Spawn entity (e.g. lightning)");
  if (primitives.includes("apply_damage")) parts.push("Apply damage");
  if (primitives.includes("apply_status_effect")) parts.push("Apply status effect");
  if (primitives.includes("particle_effect")) parts.push("Particles");
  if (primitives.includes("sound_effect")) parts.push("Sound");
  if (primitives.includes("cooldown")) parts.push("Cooldown");
  return parts.length > 0 ? parts.join("; ") : "Minimal " + category;
}

/**
 * Credit cost = sum of primitive creditCost. Stable for identical plan.
 */
export function calculateCredits(plan: ExecutionPlan): number {
  return plan.primitives.reduce((sum, p) => sum + (PRIMITIVE_REGISTRY[p]?.creditCost ?? 0), 0);
}
