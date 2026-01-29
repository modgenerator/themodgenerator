/**
 * Item/block primitive vocabulary: safe defaults, no blocking.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { defaultItemPrimitive, defaultBlockPrimitive } from "./item-block-primitives.js";

describe("defaultItemPrimitive", () => {
  it("produces valid ItemPrimitive with safe defaults", () => {
    const p = defaultItemPrimitive("test_item", "Test Item");
    assert.strictEqual(p.id, "test_item");
    assert.strictEqual(p.displayName, "Test Item");
    assert.strictEqual(p.category, "misc");
    assert.strictEqual(p.rarity, "common");
    assert.strictEqual(p.stackSize, 64);
    assert.ok(p.visual.model === "generated");
    assert.ok(Array.isArray(p.visual.textureHints));
    assert.ok(typeof p.behavior === "object");
  });
});

describe("defaultBlockPrimitive", () => {
  it("produces valid BlockPrimitive with safe defaults", () => {
    const p = defaultBlockPrimitive("test_block", "Test Block");
    assert.strictEqual(p.id, "test_block");
    assert.strictEqual(p.displayName, "Test Block");
    assert.strictEqual(p.material, "stone");
    assert.strictEqual(p.hardness, 1);
    assert.strictEqual(p.shape, "cube");
    assert.ok(Array.isArray(p.visual.textureHints));
    assert.ok(typeof p.behavior === "object");
  });
});
