/**
 * Asset key canonicalization: no collisions across items+blocks; same descriptor → same keys.
 * No file paths; no Fabric conventions.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { composeTier1Stub } from "./composer-stub.js";
import type { HandheldItemDescriptor, CubeBlockDescriptor } from "@themodgenerator/spec";

describe("composeTier1Stub", () => {
  it("same descriptor always yields same keys", () => {
    const d: HandheldItemDescriptor = {
      type: "handheld_item",
      contentId: "ruby",
      material: "ruby",
      rarity: "uncommon",
    };
    const a = composeTier1Stub([d]);
    const b = composeTier1Stub([d]);
    assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
    assert.strictEqual(a.length, 2);
    assert.strictEqual(a[0].key, "item/ruby");
    assert.strictEqual(a[1].key, "item/ruby");
    assert.strictEqual(a[0].kind, "texture");
    assert.strictEqual(a[1].kind, "model");
  });

  it("no collisions across items and blocks: item/ruby vs block/ruby", () => {
    const itemD: HandheldItemDescriptor = {
      type: "handheld_item",
      contentId: "ruby",
      material: "ruby",
      rarity: "common",
    };
    const blockD: CubeBlockDescriptor = {
      type: "cube_block",
      contentId: "ruby",
      material: "ruby",
    };
    const keys = composeTier1Stub([itemD, blockD]);
    const itemKeys = keys.filter((k) => k.category === "item");
    const blockKeys = keys.filter((k) => k.category === "block");
    assert.strictEqual(itemKeys.length, 2);
    assert.strictEqual(blockKeys.length, 2);
    assert.strictEqual(itemKeys[0].key, "item/ruby");
    assert.strictEqual(blockKeys[0].key, "block/ruby");
    const keySet = new Set(keys.map((k) => `${k.category}:${k.kind}:${k.key}`));
    assert.strictEqual(keySet.size, 4, "item texture, item model, block texture, block model");
  });

  it("item keys use item namespace", () => {
    const d: HandheldItemDescriptor = {
      type: "handheld_item",
      contentId: "ingot",
      material: "generic",
      rarity: "common",
    };
    const keys = composeTier1Stub([d]);
    assert.ok(keys.every((k) => k.category === "item"));
    assert.ok(keys.every((k) => k.key.startsWith("item/")));
    assert.strictEqual(keys[0].key, "item/ingot");
  });

  it("block keys use block namespace", () => {
    const d: CubeBlockDescriptor = {
      type: "cube_block",
      contentId: "stone_block",
      material: "generic",
    };
    const keys = composeTier1Stub([d]);
    assert.ok(keys.every((k) => k.category === "block"));
    assert.ok(keys.every((k) => k.key.startsWith("block/")));
    assert.strictEqual(keys[0].key, "block/stone_block");
  });
});
