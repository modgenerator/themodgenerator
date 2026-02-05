import { describe, it } from "node:test";
import assert from "node:assert";
import { validatePlanSpec } from "./openai-planner.js";

describe("openai-planner validatePlanSpec", () => {
  it("parses valid PlanSpec JSON (wood type Maple)", () => {
    const raw = {
      intent: "add_wood_type",
      entities: { woodTypes: ["Maple"] },
      impliedSystems: ["recipes"],
      constraints: { noBlocks: false },
      defaultsApplied: ["modName"],
    };
    const plan = validatePlanSpec(raw);
    assert.strictEqual(plan.intent, "add_wood_type");
    assert.deepStrictEqual(plan.entities.woodTypes, ["Maple"]);
    assert.ok(Array.isArray(plan.impliedSystems));
    assert.strictEqual(plan.constraints.noBlocks, false);
  });

  it("parses ores Tin and Silver with smelting + worldgen", () => {
    const raw = {
      intent: "add_ores",
      entities: { ores: ["Tin", "Silver"] },
      impliedSystems: ["smelting", "worldgen"],
      constraints: {},
      defaultsApplied: [],
    };
    const plan = validatePlanSpec(raw);
    assert.strictEqual(plan.intent, "add_ores");
    assert.deepStrictEqual(plan.entities.ores, ["Tin", "Silver"]);
    assert.ok(plan.impliedSystems.includes("smelting"));
  });

  it("throws on non-object", () => {
    assert.throws(() => validatePlanSpec(null), /PlanSpec must be an object/);
    assert.throws(() => validatePlanSpec("string"), /PlanSpec must be an object/);
  });

  it("throws on missing intent", () => {
    assert.throws(
      () => validatePlanSpec({ entities: {}, impliedSystems: [], constraints: {}, defaultsApplied: [] }),
      /PlanSpec.intent must be a string/
    );
  });
});
