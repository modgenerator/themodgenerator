/**
 * Intent → Scope Expansion. Full implied content; never minimize to fit credits.
 * Same intent → same scope array (deterministic).
 *
 * HARD GUARANTEE:
 * - User intent is NEVER rejected.
 * - All requested functionality is planned and generated.
 * - Credits are economic only; they never disable features.
 * - If over budget, the mod is still fully generated.
 * - Budget only affects whether the user can download without upgrading.
 */

import type { ScopeUnit } from "./scope-metrics.js";
import type { UserIntent } from "./execution-plan.js";

/**
 * Expand user intent to the full set of scope units implied by the request.
 * Do not reduce scope to fit budget; always expand to full implied content.
 */
export function expandIntentToScope(intent: UserIntent): ScopeUnit[] {
  const name = (intent.name ?? "").toLowerCase().trim();
  const desc = (intent.description ?? "").toLowerCase().trim();
  const combined = `${name} ${desc}`;
  const category = intent.category;
  const units: ScopeUnit[] = [];

  // Base content by category
  if (category === "item") {
    units.push("item");
  } else if (category === "block") {
    units.push("block");
  } else if (category === "entity") {
    units.push("entity");
  } else {
    units.push("item");
  }

  // ---- Item/block behavior (use, shoot, cast, etc.) — aligned with planner semantics ----
  const hasBehavior =
    /\b(shoots?|shoot|casts?|cast)\s*lightning\b/.test(combined) ||
    /\blightning\s*(bolt|strike|attack)\b/.test(combined) ||
    (/\blightning\b/.test(combined) && /\b(wand|staff|rod|item)\b/.test(combined)) ||
    /\b(magic|magical)\s*wand\b/.test(combined) ||
    (/\bwand\b/.test(combined) && (/\bshoot|cast|use\b/.test(combined) || desc.length > 0)) ||
    /\b(fire|flame|burn|burning)\b/.test(combined) ||
    /\b(heal|healing|potion|restore)\b/.test(combined) ||
    /\b(glowing|glow|emissive)\s*block\b/.test(combined) ||
    /\bblock\s*that\s*glows?\b/.test(combined) ||
    /\bteleport\b/.test(combined) ||
    /\b(use|right-?click|activates?)\b/.test(combined) ||
    /\bspell(s?)\b/.test(combined) ||
    /\bcast(s?)\b/.test(combined) ||
    (/\bmagic\b/.test(combined) && category === "item") ||
    /\bchain(s?|ing)?\b/.test(combined) ||
    /\bexplosion\b/.test(combined) ||
    /\bexplode(s?)\b/.test(combined);

  if (category === "item" && hasBehavior) {
    units.push("item_behavior");
  }
  if (category === "block" && hasBehavior) {
    units.push("block_behavior");
  }

  // Lightning / spell / projectile / spawn entity → entity scope
  if (
    /\b(shoots?|shoot|casts?|cast)\s*lightning\b/.test(combined) ||
    /\blightning\s*(bolt|strike|attack)\b/.test(combined) ||
    (/\blightning\b/.test(combined) && /\b(wand|staff|rod)\b/.test(combined)) ||
    /\bspawn\s*entity\b/.test(combined) ||
    /\bspell(s?)\b/.test(combined) ||
    (/\bcast(s?)\b/.test(combined) && category === "item")
  ) {
    units.push("entity");
  }

  // ---- Dimension / world scope (from description/prompt) ----
  if (
    /\b(new\s+)?dimension\b/.test(combined) ||
    /\bcustom\s+world\b/.test(combined) ||
    /\bseparate\s+world\b/.test(combined)
  ) {
    units.push("dimension");
    units.push("biome");
    units.push("structure");
    units.push("entity");
    units.push("world_rule");
  }

  // RPG / quests / NPCs
  if (
    /\brpg\b/.test(combined) ||
    /\bquests?\b/.test(combined) ||
    /\bquest\s+line\b/.test(combined) ||
    /\bnpcs?\b/.test(combined) ||
    /\bvillagers?\b/.test(combined) ||
    /\bcharacters?\b/.test(combined)
  ) {
    units.push("dimension");
    units.push("biome");
    units.push("npc");
    units.push("quest");
    units.push("structure");
    units.push("entity");
    units.push("world_rule");
  }

  // Standalone biome/structure mentions
  if (/\b(biome|biomes)\b/.test(combined) && !units.includes("biome")) {
    units.push("biome");
  }
  if (/\b(structure|structures)\b/.test(combined) && !units.includes("structure")) {
    units.push("structure");
  }
  if (/\b(entity|entities|mob|mobs)\b/.test(combined) && !units.includes("entity")) {
    units.push("entity");
  }
  if (/\b(ai|behavior)\s*(for|of)\s*(mob|entity)/.test(combined) || /\bcustom\s+ai\b/.test(combined)) {
    units.push("entity_ai");
  }

  return units;
}

/**
 * Expand a raw prompt (e.g. job prompt) to scope units when it describes the whole mod.
 * Use this for "global" intent in addition to per-item intents.
 */
export function expandPromptToScope(prompt: string): ScopeUnit[] {
  return expandIntentToScope({
    name: "",
    description: prompt,
    category: "item",
  });
}
