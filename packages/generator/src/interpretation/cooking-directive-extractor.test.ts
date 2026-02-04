/**
 * Tests for cooking directive extraction: parseCookingPhrases, extractCookingDirectives.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseCookingPhrases,
  extractCookingDirectives,
  cookingRecipeId,
} from "./cooking-directive-extractor.js";
import type { ModSpecV1 } from "@themodgenerator/spec";

function minimalSpec(overrides: Partial<ModSpecV1> = {}): ModSpecV1 {
  return {
    schemaVersion: 1,
    minecraftVersion: "1.21.1",
    loader: "fabric",
    modId: "test_mod",
    modName: "Test Mod",
    features: ["hello-world"],
    items: [],
    blocks: [],
    recipes: [],
    ...overrides,
  };
}

describe("parseCookingPhrases", () => {
  it("parses Smelt X into Y", () => {
    const out = parseCookingPhrases("Smelt Raw Tin into Tin Ingot.");
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].kind, "smelting");
    assert.strictEqual(out[0].ingredientName, "Raw Tin");
    assert.strictEqual(out[0].resultName, "Tin Ingot");
  });

  it("parses Blast X into Y", () => {
    const out = parseCookingPhrases("Blast Raw Tin into Tin Ingot.");
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].kind, "blasting");
  });

  it("parses multiple smelt directives", () => {
    const out = parseCookingPhrases("Smelt Raw Tin into Tin Ingot and smelt Ruby into Polished Ruby.");
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].ingredientName, "Raw Tin");
    assert.strictEqual(out[0].resultName, "Tin Ingot");
    assert.strictEqual(out[1].ingredientName, "Ruby");
    assert.strictEqual(out[1].resultName, "Polished Ruby");
  });
});

describe("cookingRecipeId", () => {
  it("produces stable id with kind suffix", () => {
    assert.strictEqual(cookingRecipeId("tin_ingot", "raw_tin", "smelting"), "tin_ingot_from_raw_tin_smelting");
    assert.strictEqual(cookingRecipeId("polished_ruby", "ruby", "blasting"), "polished_ruby_from_ruby_blasting");
  });
});

describe("extractCookingDirectives", () => {
  it("resolves existing items and returns one smelting recipe", () => {
    const spec = minimalSpec({
      items: [
        { id: "raw_tin", name: "Raw Tin" },
        { id: "tin_ingot", name: "Tin Ingot" },
      ],
    });
    const { recipes, itemsToAdd } = extractCookingDirectives("Smelt Raw Tin into Tin Ingot.", spec, { noRecipes: false });
    assert.strictEqual(recipes.length, 1);
    assert.strictEqual(recipes[0].type, "smelting");
    assert.strictEqual(recipes[0].ingredients?.[0]?.id, "raw_tin");
    assert.strictEqual(recipes[0].result.id, "tin_ingot");
    assert.strictEqual(recipes[0].id, "tin_ingot_from_raw_tin_smelting");
    assert.strictEqual(itemsToAdd.length, 0, "both entities already in spec");
  });

  it("creates missing items and returns recipe", () => {
    const spec = minimalSpec();
    const { recipes, itemsToAdd } = extractCookingDirectives("Smelt Raw Tin into Tin Ingot.", spec, { noRecipes: false });
    assert.strictEqual(recipes.length, 1);
    assert.strictEqual(itemsToAdd.length, 2);
    const ids = itemsToAdd.map((i) => i.id).sort();
    assert.deepStrictEqual(ids, ["raw_tin", "tin_ingot"]);
  });

  it("noRecipes: true returns zero recipes", () => {
    const spec = minimalSpec({ items: [{ id: "raw_tin", name: "Raw Tin" }, { id: "tin_ingot", name: "Tin Ingot" }] });
    const { recipes } = extractCookingDirectives("Smelt Raw Tin into Tin Ingot.", spec, { noRecipes: true });
    assert.strictEqual(recipes.length, 0);
  });
});
