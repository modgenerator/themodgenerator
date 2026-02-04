/**
 * Default visuals: classifyEntityVisualKind + resolveVanillaVisualDefaults.
 * Ensures ingot → iron_ingot + generated, sword → handheld + iron_sword, armor helmet → iron_helmet.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  classifyEntityVisualKind,
  resolveVanillaVisualDefaults,
  VisualKind,
} from "./vanilla-visual-defaults.js";

describe("classifyEntityVisualKind", () => {
  it("ingot-like id classifies as INGOT", () => {
    assert.strictEqual(classifyEntityVisualKind({ id: "tin_ingot", name: "Tin Ingot" }), VisualKind.INGOT);
    assert.strictEqual(classifyEntityVisualKind({ id: "copper_ingot", name: "Copper Ingot" }), VisualKind.INGOT);
  });

  it("sword-like id classifies as TOOL_SWORD", () => {
    assert.strictEqual(classifyEntityVisualKind({ id: "ruby_sword", name: "Ruby Sword" }), VisualKind.TOOL_SWORD);
  });

  it("helmet-like id classifies as ARMOR_HELMET", () => {
    assert.strictEqual(classifyEntityVisualKind({ id: "diamond_helmet", name: "Diamond Helmet" }), VisualKind.ARMOR_HELMET);
  });

  it("block with type=block classifies by block patterns", () => {
    assert.strictEqual(
      classifyEntityVisualKind({ id: "maple_planks", name: "Maple Planks", type: "block" }),
      VisualKind.PLANKS
    );
  });
});

describe("resolveVanillaVisualDefaults", () => {
  it("item with ingot-like id returns copyFromVanillaPaths iron_ingot and modelParent generated", () => {
    const result = resolveVanillaVisualDefaults({ id: "tin_ingot", name: "Tin Ingot" });
    assert.ok(result.copyFromVanillaPaths.includes("item/iron_ingot"));
    assert.strictEqual(result.modelParent, "minecraft:item/generated");
    assert.strictEqual(result.visualKind, VisualKind.INGOT);
  });

  it("sword tool returns modelParent handheld and copies iron_sword texture", () => {
    const result = resolveVanillaVisualDefaults({ id: "ruby_sword", name: "Ruby Sword" });
    assert.ok(result.copyFromVanillaPaths.includes("item/iron_sword"));
    assert.strictEqual(result.modelParent, "minecraft:item/handheld");
    assert.strictEqual(result.visualKind, VisualKind.TOOL_SWORD);
  });

  it("armor helmet returns copyFromVanillaPaths iron_helmet", () => {
    const result = resolveVanillaVisualDefaults({ id: "diamond_helmet", name: "Diamond Helmet" });
    assert.ok(result.copyFromVanillaPaths.includes("item/iron_helmet"));
    assert.strictEqual(result.visualKind, VisualKind.ARMOR_HELMET);
  });

  it("block log returns oak_log and cube_all parent", () => {
    const result = resolveVanillaVisualDefaults({
      id: "maple_log",
      name: "Maple Log",
      type: "block",
    });
    assert.ok(result.copyFromVanillaPaths.includes("block/oak_log"));
    assert.strictEqual(result.modelParent, "minecraft:block/cube_all");
    assert.strictEqual(result.visualKind, VisualKind.LOG);
  });
});
