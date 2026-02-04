/**
 * Unit test: profile-driven texture generator records motifsApplied and draws each motif.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { generateOpaquePng16x16WithProfile } from "./texture-png.js";

const BASE_PROFILE = {
  intent: "item" as const,
  materialHint: "test",
  materialClass: "generic",
  physicalTraits: ["textured"],
  surfaceStyle: ["flat"],
};

function withMotif(motif: string) {
  return { ...BASE_PROFILE, visualMotifs: [motif] };
}

describe("texture-png profile", () => {
  it("textureProfile with visualMotifs holes results in motifsApplied including holes", () => {
    const result = generateOpaquePng16x16WithProfile({
      seed: "test-holes",
      textureProfile: withMotif("holes"),
    });
    assert.ok(Array.isArray(result.motifsApplied), "motifsApplied must be array");
    assert.ok(result.motifsApplied.includes("holes"), "motifsApplied must include holes when motif requested");
    assert.strictEqual(result.materialClassApplied, "generic", "materialClassApplied must match profile");
    assert.ok(result.buffer.length > 100, "buffer must be valid PNG");
  });

  const MOTIFS = ["holes", "grain", "strata", "veins", "bubbles", "flakes", "rings"] as const;
  for (const motif of MOTIFS) {
    it(`motif "${motif}" is in motifsApplied when requested`, () => {
      const result = generateOpaquePng16x16WithProfile({
        seed: `test-${motif}`,
        textureProfile: withMotif(motif),
      });
      assert.ok(result.motifsApplied.includes(motif), `motifsApplied must include ${motif}`);
      assert.ok(result.buffer.length > 100, "buffer must be valid PNG");
    });

    it(`motif "${motif}" changes pixel output (pattern heuristic)`, () => {
      const noMotif = generateOpaquePng16x16WithProfile({ seed: `seed-${motif}`, textureProfile: BASE_PROFILE });
      const withMotifBuf = generateOpaquePng16x16WithProfile({
        seed: `seed-${motif}`,
        textureProfile: withMotif(motif),
      });
      assert.notDeepStrictEqual(
        noMotif.buffer,
        withMotifBuf.buffer,
        `requesting motif "${motif}" must produce different buffer than no motif`
      );
    });
  }
});
