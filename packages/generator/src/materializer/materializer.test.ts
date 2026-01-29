/**
 * Plane 3 golden tests: deterministic output, expected paths, empty spec, Tier 1 set only.
 * Compares string outputs; no filesystem.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import type { ModSpecV1 } from "@themodgenerator/spec";
import { expandSpecTier1 } from "@themodgenerator/spec";
import { composeTier1Stub } from "../composer-stub.js";
import { materializeTier1 } from "./index.js";

function minimalTier1Spec(overrides: Partial<ModSpecV1> = {}): ModSpecV1 {
  return {
    schemaVersion: 1,
    minecraftVersion: "1.21.1",
    loader: "fabric",
    modId: "test_mod",
    modName: "Test Mod",
    features: ["hello-world"],
    items: [],
    blocks: [],
    ...overrides,
  };
}

function serializeOutput(files: { path: string; contents: string }[]): string {
  return files
    .map((f) => `${f.path}\n${f.contents}`)
    .sort()
    .join("\n---\n");
}

describe("materializeTier1 golden tests", () => {
  it("same Tier 1 spec yields byte-for-byte identical file outputs", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "ruby", name: "Ruby" }],
      blocks: [{ id: "ruby_block", name: "Block of Ruby" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const a = materializeTier1(expanded, assets);
    const b = materializeTier1(expanded, assets);
    const outA = serializeOutput(a);
    const outB = serializeOutput(b);
    assert.strictEqual(outA, outB, "same spec must produce identical output");
  });

  it("item + block spec produces expected file paths exactly", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "ruby", name: "Ruby" }],
      blocks: [{ id: "ruby_block", name: "Block of Ruby" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const paths = files.map((f) => f.path).sort();

    const expected = [
      "build.gradle",
      "gradle.properties",
      "settings.gradle",
      "src/main/java/net/themodgenerator/test_mod/TestMod.java",
      "src/main/resources/fabric.mod.json",
      "src/main/resources/test_mod.mixins.json",
      "src/main/resources/assets/test_mod/blockstates/ruby_block.json",
      "src/main/resources/assets/test_mod/lang/en_us.json",
      "src/main/resources/assets/test_mod/models/block/ruby_block.json",
      "src/main/resources/assets/test_mod/models/item/ruby.json",
      "src/main/resources/assets/test_mod/textures/block/ruby_block.png",
      "src/main/resources/assets/test_mod/textures/item/ruby.png",
    ].sort();
    assert.deepStrictEqual(paths, expected, "paths must match expected Tier 1 set");
  });

  it("empty Tier 1 spec yields valid Fabric mod with no item/block registrations", () => {
    const spec = minimalTier1Spec();
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    assert.ok(files.length > 0);
    const paths = files.map((f) => f.path).sort();
    assert.ok(paths.includes("build.gradle"));
    assert.ok(paths.includes("src/main/resources/fabric.mod.json"));
    assert.ok(paths.includes("src/main/java/net/themodgenerator/test_mod/TestMod.java"));
    assert.ok(paths.includes("src/main/resources/assets/test_mod/lang/en_us.json"));
    const javaFile = files.find((f) => f.path.endsWith("TestMod.java"));
    assert.ok(javaFile);
    assert.ok(!javaFile.contents.includes("Registry.register(Registries.ITEM"));
    assert.ok(!javaFile.contents.includes("Registry.register(Registries.BLOCK"));
  });

  it("no files outside allowed Tier 1 set", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "ingot", name: "Ingot" }],
      blocks: [{ id: "block", name: "Block" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const allowedPathPatterns = [
      /^build\.gradle$/,
      /^gradle\.properties$/,
      /^settings\.gradle$/,
      /^src\/main\/java\/net\/themodgenerator\/[a-z0-9_]+\/[A-Za-z0-9_]+\.java$/,
      /^src\/main\/resources\/fabric\.mod\.json$/,
      /^src\/main\/resources\/[a-z0-9_]+\.mixins\.json$/,
      /^src\/main\/resources\/assets\/[a-z0-9_]+\/lang\/en_us\.json$/,
      /^src\/main\/resources\/assets\/[a-z0-9_]+\/textures\/item\/[a-z0-9_]+\.png$/,
      /^src\/main\/resources\/assets\/[a-z0-9_]+\/textures\/block\/[a-z0-9_]+\.png$/,
      /^src\/main\/resources\/assets\/[a-z0-9_]+\/models\/item\/[a-z0-9_]+\.json$/,
      /^src\/main\/resources\/assets\/[a-z0-9_]+\/models\/block\/[a-z0-9_]+\.json$/,
      /^src\/main\/resources\/assets\/[a-z0-9_]+\/blockstates\/[a-z0-9_]+\.json$/,
    ];
    for (const f of files) {
      const matched = allowedPathPatterns.some((p) => p.test(f.path));
      assert.ok(matched, `path must be in Tier 1 set: ${f.path}`);
    }
  });
});
