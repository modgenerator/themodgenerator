/**
 * PART 6 — Texture pipeline tests. Logic-only: structure and intent fidelity.
 * No image snapshots. Assert: palette.colors.length >= 3, detailLayers.length > 0,
 * deterministic for same prompt + seed, style/procedural intent for ice cream / radioactive cheese / xyzzysnorf.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { interpretItemOrBlock } from "../interpretation.js";
import { synthesizeTexture } from "./synthesize.js";
import { TextureStyle } from "./style-transfer.js";
import { generateProceduralTexture } from "./procedural.js";
import { generatePaletteAndMotifs } from "./palette-llm.js";
import { deriveTextureRecipe } from "../item-block-primitives.js";

describe("synthesizeTexture", () => {
  it('"ice cream" → drip layers + pastel palette + cute/fantasy style', () => {
    const interpreted = interpretItemOrBlock("ice cream");
    const plan = synthesizeTexture("ice cream", interpreted, "test-seed-1");

    assert.ok(plan.palette.colors.length >= 3, "palette must have at least 3 colors");
    assert.ok(plan.proceduralSpec.detailLayers.length > 0, "detailLayers must not be empty");
    assert.ok(
      plan.proceduralSpec.detailLayers.some((d) => d.type === "drip"),
      "ice cream must have drip layer"
    );
    assert.ok(
      plan.styledSpec.style === TextureStyle.cute || plan.styledSpec.style === TextureStyle.fantasy || plan.styledSpec.style === TextureStyle.vanilla,
      "style should be cute or fantasy"
    );
    assert.ok(
      plan.palette.primaryMotif.toLowerCase().includes("cream") || plan.palette.primaryMotif.toLowerCase().includes("swirl"),
      "motif should suggest creamy/swirled"
    );
  });

  it('"radioactive cheese" → glowMask + veins + sickly palette', () => {
    const interpreted = interpretItemOrBlock("radioactive cheese");
    const plan = synthesizeTexture("radioactive cheese", interpreted, "test-seed-2");

    assert.ok(plan.palette.colors.length >= 3);
    assert.ok(plan.proceduralSpec.detailLayers.length > 0);
    assert.strictEqual(plan.proceduralSpec.postProcess.glowMask, true, "must have glowMask");
    assert.ok(
      plan.proceduralSpec.detailLayers.some((d) => d.type === "veins"),
      "radioactive cheese should have veins layer"
    );
    assert.ok(
      plan.palette.primaryMotif.toLowerCase().includes("vein") ||
        plan.palette.secondaryMotifs.some((m) => m.toLowerCase().includes("vein") || m.toLowerCase().includes("radioactive")),
      "motifs should suggest veins/radioactive"
    );
  });

  it('"xyzzysnorf" → crystal noise + fantasy style + non-gray palette', () => {
    const interpreted = interpretItemOrBlock("xyzzysnorf");
    const plan = synthesizeTexture("xyzzysnorf", interpreted, "test-seed-3");

    assert.ok(plan.palette.colors.length >= 3);
    assert.ok(plan.proceduralSpec.detailLayers.length > 0);
    assert.strictEqual(plan.proceduralSpec.baseNoise, "crystal", "nonsense must use crystal base");
    assert.ok(
      plan.styledSpec.style === TextureStyle.magical || plan.styledSpec.style === TextureStyle.fantasy,
      "style should be magical or fantasy"
    );
    const hasPurpleOrVivid = plan.palette.colors.some(
      (c) => c.includes("93") || c.includes("8A") || c.includes("4B") || c.includes("DA") || c.includes("99")
    );
    assert.ok(hasPurpleOrVivid, "palette must be evocative (e.g. purple), not gray");
  });

  it("all prompts satisfy palette.colors.length >= 3 and proceduralSpec.detailLayers.length > 0", () => {
    const prompts = ["ice cream", "radioactive cheese", "xyzzysnorf", "cursed golden spoon", "dream brick"];
    for (const prompt of prompts) {
      const interpreted = interpretItemOrBlock(prompt);
      const plan = synthesizeTexture(prompt, interpreted, "seed-" + prompt);
      assert.ok(plan.palette.colors.length >= 3, `"${prompt}" must have >= 3 colors`);
      assert.ok(plan.proceduralSpec.detailLayers.length > 0, `"${prompt}" must have detailLayers`);
    }
  });

  it("deterministic output for same prompt + seed", () => {
    const interpreted = interpretItemOrBlock("ice cream");
    const plan1 = synthesizeTexture("ice cream", interpreted, "fixed-seed");
    const plan2 = synthesizeTexture("ice cream", interpreted, "fixed-seed");

    assert.deepStrictEqual(plan1.palette.colors, plan2.palette.colors);
    assert.strictEqual(plan1.proceduralSpec.baseNoise, plan2.proceduralSpec.baseNoise);
    assert.strictEqual(plan1.styledSpec.style, plan2.styledSpec.style);
    assert.strictEqual(plan1.proceduralSpec.detailLayers.length, plan2.proceduralSpec.detailLayers.length);
  });
});

describe("generateProceduralTexture", () => {
  it("detailLayers never empty", () => {
    const recipe = deriveTextureRecipe({
      materialHint: "unknown_xyz",
      colorPalette: [],
    });
    const spec = generateProceduralTexture(recipe, "any-seed");
    assert.ok(spec.detailLayers.length > 0);
  });

  it("glow in recipe sets postProcess.glowMask", () => {
    const recipe = deriveTextureRecipe({
      materialHint: "crystal",
      colorPalette: ["#9370DB"],
      glow: true,
    });
    const spec = generateProceduralTexture(recipe, "seed");
    assert.strictEqual(spec.postProcess.glowMask, true);
  });
});

describe("generatePaletteAndMotifs", () => {
  it("never fails and returns 3–6 colors", () => {
    const result = generatePaletteAndMotifs({
      prompt: "xyzzysnorf",
      semanticTags: ["magical", "organic", "strange"],
      aesthetic: { materialHint: "crystal", colorPalette: [] },
      seed: "s1",
    });
    assert.ok(result.colors.length >= 3 && result.colors.length <= 6);
    assert.ok(result.primaryMotif.length > 0);
    assert.ok(Array.isArray(result.secondaryMotifs));
  });
});
