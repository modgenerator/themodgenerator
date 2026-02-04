/**
 * Plane 3 golden tests: deterministic output, expected paths, empty spec, Tier 1 set only.
 * Compares string outputs; no filesystem.
 * Invariants: any item → registered Fabric item; any block → registered Fabric block;
 * unknown behavior → does not throw; assets always exist in output.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import type { ModSpecV1 } from "@themodgenerator/spec";
import { expandSpecTier1 } from "@themodgenerator/spec";
import { composeTier1Stub } from "../composer-stub.js";
import { materializeTier1, materializeTier1WithPlans, recipeDataFiles } from "./index.js";
import { planFromIntent } from "../execution-plan.js";

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
      "src/main/java/net/themodgenerator/test_mod/TestModMod.java",
      "src/main/resources/fabric.mod.json",
      "src/main/resources/test_mod.mixins.json",
      "src/main/resources/assets/test_mod/blockstates/ruby_block.json",
      "src/main/resources/assets/test_mod/lang/en_us.json",
      "src/main/resources/assets/test_mod/models/block/ruby_block.json",
      "src/main/resources/assets/test_mod/models/item/ruby.json",
      "src/main/resources/assets/test_mod/models/item/ruby_block.json",
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
    assert.ok(paths.includes("src/main/java/net/themodgenerator/test_mod/TestModMod.java"));
    assert.ok(paths.includes("src/main/resources/assets/test_mod/lang/en_us.json"));
    const javaFile = files.find((f) => f.path.endsWith("TestModMod.java"));
    assert.ok(javaFile);
    assert.ok(!javaFile!.contents.includes("Registry.register(Registries.ITEM"));
    assert.ok(!javaFile!.contents.includes("Registry.register(Registries.BLOCK"));
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
      /^src\/main\/resources\/data\/[a-z0-9_]+\/recipes\/[a-z0-9_]+\.json$/,
    ];
    for (const f of files) {
      const matched = allowedPathPatterns.some((p) => p.test(f.path));
      assert.ok(matched, `path must be in Tier 1 set: ${f.path}`);
    }
  });
});

describe("materializer invariants", () => {
  it("any item request produces a registered Fabric item", () => {
    const spec = minimalTier1Spec({ items: [{ id: "any_item", name: "Any Item" }] });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const paths = files.map((f) => f.path);
    assert.ok(paths.some((p) => p.includes("textures/item/any_item")), "item texture path must exist");
    assert.ok(paths.some((p) => p.includes("models/item/any_item")), "item model path must exist");
    const javaFile = files.find((f) => f.path.endsWith("TestModMod.java"));
    assert.ok(javaFile, "TestModMod.java must exist");
    assert.ok(javaFile!.contents.includes("any_item") || javaFile!.contents.includes("Registries.ITEM"), "item must be registered");
    const langFile = files.find((f) => f.path.endsWith("en_us.json"));
    assert.ok(langFile, "lang file must exist");
    assert.ok(langFile!.contents.includes("any_item") || langFile!.contents.includes("Any Item"), "item name in lang");
  });

  it("any block request produces a registered Fabric block", () => {
    const spec = minimalTier1Spec({ blocks: [{ id: "any_block", name: "Any Block" }] });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const paths = files.map((f) => f.path);
    assert.ok(paths.some((p) => p.includes("textures/block/any_block")), "block texture path must exist");
    assert.ok(paths.some((p) => p.includes("models/block/any_block")), "block model path must exist");
    assert.ok(paths.some((p) => p.includes("blockstates/any_block")), "blockstate path must exist");
    const javaFile = files.find((f) => f.path.endsWith("TestModMod.java"));
    assert.ok(javaFile, "TestModMod.java must exist");
    assert.ok(javaFile!.contents.includes("any_block") || javaFile!.contents.includes("Registries.BLOCK"), "block must be registered");
  });

  it("unknown behavior does not throw", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "vague_item", name: "Something vague" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const plan = planFromIntent({
      name: "Something vague",
      description: "does something unknown",
      category: "item",
    });
    assert.doesNotThrow(() => {
      materializeTier1WithPlans(expanded, assets, [plan]);
    }, "unknown behavior must not throw");
    const files = materializeTier1WithPlans(expanded, assets, [plan]);
    assert.ok(files.length > 0, "must produce files");
    assert.ok(files.some((f) => f.path.includes("textures/item/vague_item")), "item assets must exist");
  });

  it("assets always exist in output for every item and block", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "ruby", name: "Ruby" }],
      blocks: [{ id: "ruby_block", name: "Block of Ruby" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    for (const item of expanded.items) {
      assert.ok(files.some((f) => f.path.includes(`textures/item/${item.id}`)), `texture for item ${item.id}`);
      assert.ok(files.some((f) => f.path.includes(`models/item/${item.id}`)), `model for item ${item.id}`);
    }
    for (const block of expanded.blocks) {
      assert.ok(files.some((f) => f.path.includes(`textures/block/${block.id}`)), `texture for block ${block.id}`);
      assert.ok(files.some((f) => f.path.includes(`models/block/${block.id}`)), `model for block ${block.id}`);
      assert.ok(files.some((f) => f.path.includes(`blockstates/${block.id}`)), `blockstate for block ${block.id}`);
      assert.ok(files.some((f) => f.path.includes(`models/item/${block.id}.json`)), `block-as-item model for block ${block.id}`);
    }
    assert.ok(files.some((f) => f.path.endsWith("en_us.json")), "lang file must exist");
  });

  it("smelting recipe emits MC 1.21.1 format: result string + top-level count", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "raw", name: "Raw" }, { id: "melted", name: "Melted" }],
      recipes: [
        { id: "melted_from_raw", type: "smelting", ingredients: [{ id: "raw", count: 1 }], result: { id: "melted", count: 1 } },
      ],
    });
    const expanded = expandSpecTier1(spec);
    const recipeFiles = recipeDataFiles(expanded);
    const smeltingFile = recipeFiles.find((f) => f.path.includes("melted_from_raw"));
    assert.ok(smeltingFile, "smelting recipe file must exist");
    const json = JSON.parse(smeltingFile.contents) as { result?: unknown; count?: number };
    assert.strictEqual(typeof json.result, "string", "MC 1.21.1 smelting result must be string");
    assert.strictEqual(json.count, 1, "count must be top-level number");
  });

  it("crafting_shapeless recipe emits MC 1.21.1 format: result.item string + result.count", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      recipes: [
        { id: "b_from_a", type: "crafting_shapeless", ingredients: [{ id: "a", count: 1 }], result: { id: "b", count: 1 } },
      ],
    });
    const expanded = expandSpecTier1(spec);
    const recipeFiles = recipeDataFiles(expanded);
    const craftFile = recipeFiles.find((f) => f.path.includes("b_from_a"));
    assert.ok(craftFile, "crafting recipe file must exist");
    const json = JSON.parse(craftFile.contents) as { result?: { item?: string; id?: string; count?: number } };
    assert.ok(json.result && typeof json.result === "object", "crafting result must be object");
    assert.strictEqual(typeof (json.result as { item?: string }).item, "string", "MC 1.21.1 crafting result must have result.item string");
    assert.strictEqual((json.result as { count?: number }).count, 1, "result.count must be number");
    assert.ok(!("id" in json.result) || json.result.id === undefined, "crafting result must not use result.id");
  });
});
