/**
 * resolveIngredientId: stable item/tag id for recipe JSON.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { resolveIngredientId } from "./recipe-generator.js";

describe("resolveIngredientId", () => {
  it("prefixes mod-local id with modId", () => {
    assert.strictEqual(resolveIngredientId("mymod", "ingot"), "mymod:ingot");
    assert.strictEqual(resolveIngredientId("mymod", "planks"), "mymod:planks");
  });

  it("returns id unchanged when it contains colon (vanilla or namespaced)", () => {
    assert.strictEqual(resolveIngredientId("mymod", "minecraft:stick"), "minecraft:stick");
    assert.strictEqual(resolveIngredientId("mymod", "minecraft:iron_ingot"), "minecraft:iron_ingot");
  });

  it("returns tag id unchanged when it contains colon", () => {
    assert.strictEqual(resolveIngredientId("mymod", "#minecraft:logs"), "#minecraft:logs");
  });
});
