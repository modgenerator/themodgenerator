/**
 * Tier 1 contract test — golden reference for Tier 1 end-to-end.
 * Pipeline: minimal Tier 1 spec → validateTier1 → expandSpecTier1 → composeTier1Stub.
 * Asserts: no errors, non-empty descriptors, non-empty AssetKeys, no Tier 2 symbols in output.
 * Future tiers would add separate contract tests (e.g. tier2-contract.test.ts) and gates.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import type { ModSpecV1 } from "@themodgenerator/spec";
import { expandSpecTier1, FEATURE_TIER, MAX_TIER_ALLOWED } from "@themodgenerator/spec";
import { composeTier1Stub } from "@themodgenerator/generator";
import { validateTier1 } from "./validate-tier1.js";

const TIER_1_FEATURE_KEYS = new Set(
  Object.entries(FEATURE_TIER)
    .filter(([, tier]) => tier <= MAX_TIER_ALLOWED)
    .map(([k]) => k)
);

function minimalTier1Spec(overrides: Partial<ModSpecV1> = {}): ModSpecV1 {
  return {
    schemaVersion: 1,
    minecraftVersion: "1.21.1",
    loader: "fabric",
    modId: "test_mod",
    modName: "Test Mod",
    features: ["hello-world"],
    items: [{ id: "ruby", name: "Ruby" }],
    blocks: [{ id: "ruby_block", name: "Block of Ruby" }],
    ...overrides,
  };
}

describe("Tier 1 contract: validate → expand → compose", () => {
  it("full pipeline: no errors, non-empty descriptors, non-empty AssetKeys, no Tier 2 symbols", () => {
    const spec = minimalTier1Spec();
    const validation = validateTier1(spec);
    assert.strictEqual(validation.valid, true, "validateTier1 must pass for Tier 1 spec");
    assert.strictEqual(validation.code, undefined);

    const expanded = expandSpecTier1(spec);
    assert.ok(expanded.descriptors.length > 0, "descriptors must be non-empty");
    for (const f of spec.features) {
      assert.ok(
        TIER_1_FEATURE_KEYS.has(f),
        `feature "${f}" must be Tier 1; no Tier 2 symbols in spec`
      );
    }
    assert.ok(
      expanded.descriptors.every(
        (d) => d.type === "handheld_item" || d.type === "cube_block"
      ),
      "descriptors must only be Tier 1 types (handheld_item, cube_block)"
    );

    const assetKeys = composeTier1Stub(expanded.descriptors);
    assert.ok(assetKeys.length > 0, "AssetKeys must be non-empty");
    assert.ok(
      assetKeys.every((k) => k.category === "item" || k.category === "block"),
      "AssetKeys must only use item/block categories"
    );
    assert.ok(
      assetKeys.every((k) => k.kind === "texture" || k.kind === "model"),
      "AssetKeys must only use texture/model kinds"
    );
  });

  it("minimal Tier 1 spec (hello-world only) runs pipeline without error", () => {
    const spec = minimalTier1Spec({
      items: [],
      blocks: [],
    });
    const validation = validateTier1(spec);
    assert.strictEqual(validation.valid, true);
    const expanded = expandSpecTier1(spec);
    const assetKeys = composeTier1Stub(expanded.descriptors);
    assert.strictEqual(expanded.descriptors.length, 0);
    assert.strictEqual(assetKeys.length, 0);
  });
});
