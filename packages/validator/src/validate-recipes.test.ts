/**
 * Recipe validation: expanded spec and vanilla ingredients.
 * - Wood type expansion yields recipes that validate against expanded items/blocks.
 * - Recipes with minecraft:stick and minecraft:chest do not fail validation.
 * - Ore with smelting: validation passes with minecraft:* ingredients allowed.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import type { ModSpecV1 } from "@themodgenerator/spec";
import { expandSpecTier1 } from "@themodgenerator/spec";
import { validateRecipes } from "./validate-recipes.js";
import { validateGeneratedRecipeJson } from "./validate-generated-recipe-json.js";

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
    ...overrides,
  };
}

describe("validateRecipes", () => {
  it("wood type Maple: expanded spec yields valid recipes (no 'not in spec' for maple_*)", () => {
    const spec = minimalSpec({ woodTypes: [{ id: "maple", displayName: "Maple" }] });
    const expanded = expandSpecTier1(spec);
    const specForRecipeValidation = { ...expanded.spec, items: expanded.items, blocks: expanded.blocks };
    const result = validateRecipes(specForRecipeValidation, { allowVanillaIngredients: true });
    assert.ok(result.valid, `Recipe validation should pass for expanded Maple spec. Errors: ${result.errors.join("; ")}`);
    assert.ok(
      !result.errors.some((e) => e.includes("maple_") && e.includes("not in spec")),
      "Must not complain that maple_* ids are not in spec"
    );
  });

  it("recipes with minecraft:stick and minecraft:chest do not fail validation", () => {
    const spec = minimalSpec({
      woodTypes: [{ id: "birch", displayName: "Birch" }],
    });
    const expanded = expandSpecTier1(spec);
    const specForRecipeValidation = { ...expanded.spec, items: expanded.items, blocks: expanded.blocks };
    const result = validateRecipes(specForRecipeValidation, { allowVanillaIngredients: true });
    assert.ok(result.valid, `Recipes using minecraft:stick/chest should validate. Errors: ${result.errors.join("; ")}`);
  });

  it("ore Y with smelting: recipe validation passes with minecraft:* allowed and generated result in spec", () => {
    const spec = minimalSpec({
      items: [
        { id: "raw_tin", name: "Raw Tin" },
        { id: "tin_ingot", name: "Tin Ingot" },
      ],
      blocks: [],
      recipes: [
        {
          id: "tin_ingot_from_raw",
          type: "smelting",
          ingredients: [{ id: "raw_tin" }],
          result: { id: "tin_ingot", count: 1 },
        },
      ],
    });
    const result = validateRecipes(spec, { allowVanillaIngredients: true });
    assert.ok(result.valid, `Smelting recipe should validate. Errors: ${result.errors.join("; ")}`);
  });

  it("when allowVanillaIngredients false, minecraft:stick in key is reported as not in spec", () => {
    const spec = minimalSpec({
      items: [{ id: "custom_planks", name: "Custom Planks" }],
      blocks: [],
      recipes: [
        {
          id: "custom_fence",
          type: "crafting_shaped",
          pattern: ["#/#", "#/#"],
          key: { "#": { id: "custom_planks" }, "/": { id: "minecraft:stick" } },
          result: { id: "custom_fence", count: 3 },
        },
      ],
    });
    const result = validateRecipes(spec, { allowVanillaIngredients: false });
    assert.ok(!result.valid, "Should fail when vanilla ingredients not allowed");
    assert.ok(result.errors.some((e) => e.includes("minecraft:stick")), "Error should mention minecraft:stick");
  });
});

describe("validateGeneratedRecipeJson", () => {
  it("expanded spec + recipe JSON with minecraft:stick ingredient passes", () => {
    const spec = minimalSpec({ woodTypes: [{ id: "oak", displayName: "Oak" }] });
    const expanded = expandSpecTier1(spec);
    const specForValidation = { ...expanded.spec, items: expanded.items, blocks: expanded.blocks };
    const recipesByPath = new Map<string, unknown>([
      [
        "data/test_mod/recipe/oak_fence.json",
        {
          type: "minecraft:crafting_shaped",
          pattern: ["#/#", "#/#"],
          key: {
            "#": { item: "test_mod:oak_planks" },
            "/": { item: "minecraft:stick" },
          },
          result: { id: "test_mod:oak_fence", count: 3 },
        },
      ],
    ]);
    const result = validateGeneratedRecipeJson(specForValidation, recipesByPath, {
      allowVanillaIngredients: true,
    });
    assert.ok(result.valid, `Generated recipe JSON with minecraft:stick should validate. Errors: ${result.errors.join("; ")}`);
  });
});
