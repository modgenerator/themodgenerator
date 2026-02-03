/**
 * Tests for interpretToSpec: spec shape from prompt (no keyword branches).
 * Verification prompt: cheese block, yellow, craftable from 4 cheese, smeltable to melted cheese.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { interpretToSpec } from "./interpret-to-spec.js";

const VERIFICATION_PROMPT =
  "Add a new block called Cheese Block. It should be yellow, mineable with a pickaxe, " +
  "craftable from 4 cheese items, and smeltable in a furnace into melted cheese.";

describe("interpretToSpec", () => {
  it("verification prompt → proceed with block, items, crafting + smelting recipes, colorHint", () => {
    const result = interpretToSpec(VERIFICATION_PROMPT);
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    assert.strictEqual(spec.blocks?.length, 1, "single block");
    const blockId = spec.blocks![0].id;
    assert.ok(blockId.endsWith("_block"), "block id should end with _block");
    assert.ok(spec.blocks![0].colorHint === "yellow", "block should have yellow colorHint");

    assert.ok(Array.isArray(spec.items) && spec.items!.length >= 1, "at least one item (ingredient or melted)");
    const itemIds = spec.items!.map((i: { id: string }) => i.id);

    assert.ok(Array.isArray(spec.recipes) && spec.recipes!.length >= 1, "at least one recipe");
    const crafting = spec.recipes!.find((r: { type: string }) => r.type === "crafting_shapeless");
    if (crafting) {
      assert.strictEqual(crafting.result.id, blockId, "crafting result is the block");
      assert.ok((crafting.ingredients?.length ?? 0) > 0, "crafting must have ingredients");
      const ingId = crafting.ingredients![0].id;
      assert.ok(itemIds.includes(ingId), "ingredient must be a spec item");
    }
    const smelting = spec.recipes!.find((r: { type: string }) => r.type === "smelting");
    assert.ok(smelting, "must have smelting recipe (prompt says smeltable in furnace)");
    assert.ok(smelting!.result.id.startsWith("melted_"), "smelting result is melted_* item");
    assert.strictEqual(smelting!.ingredients?.[0]?.id, blockId, "smelting ingredient is the block");
    assert.notStrictEqual(smelting!.ingredients?.[0]?.id, smelting!.result.id, "no self-loop");
  });

  it("generic block prompt without craft/smelt → single block, no recipes", () => {
    const result = interpretToSpec("A block called Ruby Ore.");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    assert.strictEqual(result.spec.blocks?.length, 1);
    assert.strictEqual((result.spec.recipes?.length ?? 0), 0);
  });
});
