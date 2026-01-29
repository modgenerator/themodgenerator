/**
 * Tests: interpretItemOrBlock never returns null/unknown; ice cream → food + cold; random → still item/block with name, texture, behavior.
 * Tests fail if: texture recipe missing, primitives empty, interpretation returns "unknown".
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { interpretItemOrBlock } from "./interpretation.js";
import { deriveTextureRecipe } from "./item-block-primitives.js";

describe("interpretItemOrBlock", () => {
  it('prompt("ice cream") → item with food traits, cold aesthetic, non-default texture', () => {
    const result = interpretItemOrBlock("ice cream");
    assert.ok(result != null, "must never return null");
    assert.strictEqual(result.kind, "item");
    assert.ok(result.item != null);
    assert.ok(result.semanticTags.includes("food"), "ice cream must have food tag");
    assert.ok(result.semanticTags.includes("cold"), "ice cream must have cold tag");
    assert.ok(result.aesthetic.materialHint === "ice" || result.aesthetic.colorPalette.length > 0);
    assert.ok(result.item!.category === "food");
    assert.ok(result.item!.visual.textureHints.length > 0, "must have texture hints");
    const recipe = deriveTextureRecipe(result.aesthetic);
    assert.ok(recipe.base != null, "texture recipe must have base");
    assert.ok(recipe.paletteShift.length > 0, "texture recipe must have palette");
  });

  it('prompt("radioactive cheese") → food + dangerous + glowing', () => {
    const result = interpretItemOrBlock("radioactive cheese");
    assert.ok(result != null);
    assert.ok(result.semanticTags.includes("food") || result.semanticTags.includes("edible"));
    assert.ok(result.semanticTags.includes("dangerous"));
    assert.strictEqual(result.aesthetic.glow, true);
    assert.ok(result.item != null || result.block != null);
  });

  it('prompt("dream brick") → block + magical + glowing', () => {
    const result = interpretItemOrBlock("dream brick");
    assert.ok(result != null);
    assert.strictEqual(result.kind, "block");
    assert.ok(result.block != null);
    assert.ok(result.semanticTags.includes("magical"));
    assert.strictEqual(result.aesthetic.glow, true);
  });

  it('prompt("random nonsense word") → still produces item OR block with name, texture, behavior', () => {
    const result = interpretItemOrBlock("xyzzysnorf");
    assert.ok(result != null, "must never return null for any prompt");
    assert.ok(result.kind === "item" || result.kind === "block");
    assert.ok(result.id.length > 0, "must have id");
    assert.ok(result.displayName.length > 0, "must have displayName");
    assert.ok(result.semanticTags.length > 0, "primitives must not be empty");
    assert.ok(result.item != null || result.block != null);
    if (result.item) {
      assert.ok(result.item.visual.textureHints.length > 0, "item must have texture hints");
    }
    if (result.block) {
      assert.ok(result.block.visual.textureHints.length > 0, "block must have texture hints");
    }
    const recipe = deriveTextureRecipe(result.aesthetic);
    assert.ok(recipe.base != null, "texture must exist (recipe base)");
  });

  it("interpretation never returns unknown and never throws", () => {
    const prompts = ["", "   ", "ice cream", "cursed sword", "glowing mushroom", "ruby block", "radioactive dirt"];
    for (const prompt of prompts) {
      assert.doesNotThrow(() => {
        const result = interpretItemOrBlock(prompt);
        assert.ok(result != null);
        assert.ok(result.semanticTags.length > 0, `primitives must not be empty for "${prompt}"`);
        assert.ok(result.displayName.length > 0);
      }, `interpretItemOrBlock("${prompt}") must not throw`);
    }
  });
});

describe("deriveTextureRecipe", () => {
  it("returns recipe with base, overlays or palette, for any aesthetic", () => {
    const cold = deriveTextureRecipe({
      materialHint: "ice",
      colorPalette: ["#B0E0E6", "#87CEEB"],
      glow: false,
    });
    assert.ok(cold.base != null);
    assert.ok(cold.paletteShift.length > 0);

    const glow = deriveTextureRecipe({
      materialHint: "crystal",
      colorPalette: ["#9370DB"],
      glow: true,
      animationHint: "pulse",
    });
    assert.ok(glow.overlays.length >= 1);
    assert.ok(glow.animation != null);
  });
});
