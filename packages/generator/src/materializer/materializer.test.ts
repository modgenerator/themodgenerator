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
import {
  materializeTier1,
  materializeTier1WithPlans,
  recipeDataFiles,
  fabricScaffoldFiles,
  validateNoMinecraftPlanksInRecipes,
  validateWoodBlocksHaveLootTables,
  validateWoodRecipeCoverage,
} from "./index.js";
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
      /^src\/main\/resources\/data\/[a-z0-9_]+\/recipe\/[a-z0-9_]+\.json$/,
      /^src\/main\/resources\/data\/[a-z0-9_]+\/tags\/(items|blocks)\/[a-z0-9_]+\.json$/,
      /^src\/main\/resources\/data\/[a-z0-9_]+\/tags\/blocks\/mineable\/[a-z0-9_]+\.json$/,
      /^src\/main\/resources\/data\/[a-z0-9_]+\/loot_tables\/blocks\/[a-z0-9_]+\.json$/,
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

  it("smelting recipe emits MC 1.21.1 format: result { id, count }", () => {
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
    const json = JSON.parse(smeltingFile.contents) as { result?: { id: string; count: number } };
    assert.ok(json.result && typeof json.result === "object", "MC 1.21.1 smelting result must be object");
    assert.strictEqual(typeof json.result.id, "string", "result.id must be string");
    assert.strictEqual(json.result.count, 1, "result.count must be number");
  });

  it("crafting_shapeless recipe emits MC 1.21.1 format: result.id string + result.count", () => {
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
    const json = JSON.parse(craftFile.contents) as { result?: { id?: string; count?: number } };
    assert.ok(json.result && typeof json.result === "object", "crafting result must be object");
    assert.strictEqual(typeof (json.result as { id?: string }).id, "string", "MC 1.21.1 crafting result must have result.id string");
    assert.strictEqual((json.result as { count?: number }).count, 1, "result.count must be number");
  });

  it("integration: shaped + shapeless + smelting all emit valid MC 1.21.1 JSON", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "ingot", name: "Ingot" }, { id: "nugget", name: "Nugget" }, { id: "block", name: "Block" }, { id: "melted", name: "Melted" }],
      blocks: [{ id: "block", name: "Block" }],
      recipes: [
        { id: "block_from_ingots", type: "crafting_shaped", pattern: ["###", "###", "###"], key: { "#": { id: "ingot" } }, result: { id: "block", count: 1 } },
        { id: "ingots_from_block", type: "crafting_shapeless", ingredients: [{ id: "block", count: 1 }], result: { id: "ingot", count: 9 } },
        { id: "melted_from_ingot", type: "smelting", ingredients: [{ id: "ingot", count: 1 }], result: { id: "melted", count: 1 } },
      ],
    });
    const expanded = expandSpecTier1(spec);
    const recipeFiles = recipeDataFiles(expanded);
    assert.strictEqual(recipeFiles.length, 3, "must emit 3 recipe files");

    const shaped = recipeFiles.find((f) => f.path.includes("block_from_ingots"));
    assert.ok(shaped, "shaped recipe file must exist");
    const shapedJson = JSON.parse(shaped!.contents) as { type: string; pattern?: string[]; key?: unknown; result?: { id: string; count: number } };
    assert.strictEqual(shapedJson.type, "minecraft:crafting_shaped");
    assert.ok(Array.isArray(shapedJson.pattern) && shapedJson.pattern.length === 3);
    assert.ok(shapedJson.result && typeof shapedJson.result.id === "string" && shapedJson.result.id.includes(":block"));
    assert.strictEqual(shapedJson.result.count, 1);

    const shapeless = recipeFiles.find((f) => f.path.includes("ingots_from_block"));
    assert.ok(shapeless);
    const shapelessJson = JSON.parse(shapeless!.contents) as { type: string; result?: { id: string; count: number } };
    assert.strictEqual(shapelessJson.type, "minecraft:crafting_shapeless");
    assert.ok(shapelessJson.result?.id && shapelessJson.result.count === 9);

    const smelting = recipeFiles.find((f) => f.path.includes("melted_from_ingot"));
    assert.ok(smelting);
    const smeltingJson = JSON.parse(smelting!.contents) as { type: string; result: { id: string; count: number } };
    assert.strictEqual(smeltingJson.type, "minecraft:smelting");
    assert.strictEqual(typeof smeltingJson.result.id, "string");
    assert.strictEqual(smeltingJson.result.count, 1);

    assert.ok(recipeFiles.every((f) => f.path.startsWith("src/main/resources/data/test_mod/recipe/")), "recipes must be under data/<modId>/recipe/");
  });

  it("smelting recipe emits file under data/<modId>/recipe/ with result.id (1.21.1, no legacy result.item)", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "raw_tin", name: "Raw Tin" }, { id: "tin_ingot", name: "Tin Ingot" }],
      recipes: [
        { id: "tin_ingot_from_raw_tin_smelting", type: "smelting", ingredients: [{ id: "raw_tin", count: 1 }], result: { id: "tin_ingot", count: 1 } },
      ],
    });
    const expanded = expandSpecTier1(spec);
    const files = recipeDataFiles(expanded);
    const smeltingFile = files.find((f) => f.path.includes("tin_ingot_from_raw_tin_smelting"));
    assert.ok(smeltingFile, "smelting recipe file must exist under data/<modId>/recipe/");
    assert.ok(smeltingFile.path.startsWith("src/main/resources/data/") && smeltingFile.path.includes("/recipe/"), "path must be data/<modId>/recipe/<id>.json");
    const json = JSON.parse(smeltingFile.contents) as { type: string; ingredient: { item: string }; result: { id?: string; item?: string; count?: number }; experience?: number; cookingtime?: number };
    assert.strictEqual(json.type, "minecraft:smelting");
    assert.ok("result" in json && typeof json.result === "object");
    assert.strictEqual(typeof json.result.id, "string", "MC 1.21.1 must use result.id string");
    assert.ok(!("item" in json.result), "result must not use legacy result.item");
    assert.strictEqual(json.result.count, 1);
  });

  it("integration: smoking and campfire_cooking emit same schema as smelting (result { id, count }, ingredient.item)", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "raw", name: "Raw" }, { id: "cooked", name: "Cooked" }, { id: "smoked", name: "Smoked" }, { id: "campfire", name: "Campfire" }],
      recipes: [
        { id: "smoked_from_raw", type: "smoking", ingredients: [{ id: "raw", count: 1 }], result: { id: "smoked", count: 1 } },
        { id: "campfire_from_raw", type: "campfire_cooking", ingredients: [{ id: "raw", count: 1 }], result: { id: "campfire", count: 1 } },
      ],
    });
    const expanded = expandSpecTier1(spec);
    const recipeFiles = recipeDataFiles(expanded);
    assert.strictEqual(recipeFiles.length, 2, "must emit 2 recipe files");

    const smokingFile = recipeFiles.find((f) => f.path.includes("smoked_from_raw"));
    assert.ok(smokingFile, "smoking recipe file must exist");
    const smokingJson = JSON.parse(smokingFile!.contents) as { type: string; ingredient: { item: string }; result: { id: string; count: number } };
    assert.strictEqual(smokingJson.type, "minecraft:smoking");
    assert.strictEqual(typeof smokingJson.result?.id, "string", "cooking result must have id");
    assert.ok(smokingJson.result.id.includes(":smoked"));
    assert.strictEqual(smokingJson.result.count, 1);
    assert.strictEqual(typeof smokingJson.ingredient?.item, "string");

    const campfireFile = recipeFiles.find((f) => f.path.includes("campfire_from_raw"));
    assert.ok(campfireFile, "campfire recipe file must exist");
    const campfireJson = JSON.parse(campfireFile!.contents) as { type: string; ingredient: { item: string }; result: { id: string; count: number } };
    assert.strictEqual(campfireJson.type, "minecraft:campfire_cooking");
    assert.strictEqual(typeof campfireJson.result?.id, "string", "cooking result must have id");
    assert.ok(campfireJson.result.id.includes(":campfire"));
    assert.strictEqual(campfireJson.result.count, 1);
    assert.strictEqual(typeof campfireJson.ingredient?.item, "string");
  });

  it("item with itemRender rod produces item model JSON containing elements", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "metal_rod", name: "Metal Rod", itemRender: "rod" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const itemModel = files.find((f) => f.path.includes("models/item/metal_rod.json"));
    assert.ok(itemModel, "item model for metal_rod must exist");
    assert.ok(itemModel.contents.includes('"elements"'), "rod item model must contain elements");
    const parsed = JSON.parse(itemModel.contents) as { elements?: unknown[] };
    assert.ok(Array.isArray(parsed.elements) && parsed.elements.length > 0, "elements must be non-empty array");
  });

  it("item with inferred keyword (Gear) itemRender rod produces model with elements", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "gear", name: "Gear", itemRender: "rod" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const itemModel = files.find((f) => f.path.includes("models/item/gear.json"));
    assert.ok(itemModel, "item model for gear must exist");
    assert.ok(itemModel.contents.includes('"elements"'), "gear (rod) item model must contain elements");
    const parsed = JSON.parse(itemModel.contents) as { elements?: unknown[] };
    assert.ok(Array.isArray(parsed.elements) && parsed.elements.length > 0, "elements must be non-empty array");
  });

  it("unspecified normal item defaults to chunky and model has elements", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "thing", name: "Thing" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const itemModel = files.find((f) => f.path.includes("models/item/thing.json"));
    assert.ok(itemModel, "item model for thing must exist");
    assert.ok(itemModel.contents.includes('"elements"'), "default chunky item model must contain elements");
    const parsed = JSON.parse(itemModel.contents) as { elements?: unknown[]; parent?: string };
    assert.ok(Array.isArray(parsed.elements) && parsed.elements.length > 0, "elements must be non-empty array");
  });

  it("explicit flat icon stays minecraft:item/generated", () => {
    const spec = minimalTier1Spec({
      items: [{ id: "flat_icon", name: "Flat Icon", itemRender: "flat" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const itemModel = files.find((f) => f.path.includes("models/item/flat_icon.json"));
    assert.ok(itemModel, "item model for flat_icon must exist");
    assert.ok(itemModel.contents.includes("minecraft:item/generated"), "flat item must use minecraft:item/generated");
    const parsed = JSON.parse(itemModel.contents) as { parent?: string; elements?: unknown[] };
    assert.strictEqual(parsed.parent, "minecraft:item/generated");
    assert.ok(!parsed.elements || parsed.elements.length === 0, "flat item must not have elements");
  });

  it("wood type Maple: all maple_* ids present and each texture file has copyFromVanillaPaths (non-red)", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    const mapleTextureFiles = files.filter(
      (f) => f.path.endsWith(".png") && (f.path.includes("maple_") || f.path.includes("/maple_"))
    );
    assert.ok(mapleTextureFiles.length > 0, "must have at least one maple texture file");
    for (const f of mapleTextureFiles) {
      assert.ok(
        f.copyFromVanillaPaths && f.copyFromVanillaPaths.length > 0,
        `maple texture ${f.path} must have copyFromVanillaPaths so builder can copy vanilla (no red)`
      );
      for (const vanillaPath of f.copyFromVanillaPaths) {
        assert.ok(
          !vanillaPath.includes("_button") && !vanillaPath.includes("_pressure_plate"),
          `maple texture ${f.path} must not request non-existent vanilla paths (no *_button.png or *_pressure_plate.png): got ${vanillaPath}`
        );
      }
    }
    const woodBlockIds = expanded.blocks.map((b) => b.id).filter((id) => id.startsWith("maple_"));
    assert.ok(woodBlockIds.includes("maple_log"));
    assert.ok(woodBlockIds.includes("maple_planks"));
    assert.ok(woodBlockIds.includes("maple_stairs"));
    const recipeIds = (expanded.spec.recipes ?? []).map((r) => r.id);
    assert.ok(recipeIds.includes("maple_planks_from_log"));
    assert.ok(recipeIds.includes("wooden_sword_from_maple_planks"), "wooden tools from generated planks");
  });

  it("wood type Maple: tags under mod namespace, #minecraft:planks merge, loot tables", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);

    // Additive merge into #minecraft:planks so vanilla wooden tools work (replace: false)
    const minecraftPlanksTag = files.find((f) => f.path === "src/main/resources/data/minecraft/tags/items/planks.json");
    assert.ok(minecraftPlanksTag, "must generate data/minecraft/tags/items/planks.json for #minecraft:planks merge");
    const minecraftPlanksData = JSON.parse(minecraftPlanksTag!.contents) as { replace?: boolean; values: string[] };
    assert.strictEqual(minecraftPlanksData.replace, false, "must use replace:false so additive merge (not overwrite vanilla tag)");
    assert.ok(
      minecraftPlanksData.values.some((v) => v === "test_mod:maple_planks"),
      "must include test_mod:maple_planks in #minecraft:planks for vanilla recipes"
    );

    const planksTag = files.find((f) => f.path.includes("data/test_mod/tags/items/planks.json"));
    assert.ok(planksTag, "must generate mod-namespace tags/items/planks.json");
    const planksData = JSON.parse(planksTag!.contents) as { replace: boolean; values: string[] };
    assert.ok(
      planksData.values.some((v) => v.includes("maple_planks")),
      "planks tag must include maple_planks"
    );

    const axeTag = files.find((f) => f.path.includes("data/test_mod/tags/blocks/mineable/axe.json"));
    assert.ok(axeTag, "must generate mod-namespace tags/blocks/mineable/axe.json");
    const axeData = JSON.parse(axeTag!.contents) as { values: string[] };
    assert.ok(axeData.values.some((v) => v.includes("maple_log")), "mineable/axe must include maple_log");
    assert.ok(axeData.values.some((v) => v.includes("maple_planks")), "mineable/axe must include maple_planks");

    const lootMaplePlanks = files.find((f) => f.path.includes("loot_tables/blocks/maple_planks.json"));
    assert.ok(lootMaplePlanks, "must generate loot table for maple_planks so survival break drops item");
    const lootData = JSON.parse(lootMaplePlanks!.contents) as { type: string; pools: unknown[] };
    assert.strictEqual(lootData.type, "minecraft:block");
    assert.ok(lootData.pools.length >= 1);

    // All wood-family blocks must have loot tables so survival break drops correctly
    const woodBlockIds = expanded.blocks
      .filter((b) => expanded.spec.woodTypes?.some((w) => b.id.startsWith(w.id + "_")))
      .map((b) => b.id);
    for (const blockId of woodBlockIds) {
      const lootFile = files.find((f) => f.path.includes(`loot_tables/blocks/${blockId}.json`));
      assert.ok(lootFile, `must generate loot table for wood block ${blockId} so survival break drops item`);
    }
  });

  it("wood type Maple with modId generated: data/minecraft/tags/items/planks.json in output (jar-level)", () => {
    const spec = minimalTier1Spec({
      modId: "generated",
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);

    const minecraftPlanksTag = files.find((f) => f.path === "src/main/resources/data/minecraft/tags/items/planks.json");
    assert.ok(minecraftPlanksTag, "FINAL output must include data/minecraft/tags/items/planks.json (in JAR resources)");
    const data = JSON.parse(minecraftPlanksTag!.contents) as { replace?: boolean; values: string[] };
    assert.strictEqual(data.replace, false, "replace must be false for additive merge");
    assert.ok(
      data.values.includes("generated:maple_planks"),
      "must contain generated:maple_planks for /execute if items #minecraft:planks"
    );
    // Runtime sanity: holding generated:maple_planks, /execute if items entity @s weapon.mainhand #minecraft:planks run say TAG_OK should print TAG_OK
  });

  it("wood type Maple: block registration uses strength, BlockSoundGroup.WOOD, burnable (no dropsNothing)", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const scaffold = fabricScaffoldFiles(expanded);
    const javaFile = scaffold.find((f) => f.path.endsWith(".java") && !f.path.includes("StrippablePlanks"));
    assert.ok(javaFile, "must generate Mod main Java");
    const contents = javaFile!.contents;
    assert.ok(contents.includes("strength(2.0f, 3.0f)"), "wood blocks must have strength so they do not insta-break");
    assert.ok(contents.includes("BlockSoundGroup.WOOD"), "wood blocks must have wood sound group");
    assert.ok(contents.includes("burnable()"), "wood blocks must be burnable (vanilla-equivalent)");
    assert.ok(!contents.includes("dropsNothing"), "wood blocks must NOT call dropsNothing (loot tables must apply)");
    assert.ok(!contents.includes("noDrops"), "wood blocks must NOT call noDrops");
  });

  it("wood type Maple: planks tag under mod namespace, no stripped_planks in tag", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);

    const planksTag = files.find((f) => f.path.includes("data/test_mod/tags/items/planks.json"));
    assert.ok(planksTag, "must generate mod-namespace planks tag");
    const planksData = JSON.parse(planksTag!.contents) as { values: string[] };
    assert.ok(
      planksData.values.some((v) => v.includes("maple_planks")),
      "planks tag must include maple_planks"
    );
    assert.ok(
      !planksData.values.some((v) => v.includes("stripped_planks")),
      "planks tag must NOT include stripped_planks (vanilla stripping is log/wood only)"
    );
  });

  it("wood type Maple: log and wood are PillarBlock (AXIS for StrippableBlockRegistry)", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const scaffold = fabricScaffoldFiles(expanded);
    const javaFile = scaffold.find((f) => f.path.endsWith("Mod.java") || f.path.includes("TestModMod.java"));
    assert.ok(javaFile, "must generate Mod main Java");
    const contents = javaFile!.contents;
    assert.ok(contents.includes("new PillarBlock("), "must use PillarBlock for log/wood blocks");
    for (const id of ["maple_log", "maple_stripped_log", "maple_wood", "maple_stripped_wood"]) {
      const regLine = contents.split("\n").find((l) => l.includes(`"${id}"`) && l.includes("Registry.register(Registries.BLOCK"));
      assert.ok(regLine?.includes("PillarBlock"), `block ${id} must be registered as PillarBlock`);
    }
    const planksRegLine = contents.split("\n").find((l) => l.includes('"maple_planks"') && l.includes("Registry.register(Registries.BLOCK"));
    assert.ok(planksRegLine?.includes("new Block(") && !planksRegLine.includes("PillarBlock"), "maple_planks must be Block not PillarBlock");
  });

  it("wood type Maple: StrippableBlockRegistry only for log and wood (registerStrippableIfHasAxis)", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const scaffold = fabricScaffoldFiles(expanded);
    const javaFile = scaffold.find((f) => f.path.endsWith("Mod.java") || f.path.includes("TestModMod.java"));
    assert.ok(javaFile, "must generate Mod main Java");
    const contents = javaFile!.contents;
    assert.ok(
      contents.includes("registerStrippableIfHasAxis"),
      "must use AXIS safety guard to avoid StrippableBlockRegistry crash"
    );
    assert.ok(
      contents.includes("Properties.AXIS"),
      "safety guard must check for AXIS property"
    );
    assert.ok(
      contents.includes("registerStrippableIfHasAxis(maple_logBlock, maple_stripped_logBlock)"),
      "must register log -> stripped_log only"
    );
    assert.ok(
      contents.includes("registerStrippableIfHasAxis(maple_woodBlock, maple_stripped_woodBlock)"),
      "must register wood -> stripped_wood only"
    );
    const invocationLines = contents
      .split("\n")
      .filter((l) => l.includes("registerStrippableIfHasAxis(") && !l.includes("Block input"));
    assert.strictEqual(invocationLines.length, 2, "only log and wood pairs (no planks, stairs, etc.)");
    assert.ok(!invocationLines.some((l) => l.includes("planks") || l.includes("stairs")), "strippable only for log and wood");
  });

  it("wood type Maple: vanilla-equivalent recipes (sticks, crafting table, chest, wooden tools, barrel, shield) from our planks", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);

    const sticksRecipe = files.find((f) => f.path.includes("recipe/sticks_from_maple_planks.json"));
    assert.ok(sticksRecipe, "must generate sticks_from_maple_planks recipe");
    const sticksData = JSON.parse(sticksRecipe!.contents) as { result?: { id?: string; count?: number } };
    assert.strictEqual(sticksData.result?.id, "minecraft:stick");
    assert.strictEqual(sticksData.result?.count, 4);

    const tableRecipe = files.find((f) => f.path.includes("recipe/crafting_table_from_maple_planks.json"));
    assert.ok(tableRecipe, "must generate crafting_table_from_maple_planks recipe");
    const tableData = JSON.parse(tableRecipe!.contents) as { result?: { id?: string } };
    assert.strictEqual(tableData.result?.id, "minecraft:crafting_table");

    const chestRecipe = files.find((f) => f.path.includes("recipe/chest_from_maple_planks.json"));
    assert.ok(chestRecipe, "must generate chest_from_maple_planks recipe");
    const chestData = JSON.parse(chestRecipe!.contents) as { result?: { id?: string } };
    assert.strictEqual(chestData.result?.id, "minecraft:chest");

    assert.ok(files.some((f) => f.path.includes("recipe/wooden_sword_from_maple_planks.json")), "wooden sword recipe");
    assert.ok(files.some((f) => f.path.includes("recipe/barrel_from_maple_planks.json")), "barrel recipe");
    assert.ok(files.some((f) => f.path.includes("recipe/shield_from_maple_planks.json")), "shield recipe");
    assert.ok(files.some((f) => f.path.includes("recipe/bowl_from_maple_planks.json")), "bowl recipe");
  });

  it("CI validator: no recipe references #minecraft:planks", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    assert.doesNotThrow(
      () => validateNoMinecraftPlanksInRecipes(files),
      "generated recipes must not use #minecraft:planks"
    );
    // Verify validator would fail on bad content
    const badFiles = [{ path: "src/main/resources/data/test_mod/recipe/bad.json", contents: '{"ingredient":{"tag":"#minecraft:planks"}}' }];
    assert.throws(
      () => validateNoMinecraftPlanksInRecipes(badFiles),
      /#minecraft:planks/,
      "validator must throw when recipe references #minecraft:planks"
    );
  });

  it("CI validator: wood blocks have loot tables", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    assert.doesNotThrow(
      () => validateWoodBlocksHaveLootTables(expanded, files),
      "all wood blocks must have loot tables"
    );
  });

  it("CI validator: wood recipes include tools, barrel, bowl, shield", () => {
    const spec = minimalTier1Spec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);
    assert.doesNotThrow(
      () => validateWoodRecipeCoverage(expanded, files),
      "wood types must have wooden tools, barrel, bowl, shield recipes"
    );
  });
});
