import { describe, it } from "node:test";
import assert from "node:assert";
import { planToModSpec } from "./plan-to-spec.js";
import type { PlanSpec } from "@themodgenerator/spec";
import { expandSpecTier1 } from "@themodgenerator/spec";

describe("planToModSpec", () => {
  it("wood type Maple: spec.woodTypes has maple, expands to maple_* family", () => {
    const plan: PlanSpec = {
      intent: "add_wood_type",
      entities: { woodTypes: ["Maple"] },
      impliedSystems: ["recipes"],
      constraints: {},
      defaultsApplied: [],
    };
    const spec = planToModSpec(plan);
    assert.ok(Array.isArray(spec.woodTypes) && spec.woodTypes!.length === 1);
    assert.strictEqual(spec.woodTypes![0].id, "maple");
    assert.strictEqual(spec.woodTypes![0].displayName, "Maple");
    assert.strictEqual(spec.modName, "Maple Mod");
    const expanded = expandSpecTier1(spec);
    const woodIds = [...expanded.items.map((i) => i.id), ...expanded.blocks.map((b) => b.id)].filter((id) =>
      id.startsWith("maple_")
    );
    assert.ok(woodIds.includes("maple_log"));
    assert.ok(woodIds.includes("maple_planks"));
    assert.ok(woodIds.includes("maple_boat"));
  });

  it("wood type Maple + noBlocks: no woodTypes added", () => {
    const plan: PlanSpec = {
      intent: "add_wood_type",
      entities: { woodTypes: ["Maple"] },
      impliedSystems: [],
      constraints: { noBlocks: true },
      defaultsApplied: [],
    };
    const spec = planToModSpec(plan);
    assert.strictEqual(spec.woodTypes?.length ?? 0, 0);
  });

  it("ores Tin and Silver: items raw_tin, tin_ingot, raw_silver, silver_ingot; blocks; smelting when implied", () => {
    const plan: PlanSpec = {
      intent: "add_ores",
      entities: { ores: ["Tin", "Silver"] },
      impliedSystems: ["smelting", "worldgen"],
      constraints: {},
      defaultsApplied: [],
    };
    const spec = planToModSpec(plan);
    const itemIds = (spec.items ?? []).map((i) => i.id);
    assert.ok(itemIds.includes("raw_tin"));
    assert.ok(itemIds.includes("tin_ingot"));
    assert.ok(itemIds.includes("raw_silver"));
    assert.ok(itemIds.includes("silver_ingot"));
    const blockIds = (spec.blocks ?? []).map((b) => b.id);
    assert.ok(blockIds.includes("tin_ore"));
    assert.ok(blockIds.includes("deepslate_tin_ore"));
    assert.ok(blockIds.includes("silver_ore"));
    const recipeIds = (spec.recipes ?? []).map((r) => r.id);
    assert.ok(recipeIds.includes("tin_ingot_from_raw"));
    assert.ok(recipeIds.includes("silver_ingot_from_raw"));
  });

  it("loads of ores Tin/Silver with noRecipes: no smelting recipes", () => {
    const plan: PlanSpec = {
      intent: "add_ores",
      entities: { ores: ["Tin", "Silver"] },
      impliedSystems: ["smelting", "worldgen"],
      constraints: { noRecipes: true },
      defaultsApplied: [],
    };
    const spec = planToModSpec(plan);
    assert.strictEqual((spec.recipes ?? []).length, 0);
    assert.ok(spec.constraints?.noRecipes === true);
  });

  it("add_items Ruby, Sapphire: spec.items only", () => {
    const plan: PlanSpec = {
      intent: "add_items",
      entities: { items: ["Ruby", "Sapphire"] },
      impliedSystems: [],
      constraints: {},
      defaultsApplied: [],
    };
    const spec = planToModSpec(plan);
    assert.strictEqual((spec.items ?? []).length, 2);
    assert.strictEqual(spec.items![0].id, "ruby");
    assert.strictEqual(spec.items![1].id, "sapphire");
  });
});
