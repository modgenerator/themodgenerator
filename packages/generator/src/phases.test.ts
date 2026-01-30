/**
 * Phase 5 — Tests. Logic-only: structure and intent fidelity. No image snapshots.
 * Prove: rasterization deterministic; no flat textures; every item/block has behavior + acquisition;
 * ice cream that melts → tick behavior; radioactive block → area effect; sentient item → AI hook;
 * no empty plans.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { interpretItemOrBlock } from "./interpretation.js";
import { synthesizeTexture } from "./texture/synthesize.js";
import { rasterizeTexture } from "./texture/rasterize.js";
import { generatePreviewTextures } from "./texture/preview.js";
import { synthesizeBehavior } from "./behavior/behavior-intelligence.js";
import { synthesizeWorldIntegration } from "./world/world-integration.js";

describe("rasterization", () => {
  it("is deterministic for same plan + size + seed", () => {
    const interpreted = interpretItemOrBlock("ice cream");
    const plan = synthesizeTexture("ice cream", interpreted, "seed1");
    const a = rasterizeTexture(plan, 16, "rseed");
    const b = rasterizeTexture(plan, 16, "rseed");
    assert.strictEqual(a.hash, b.hash);
    assert.strictEqual(a.size, 16);
    assert.ok(a.pixels.length === 16 * 16 * 4);
  });

  it("never produces flat texture (variance in pixels)", () => {
    const interpreted = interpretItemOrBlock("radioactive cheese");
    const plan = synthesizeTexture("radioactive cheese", interpreted, "seed2");
    const out = rasterizeTexture(plan, 16, "rseed2");
    let minR = 255, maxR = 0;
    for (let i = 0; i < out.pixels.length; i += 4) {
      minR = Math.min(minR, out.pixels[i]);
      maxR = Math.max(maxR, out.pixels[i]);
    }
    assert.ok(maxR - minR > 0, "texture must have pixel variance (not flat)");
  });
});

describe("behavior intelligence", () => {
  it("every item/block has behavior (no empty plan)", () => {
    const interpreted = interpretItemOrBlock("ice cream");
    const plan = synthesizeBehavior({
      semanticTags: interpreted.semanticTags,
      interpretedKind: interpreted.kind,
      gameplayTraits: interpreted.gameplay,
      prompt: "ice cream",
    });
    assert.ok(
      plan.tickBehaviors.length > 0 || plan.interactionBehaviors.length > 0 || plan.areaEffects.length > 0 || plan.aiHooks.length > 0,
      "behavior plan must not be empty"
    );
    assert.ok(plan.invariants.length > 0);
  });

  it('"ice cream that melts" has tick behavior', () => {
    const interpreted = interpretItemOrBlock("ice cream that melts");
    const plan = synthesizeBehavior({
      semanticTags: interpreted.semanticTags,
      interpretedKind: interpreted.kind,
      gameplayTraits: interpreted.gameplay,
      prompt: "ice cream that melts",
    });
    const hasMeltTick = plan.tickBehaviors.some(
      (t) => t.cause.includes("melt") || t.effect.includes("transform") || t.effect.includes("decay")
    );
    assert.ok(hasMeltTick, "ice cream that melts must have tick behavior");
  });

  it('"radioactive block" has area effect', () => {
    const interpreted = interpretItemOrBlock("radioactive block");
    const plan = synthesizeBehavior({
      semanticTags: interpreted.semanticTags,
      interpretedKind: interpreted.kind,
      gameplayTraits: interpreted.gameplay,
      prompt: "radioactive block",
    });
    assert.ok(plan.areaEffects.length > 0, "radioactive block must have area effect");
  });

  it('"sentient sword" has AI hook', () => {
    const interpreted = interpretItemOrBlock("sentient sword");
    const plan = synthesizeBehavior({
      semanticTags: interpreted.semanticTags,
      interpretedKind: interpreted.kind,
      gameplayTraits: interpreted.gameplay,
      prompt: "sentient sword",
    });
    assert.ok(plan.aiHooks.length > 0, "sentient item must have AI hook");
  });
});

describe("world integration", () => {
  it("every item/block has at least one acquisition path", () => {
    const interpreted = interpretItemOrBlock("dream brick");
    const behaviorPlan = synthesizeBehavior({
      semanticTags: interpreted.semanticTags,
      interpretedKind: interpreted.kind,
      gameplayTraits: interpreted.gameplay,
      prompt: "dream brick",
    });
    const world = synthesizeWorldIntegration({
      interpretedResult: interpreted,
      behaviorPlan,
      prompt: "dream brick",
    });
    assert.ok(
      world.recipes.length > 0 || world.lootTables.length > 0,
      "must have at least one acquisition path (recipe or loot)"
    );
  });

  it("no generation path produces empty plans", () => {
    const prompts = ["ice cream", "radioactive cheese", "ancient sentient machine block"];
    for (const prompt of prompts) {
      const interpreted = interpretItemOrBlock(prompt);
      const behaviorPlan = synthesizeBehavior({
        semanticTags: interpreted.semanticTags,
        interpretedKind: interpreted.kind,
        gameplayTraits: interpreted.gameplay,
        prompt,
      });
      const world = synthesizeWorldIntegration({
        interpretedResult: interpreted,
        behaviorPlan,
        prompt,
      });
      assert.ok(
        behaviorPlan.tickBehaviors.length > 0 ||
          behaviorPlan.interactionBehaviors.length > 0 ||
          behaviorPlan.areaEffects.length > 0 ||
          behaviorPlan.aiHooks.length > 0,
        `"${prompt}" must have non-empty behavior`
      );
      assert.ok(
        world.recipes.length > 0 || world.lootTables.length > 0,
        `"${prompt}" must have acquisition path`
      );
    }
  });
});

describe("preview textures", () => {
  it("generates inventory icon and optional block face / emissive", () => {
    const interpreted = interpretItemOrBlock("glowing crystal");
    const plan = synthesizeTexture("glowing crystal", interpreted, "seed3");
    const preview = generatePreviewTextures(plan, "pseed", { isBlock: false });
    assert.ok(preview.inventoryIcon != null);
    assert.ok(preview.inventoryIcon.pixels.length > 0);
    assert.ok(preview.inventoryIcon.hash.length > 0);
    if (plan.proceduralSpec.postProcess.glowMask) {
      assert.ok(preview.emissiveMask != null);
    }
  });
});
