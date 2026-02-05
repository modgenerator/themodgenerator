/**
 * Deterministic mapping from PlanSpec (planner/LLM output) to ModSpecV1.
 * No model calls; schema-validated PlanSpec only.
 */

import type { ModSpecV1, PlanSpec, WoodType } from "@themodgenerator/spec";
import { SUPPORTED_MINECRAFT_VERSION, SUPPORTED_LOADER } from "@themodgenerator/spec";

const MOD_ID = "generated";
const MAX_ID_LEN = 32;

function slug(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, MAX_ID_LEN) || "item";
  return /^[a-z]/.test(s) ? s : "m_" + s;
}

function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ")
    .slice(0, 48) || "Item";
}

/**
 * Map PlanSpec to ModSpecV1. Deterministic and testable.
 * - add_wood_type + entities.woodTypes -> spec.woodTypes (respect noBlocks / noRecipes)
 * - add_ores + entities.ores -> items (raw_*, *_ingot), blocks (*_ore, deepslate_*_ore), smelting if implied
 * - add_items / add_blocks -> items / blocks arrays
 */
export function planToModSpec(plan: PlanSpec): ModSpecV1 {
  const constraints = plan.constraints ?? {};
  const noBlocks = constraints.noBlocks === true;
  const noRecipes = constraints.noRecipes === true;
  const spec: ModSpecV1 = {
    schemaVersion: 1,
    minecraftVersion: SUPPORTED_MINECRAFT_VERSION,
    loader: SUPPORTED_LOADER,
    modId: MOD_ID,
    modName: "Generated Mod",
    features: ["hello-world"],
    items: [],
    blocks: [],
    recipes: [],
    ...(noRecipes && { constraints: { noRecipes: true } }),
  };

  const entities = plan.entities ?? {};
  const intent = (plan.intent ?? "").toLowerCase();

  // Wood types: only if intent matches and noBlocks is false
  if (
    (intent.includes("wood") || intent.includes("wood_type")) &&
    Array.isArray(entities.woodTypes) &&
    entities.woodTypes.length > 0 &&
    !noBlocks
  ) {
    spec.woodTypes = entities.woodTypes.map((name) => {
      const id = slug(name);
      return { id, displayName: titleCase(name) } as WoodType;
    });
    const first = spec.woodTypes[0];
    if (first) spec.modName = `${first.displayName} Mod`;
  }

  // Ores: raw/ingot/ore/deepslate + smelting when impliedSystems includes smelting
  const impliedSystems = new Set((plan.impliedSystems ?? []).map((s) => s.toLowerCase()));
  if (
    (intent.includes("ore") || intent.includes("ores")) &&
    Array.isArray(entities.ores) &&
    entities.ores.length > 0
  ) {
    for (const name of entities.ores) {
      const base = slug(name);
      if (!base) continue;
      const displayName = titleCase(name);
      if (!noBlocks) {
        spec.blocks = spec.blocks ?? [];
        spec.blocks.push(
          { id: `${base}_ore`, name: `${displayName} Ore` },
          { id: `deepslate_${base}_ore`, name: `Deepslate ${displayName} Ore` }
        );
      }
      spec.items = spec.items ?? [];
      spec.items.push(
        { id: `raw_${base}`, name: `Raw ${displayName}` },
        { id: `${base}_ingot`, name: `${displayName} Ingot` }
      );
      if (!noRecipes && impliedSystems.has("smelting")) {
        spec.recipes = spec.recipes ?? [];
        spec.recipes.push({
          id: `${base}_ingot_from_raw`,
          type: "smelting",
          ingredients: [{ id: `raw_${base}`, count: 1 }],
          result: { id: `${base}_ingot`, count: 1 },
        });
      }
    }
    const firstOre = entities.ores[0];
    if (firstOre && !spec.woodTypes?.length) spec.modName = `${titleCase(firstOre)} Mod`;
  }

  // Simple items
  if (Array.isArray(entities.items) && entities.items.length > 0) {
    for (const name of entities.items) {
      const id = slug(name);
      if (id) {
        spec.items = spec.items ?? [];
        if (!spec.items.some((i) => i.id === id)) {
          spec.items.push({ id, name: titleCase(name) });
        }
      }
    }
    if (!spec.woodTypes?.length && !entities.ores?.length && entities.items[0]) {
      spec.modName = `${titleCase(entities.items[0])} Mod`;
    }
  }

  // Simple blocks (only if noBlocks is false)
  if (!noBlocks && Array.isArray(entities.blocks) && entities.blocks.length > 0) {
    for (const name of entities.blocks) {
      const base = slug(name);
      if (!base) continue;
      const blockId = base.endsWith("_block") ? base : `${base}_block`;
      spec.blocks = spec.blocks ?? [];
      if (!spec.blocks.some((b) => b.id === blockId)) {
        spec.blocks.push({
          id: blockId,
          name: /block$/i.test(name.trim()) ? titleCase(name) : `${titleCase(name)} Block`,
        });
      }
    }
  }

  return spec;
}
