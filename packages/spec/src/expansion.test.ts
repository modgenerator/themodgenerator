/**
 * Expansion determinism: same spec → identical ExpandedSpecTier1 (deep equality).
 * Pure function test; no Tier 2 branching.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import type { ModSpecV1 } from "./types.js";
import { expandSpecTier1 } from "./expansion.js";

function minimalSpec(overrides: Partial<ModSpecV1> = {}): ModSpecV1 {
  return {
    schemaVersion: 1,
    minecraftVersion: "1.21.1",
    loader: "fabric",
    modId: "test_mod",
    modName: "Test Mod",
    features: ["hello-world"],
    ...overrides,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe("expandSpecTier1", () => {
  it("same spec yields identical ExpandedSpecTier1 (deep equality)", () => {
    const spec = minimalSpec({
      items: [{ id: "ruby", name: "Ruby" }],
      blocks: [{ id: "ruby_block", name: "Block of Ruby" }],
    });
    const a = expandSpecTier1(spec);
    const b = expandSpecTier1(spec);
    assert.ok(deepEqual(a, b), "expandSpecTier1(spec) must be deterministic");
    assert.strictEqual(a.descriptors.length, b.descriptors.length);
    assert.strictEqual(a.descriptors[0].type, "handheld_item");
    assert.strictEqual(a.descriptors[1].type, "cube_block");
  });

  it("descriptor order is stable: items then blocks", () => {
    const spec = minimalSpec({
      items: [{ id: "a", name: "A" }],
      blocks: [{ id: "b", name: "B" }],
    });
    const expanded = expandSpecTier1(spec);
    assert.strictEqual(expanded.descriptors.length, 2);
    assert.strictEqual(expanded.descriptors[0].type, "handheld_item");
    assert.strictEqual(expanded.descriptors[0].contentId, "a");
    assert.strictEqual(expanded.descriptors[1].type, "cube_block");
    assert.strictEqual(expanded.descriptors[1].contentId, "b");
  });

  it("woodTypes expand to full wood family items and blocks", () => {
    const spec = minimalSpec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const woodBlockIds = expanded.blocks.map((b) => b.id).filter((id) => id.startsWith("maple_"));
    const woodItemIds = expanded.items.map((i) => i.id).filter((id) => id.startsWith("maple_"));
    assert.ok(woodBlockIds.includes("maple_log"));
    assert.ok(woodBlockIds.includes("maple_planks"));
    assert.ok(woodBlockIds.includes("maple_stairs"));
    assert.ok(woodItemIds.includes("maple_log"));
    assert.ok(woodItemIds.includes("maple_boat"));
    assert.strictEqual(expanded.descriptors.filter((d) => d.type === "handheld_item").length, expanded.items.length);
    assert.strictEqual(expanded.descriptors.filter((d) => d.type === "cube_block").length, expanded.blocks.length);
  });

  it("woodTypes add vanilla-style recipes (log→planks, stairs, slab, boat, chest_boat, etc.)", () => {
    const spec = minimalSpec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const recipeIds = (expanded.spec.recipes ?? []).map((r) => r.id);
    assert.ok(recipeIds.includes("maple_planks_from_log"));
    assert.ok(recipeIds.includes("sticks_from_maple_planks"));
    assert.ok(recipeIds.includes("crafting_table_from_maple_planks"));
    assert.ok(recipeIds.includes("chest_from_maple_planks"));
    assert.ok(recipeIds.includes("maple_stairs"));
    assert.ok(recipeIds.includes("maple_slab"));
    assert.ok(recipeIds.includes("maple_fence"));
    assert.ok(recipeIds.includes("maple_fence_gate"));
    assert.ok(recipeIds.includes("maple_door"));
    assert.ok(recipeIds.includes("maple_trapdoor"));
    assert.ok(recipeIds.includes("maple_button"));
    assert.ok(recipeIds.includes("maple_pressure_plate"));
    assert.ok(recipeIds.includes("maple_sign"));
    assert.ok(recipeIds.includes("maple_hanging_sign"));
    assert.ok(recipeIds.includes("maple_boat"));
    assert.ok(recipeIds.includes("maple_chest_boat"));
  });

  it("woodTypes expansion yields full maple_* family (log, wood, stripped, planks, stairs, slab, fence, door, boat, etc.)", () => {
    const spec = minimalSpec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const allIds = [...expanded.items.map((i) => i.id), ...expanded.blocks.map((b) => b.id)];
    const expected = [
      "maple_log",
      "maple_wood",
      "maple_stripped_log",
      "maple_stripped_wood",
      "maple_planks",
      "maple_stairs",
      "maple_slab",
      "maple_fence",
      "maple_fence_gate",
      "maple_door",
      "maple_trapdoor",
      "maple_button",
      "maple_pressure_plate",
      "maple_sign",
      "maple_hanging_sign",
      "maple_boat",
      "maple_chest_boat",
    ];
    for (const id of expected) {
      assert.ok(allIds.includes(id), `expansion must include ${id}`);
    }
  });

  it("woodTypes with constraints.noRecipes: blocks/items created but no wood recipes added", () => {
    const spec = minimalSpec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
      constraints: { noRecipes: true },
    });
    const expanded = expandSpecTier1(spec);
    assert.ok(expanded.items.some((i) => i.id.startsWith("maple_")), "items still include maple_*");
    assert.ok(expanded.blocks.some((b) => b.id.startsWith("maple_")), "blocks still include maple_*");
    const recipeIds = (expanded.spec.recipes ?? []).map((r) => r.id);
    assert.strictEqual(recipeIds.filter((id) => id.startsWith("maple_")).length, 0, "no wood recipes when noRecipes");
  });
});
