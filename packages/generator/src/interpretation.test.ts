/**
 * PART 6 — Tests (ENFORCEMENT). Assert:
 * - No throws for empty/nonsense input
 * - xyzzysnorf → crystal, purple palette, glow, animation
 * - Every result: semantic tags, texture recipe, non-default visuals
 * - Ice cream has drip animation
 * - Radioactive cheese has overlayHints
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { interpretItemOrBlock, type InterpretedResult } from "./interpretation.js";
import { deriveTextureRecipe } from "./item-block-primitives.js";

describe("interpretItemOrBlock", () => {
  it("never throws and never returns null for any input", () => {
    const inputs: string[] = ["", "   ", "ice cream", "xyzzysnorf", "radioactive cheese"];
    for (const input of inputs) {
      let result: InterpretedResult;
      assert.doesNotThrow(() => {
        result = interpretItemOrBlock(input);
      }, `interpretItemOrBlock must not throw for: ${JSON.stringify(input)}`);
      result = interpretItemOrBlock(input);
      assert.ok(result != null, "must never return null");
      assert.strictEqual(result.kind === "item" || result.kind === "block", true, "kind must be item or block");
    }
    // Explicit null/undefined (runtime guard in interpretItemOrBlock)
    let r: InterpretedResult = interpretItemOrBlock(null as unknown as string);
    assert.ok(r != null && (r.kind === "item" || r.kind === "block"));
    r = interpretItemOrBlock(undefined as unknown as string);
    assert.ok(r != null && (r.kind === "item" || r.kind === "block"));
  });

  it('prompt("ice cream") → food, cold, drip animation, pastel palette', () => {
    const result = interpretItemOrBlock("ice cream");
    assert.ok(result != null, "must never return null");
    assert.strictEqual(result.kind, "item");
    assert.ok(result.item != null);
    assert.ok(result.semanticTags.includes("food"), "ice cream must have food tag");
    assert.ok(result.semanticTags.includes("cold"), "ice cream must have cold tag");
    assert.strictEqual(result.aesthetic.materialHint, "ice");
    assert.strictEqual(result.aesthetic.animationHint, "drip");
    assert.ok(result.aesthetic.colorPalette.length > 0, "must have pastel palette");
    assert.ok(result.item!.category === "food");
    assert.ok(result.item!.visual.textureHints.length > 0, "must have texture hints");
    const recipe = deriveTextureRecipe(result.aesthetic);
    assert.ok(recipe.base != null, "texture recipe must have base");
    assert.ok(recipe.paletteShift.length > 0, "texture recipe must have palette");
    assert.ok(recipe.animation != null, "ice cream must have drip animation in recipe");
  });

  it('prompt("radioactive cheese") → food + dangerous + glow + radioactive_speckles overlay', () => {
    const result = interpretItemOrBlock("radioactive cheese");
    assert.ok(result != null);
    assert.ok(result.semanticTags.includes("food") || result.semanticTags.includes("edible"));
    assert.ok(result.semanticTags.includes("dangerous"));
    assert.ok(result.semanticTags.includes("radioactive"));
    assert.strictEqual(result.aesthetic.glow, true);
    assert.ok(
      Array.isArray(result.aesthetic.overlayHints) && result.aesthetic.overlayHints!.includes("radioactive_speckles"),
      "must have radioactive_speckles overlay intent"
    );
    const recipe = deriveTextureRecipe(result.aesthetic);
    assert.ok(recipe.overlays.some((o) => o.key === "radioactive_speckles"));
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

  it('xyzzysnorf produces crystal, purple palette, glow, and animation (evocative fallback)', () => {
    const result = interpretItemOrBlock("xyzzysnorf");
    assert.ok(result != null, "must never return null");
    assert.strictEqual(result.kind, "item");
    assert.ok(result.semanticTags.length > 0, "must have semantic tags");
    assert.ok(
      result.semanticTags.includes("magical") && result.semanticTags.includes("strange"),
      "must produce evocative tags: magical, strange"
    );
    assert.strictEqual(result.aesthetic.materialHint, "crystal");
    assert.ok(
      Array.isArray(result.aesthetic.colorPalette) && result.aesthetic.colorPalette.length > 0,
      "must have purple palette"
    );
    assert.ok(
      result.aesthetic.colorPalette.some((c) => c.includes("93") || c.includes("8A") || c.includes("4B")),
      "palette must be purple/violet"
    );
    assert.strictEqual(result.aesthetic.glow, true, "must glow");
    assert.strictEqual(result.aesthetic.animationHint, "pulse", "must have animation (pulse)");
    const recipe = deriveTextureRecipe(result.aesthetic);
    assert.ok(recipe.base != null && recipe.base.key === "crystal");
    assert.ok(recipe.paletteShift.length > 0);
    assert.ok(recipe.animation != null, "recipe must include animation");
  });

  it("interpretation never returns unknown and never throws", () => {
    const prompts = ["", "   ", "ice cream", "cursed sword", "glowing mushroom", "ruby block", "radioactive dirt"];
    for (const prompt of prompts) {
      assert.doesNotThrow(() => {
        const result = interpretItemOrBlock(prompt);
        assert.ok(result != null);
        assert.ok(result.semanticTags.length > 0, `semantic tags must not be empty for "${prompt}"`);
        assert.ok(result.displayName.length > 0);
      }, `interpretItemOrBlock("${prompt}") must not throw`);
    }
  });

  it("every result has semantic tags, texture recipe (base + paletteShift), and non-default visuals", () => {
    const prompts = ["cursed golden spoon", "a soft glowing blue thing that feels magical", "dream brick", "xyzzysnorf"];
    for (const prompt of prompts) {
      const result = interpretItemOrBlock(prompt);
      assert.ok(result.semanticTags.length > 0, `"${prompt}" must have semantic tags`);
      assert.ok(
        Array.isArray(result.aesthetic.colorPalette) && result.aesthetic.colorPalette.length > 0,
        `"${prompt}" must have color palette`
      );
      const recipe = deriveTextureRecipe(result.aesthetic);
      assert.ok(recipe.base != null && recipe.base.key, `"${prompt}" must have recipe base`);
      assert.ok(recipe.paletteShift.length > 0, `"${prompt}" must have paletteShift`);
      assert.ok(
        recipe.base.key !== "generic" || recipe.paletteShift.length > 0,
        `"${prompt}" must have non-default visuals`
      );
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
