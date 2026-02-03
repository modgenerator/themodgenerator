import { describe, it } from "node:test";
import assert from "node:assert";
import { validateModSpecV2 } from "./validate-modspec-v2.js";
import type { ExpandedModSpecV2 } from "@themodgenerator/spec";

describe("validateModSpecV2", () => {
  it("valid expanded spec passes (all refs exist)", () => {
    const spec: ExpandedModSpecV2 = {
      schemaVersion: 2,
      namespace: "test",
      modId: "test",
      modName: "Test",
      minecraftVersion: "1.21.1",
      fabricVersion: "0.15",
      materials: [{ id: "gem", category: "gem" }],
      blocks: [{ id: "gem_block", kind: "basic", textureSpec: { base: "gem" }, materialRef: "gem" }],
      items: [{ id: "gem", kind: "gem", materialRef: "gem" }],
      recipes: [
        { id: "r1", type: "crafting_shapeless", inputs: [{ id: "gem", count: 9 }], result: { id: "gem_block", count: 1 } },
      ],
      worldgen: [],
      tags: [],
    };
    const result = validateModSpecV2(spec);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("fails when recipe result references missing item", () => {
    const spec: ExpandedModSpecV2 = {
      schemaVersion: 2,
      namespace: "test",
      modId: "test",
      modName: "Test",
      minecraftVersion: "1.21.1",
      fabricVersion: "0.15",
      materials: [],
      blocks: [],
      items: [],
      recipes: [
        { id: "bad", type: "crafting_shapeless", inputs: [], result: { id: "nonexistent", count: 1 } },
      ],
      worldgen: [],
      tags: [],
    };
    const result = validateModSpecV2(spec);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("nonexistent")));
  });

  it("fails when worldgen references missing block", () => {
    const spec: ExpandedModSpecV2 = {
      schemaVersion: 2,
      namespace: "test",
      modId: "test",
      modName: "Test",
      minecraftVersion: "1.21.1",
      fabricVersion: "0.15",
      materials: [],
      blocks: [],
      items: [],
      recipes: [],
      worldgen: [{ oreBlockId: "missing_ore", minY: 0, maxY: 64, veinSize: 4, veinsPerChunk: 2 }],
      tags: [],
    };
    const result = validateModSpecV2(spec);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("missing_ore")));
  });
});
