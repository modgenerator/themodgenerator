/**
 * Unit test: profile-driven texture generator records motifsApplied (e.g. "holes").
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { generateOpaquePng16x16WithProfile } from "./texture-png.js";

describe("texture-png profile", () => {
  it("textureProfile with visualMotifs holes results in motifsApplied including holes", () => {
    const result = generateOpaquePng16x16WithProfile({
      seed: "test-holes",
      textureProfile: {
        intent: "item",
        materialHint: "porous",
        materialClass: "food",
        physicalTraits: ["porous"],
        surfaceStyle: ["smooth"],
        visualMotifs: ["holes"],
      },
    });
    assert.ok(Array.isArray(result.motifsApplied), "motifsApplied must be array");
    assert.ok(result.motifsApplied.includes("holes"), "motifsApplied must include holes when motif requested");
    assert.strictEqual(result.materialClassApplied, "food", "materialClassApplied must match profile");
    assert.ok(result.buffer.length > 100, "buffer must be valid PNG");
  });
});
