/**
 * Tier 1 validation test matrix.
 * Plain objects only; no mocks. Covers valid Tier 1 item/block and Tier 2+/ore/loot rejection.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import type { ModSpecV1 } from "@themodgenerator/spec";
import {
  validateTier1,
  TIER1_NO_FEATURES,
  TIER1_UNKNOWN_FEATURE,
  TIER1_FORBIDDEN_FEATURE,
  TIER1_ORES_FORBIDDEN,
  TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN,
} from "./validate-tier1.js";

function minimalSpec(overrides: Partial<ModSpecV1> = {}): ModSpecV1 {
  return {
    schemaVersion: 1,
    minecraftVersion: "1.21.1",
    loader: "fabric",
    modId: "test_mod",
    modName: "Test Mod",
    features: ["hello-world"],
    ...overrides,
  };
}

describe("validateTier1", () => {
  it("valid Tier 1 item: hello-world + items array passes", () => {
    const spec = minimalSpec({
      features: ["hello-world"],
      items: [{ id: "ruby", name: "Ruby" }],
    });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.code, undefined);
  });

  it("valid Tier 1 block: hello-world + blocks array passes", () => {
    const spec = minimalSpec({
      features: ["hello-world"],
      blocks: [{ id: "ruby_block", name: "Block of Ruby" }],
    });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.code, undefined);
  });

  it("Tier 2 feature rejection: tools returns TIER1_FORBIDDEN_FEATURE", () => {
    const spec = minimalSpec({ features: ["hello-world", "tools"] });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, TIER1_FORBIDDEN_FEATURE);
    assert.ok(result.reason?.includes("tools"));
  });

  it("Tier 2 feature rejection: ore feature returns TIER1_FORBIDDEN_FEATURE", () => {
    const spec = minimalSpec({ features: ["ore"] });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, TIER1_FORBIDDEN_FEATURE);
  });

  it("implicit ore rejection: ores array returns TIER1_ORES_FORBIDDEN", () => {
    const spec = minimalSpec({
      features: ["hello-world"],
      ores: [{ id: "ruby_ore", blockId: "ruby_ore" }],
    });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, TIER1_ORES_FORBIDDEN);
  });

  it("implicit loot rejection: block loot returns TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN", () => {
    const spec = minimalSpec({
      features: ["hello-world"],
      loot: [{ id: "blocks/ruby_ore", type: "block", targetId: "ruby_ore" }],
    });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN);
  });

  it("implicit loot rejection: entity loot returns TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN", () => {
    const spec = minimalSpec({
      features: ["hello-world"],
      loot: [{ id: "entities/zombie", type: "entity", targetId: "zombie" }],
    });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, TIER1_LOOT_BLOCK_ENTITY_FORBIDDEN);
  });

  it("no features returns TIER1_NO_FEATURES", () => {
    const spec = minimalSpec({ features: [] });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, TIER1_NO_FEATURES);
  });

  it("unknown feature returns TIER1_UNKNOWN_FEATURE", () => {
    const spec = minimalSpec({
      features: ["hello-world", "not-a-feature"] as ModSpecV1["features"],
    });
    const result = validateTier1(spec);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, TIER1_UNKNOWN_FEATURE);
    assert.ok(result.reason?.includes("not-a-feature"));
  });
});
