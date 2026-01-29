/**
 * Expansion determinism: same spec → identical ExpandedSpecTier1 (deep equality).
 * Pure function test; no Tier 2 branching.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import type { ModSpecV1 } from "./types.js";
import { expandSpecTier1 } from "./expansion.js";

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

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe("expandSpecTier1", () => {
  it("same spec yields identical ExpandedSpecTier1 (deep equality)", () => {
    const spec = minimalSpec({
      items: [{ id: "ruby", name: "Ruby" }],
      blocks: [{ id: "ruby_block", name: "Block of Ruby" }],
    });
    const a = expandSpecTier1(spec);
    const b = expandSpecTier1(spec);
    assert.ok(deepEqual(a, b), "expandSpecTier1(spec) must be deterministic");
    assert.strictEqual(a.descriptors.length, b.descriptors.length);
    assert.strictEqual(a.descriptors[0].type, "handheld_item");
    assert.strictEqual(a.descriptors[1].type, "cube_block");
  });

  it("descriptor order is stable: items then blocks", () => {
    const spec = minimalSpec({
      items: [{ id: "a", name: "A" }],
      blocks: [{ id: "b", name: "B" }],
    });
    const expanded = expandSpecTier1(spec);
    assert.strictEqual(expanded.descriptors.length, 2);
    assert.strictEqual(expanded.descriptors[0].type, "handheld_item");
    assert.strictEqual(expanded.descriptors[0].contentId, "a");
    assert.strictEqual(expanded.descriptors[1].type, "cube_block");
    assert.strictEqual(expanded.descriptors[1].contentId, "b");
  });
});
