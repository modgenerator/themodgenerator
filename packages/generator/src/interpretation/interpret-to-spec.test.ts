/**
 * Tests for interpretToSpec: spec shape from prompt (no keyword branches).
 * Verification prompt: cheese block, yellow, craftable from 4 cheese, smeltable to melted cheese.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { interpretToSpec } from "./interpret-to-spec.js";

const VERIFICATION_PROMPT =
  "Add a new block called Cheese Block. It should be yellow, mineable with a pickaxe, " +
  "craftable from 4 cheese items, and smeltable in a furnace into melted cheese. No tools or weapons.";

describe("interpretToSpec", () => {
  it("verification prompt → proceed with block, items, crafting + smelting recipes, colorHint", () => {
    const result = interpretToSpec(VERIFICATION_PROMPT);
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    assert.strictEqual(spec.blocks?.length, 1, "single block");
    const blockId = spec.blocks![0].id;
    const blockName = spec.blocks![0].name;
    assert.strictEqual(blockId, "cheese_block", "block id must be cheese_block (from displayName slug, not prompt poison)");
    assert.ok(blockId.endsWith("_block"), "block id should end with _block");
    assert.strictEqual(blockName, "Cheese Block", "block displayName must be Cheese Block");
    assert.ok(spec.blocks![0].colorHint === "yellow", "block should have yellow colorHint");

    assert.ok(Array.isArray(spec.items) && spec.items!.length >= 1, "at least one item (ingredient or melted)");
    const itemIds = spec.items!.map((i: { id: string }) => i.id);
    assert.ok(itemIds.includes("cheese"), "must have cheese item (ingredient)");
    assert.ok(itemIds.some((id) => id === "melted_cheese"), "must have melted_cheese item (no melted_red or other poison)");
    const names = spec.items!.map((i: { name: string }) => i.name);
    assert.ok(!names.some((n) => /should i|which direction|conflicting|red_block|melted_red/i.test(n)), "no poison in item names");

    assert.ok(Array.isArray(spec.recipes) && spec.recipes!.length >= 1, "at least one recipe");
    const crafting = spec.recipes!.find((r: { type: string }) => r.type === "crafting_shapeless");
    if (crafting) {
      assert.strictEqual(crafting.result.id, blockId, "crafting result is the block");
      assert.strictEqual(crafting.ingredients?.[0]?.id, "cheese", "crafting ingredient is cheese item");
      assert.strictEqual(crafting.ingredients?.[0]?.count, 4, "craftable from 4 cheese");
      assert.ok((crafting.ingredients?.length ?? 0) > 0, "crafting must have ingredients");
      const ingId = crafting.ingredients![0].id;
      assert.ok(itemIds.includes(ingId), "ingredient must be a spec item");
    }
    const smelting = spec.recipes!.find((r: { type: string }) => r.type === "smelting");
    assert.ok(smelting, "must have smelting recipe (prompt says smeltable in furnace)");
    assert.strictEqual(smelting!.result.id, "melted_cheese", "smelting result must be melted_cheese");
    assert.ok(smelting!.result.id.startsWith("melted_"), "smelting result is melted_* item");
    assert.strictEqual(smelting!.ingredients?.[0]?.id, blockId, "smelting ingredient is the block");
    assert.notStrictEqual(smelting!.ingredients?.[0]?.id, smelting!.result.id, "no self-loop");

    const constraints = (spec as { constraints?: { forbidToolsWeapons?: boolean; requirePickaxeMining?: boolean } }).constraints;
    assert.ok(constraints, "spec should have constraints when prompt mentions pickaxe or no tools");
    assert.strictEqual(constraints?.requirePickaxeMining, true, "prompt says mineable with pickaxe");
    assert.ok(constraints?.forbidToolsWeapons === true, "prompt says no tools or weapons");
  });

  it("generic block prompt without craft/smelt → single block, no recipes", () => {
    const result = interpretToSpec("A block called Ruby Ore.");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    assert.strictEqual(result.spec.blocks?.length, 1);
    assert.strictEqual((result.spec.recipes?.length ?? 0), 0);
  });

  it("Add three items: Ruby, Sapphire, Raw Tin. No blocks. No recipes → 3 items, 0 blocks, 0 recipes", () => {
    const result = interpretToSpec("Add three items: Ruby, Sapphire, Raw Tin. No blocks. No recipes");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    assert.strictEqual(spec.items?.length, 3, "must have exactly 3 items");
    assert.strictEqual(spec.blocks?.length ?? 0, 0, "must have no blocks");
    assert.strictEqual(spec.recipes?.length ?? 0, 0, "must have no recipes");
    const names = spec.items!.map((i: { name: string }) => i.name);
    assert.ok(names.includes("Ruby") && names.includes("Sapphire") && names.includes("Raw Tin"), "items must be Ruby, Sapphire, Raw Tin");
  });

  it("Add two blocks: Marble Block, Slate Block → 2 blocks", () => {
    const result = interpretToSpec("Add two blocks: Marble Block, Slate Block");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    assert.strictEqual(spec.blocks?.length, 2, "must have exactly 2 blocks");
    const names = spec.blocks!.map((b: { name: string }) => b.name);
    assert.ok(names.includes("Marble Block") && names.includes("Slate Block"), "blocks must be Marble Block, Slate Block");
  });

  it("Add items (Ruby, Sapphire) and block (Marble Block) → correct counts and types", () => {
    const result = interpretToSpec("Add items (Ruby, Sapphire) and block (Marble Block)");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    assert.strictEqual(spec.items?.length, 2, "must have 2 items");
    assert.strictEqual(spec.blocks?.length, 1, "must have 1 block");
    const itemNames = spec.items!.map((i: { name: string }) => i.name);
    assert.ok(itemNames.includes("Ruby") && itemNames.includes("Sapphire"), "items must be Ruby and Sapphire");
    assert.strictEqual(spec.blocks![0].name, "Marble Block", "block must be Marble Block");
  });

  it("Add items: Raw Tin, Tin Ingot. Smelt Raw Tin into Tin Ingot → 2 items, 1 smelting recipe", () => {
    const result = interpretToSpec("Add items: Raw Tin, Tin Ingot. Smelt Raw Tin into Tin Ingot.");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    assert.strictEqual(spec.items?.length, 2, "must have 2 items");
    assert.strictEqual((spec.recipes?.length ?? 0), 1, "must have 1 cooking recipe");
    const smelting = spec.recipes!.find((r: { type: string }) => r.type === "smelting");
    assert.ok(smelting, "must have smelting recipe");
    assert.strictEqual(smelting!.ingredients?.[0]?.id, "raw_tin");
    assert.strictEqual(smelting!.result.id, "tin_ingot");
    const itemIds = spec.items!.map((i: { id: string }) => i.id);
    assert.ok(itemIds.includes("raw_tin") && itemIds.includes("tin_ingot"));
  });

  it("Add items: Raw Tin, Tin Ingot. Blast Raw Tin into Tin Ingot → kind=blasting", () => {
    const result = interpretToSpec("Add items: Raw Tin, Tin Ingot. Blast Raw Tin into Tin Ingot.");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    const blasting = spec.recipes!.find((r: { type: string }) => r.type === "blasting");
    assert.ok(blasting, "must have blasting recipe");
    assert.strictEqual(blasting!.ingredients?.[0]?.id, "raw_tin");
    assert.strictEqual(blasting!.result.id, "tin_ingot");
  });

  it("Add items: Ruby, Polished Ruby. Smelt Ruby into Polished Ruby. No recipes → 0 recipes", () => {
    const result = interpretToSpec("Add items: Ruby, Polished Ruby. Smelt Ruby into Polished Ruby. No recipes.");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    assert.strictEqual(spec.items?.length, 2);
    assert.strictEqual(spec.recipes?.length ?? 0, 0, "No recipes constraint must prevent cooking recipes");
  });

  it("Smelt Raw Tin into Tin Ingot (no explicit items list) → both items created + 1 recipe", () => {
    const result = interpretToSpec("Smelt Raw Tin into Tin Ingot.");
    assert.strictEqual(result.type, "proceed");
    if (result.type !== "proceed" || !("spec" in result)) return;
    const spec = result.spec;
    const itemIds = spec.items!.map((i: { id: string }) => i.id);
    assert.ok(itemIds.includes("raw_tin"), "must create Raw Tin item");
    assert.ok(itemIds.includes("tin_ingot"), "must create Tin Ingot item");
    assert.strictEqual((spec.recipes?.length ?? 0), 1);
    assert.strictEqual(spec.recipes![0].type, "smelting");
    assert.strictEqual(spec.recipes![0].ingredients?.[0]?.id, "raw_tin");
    assert.strictEqual(spec.recipes![0].result.id, "tin_ingot");
  });
});
