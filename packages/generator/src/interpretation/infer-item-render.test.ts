/**
 * Unit tests for inferItemRender keyword mapping (generic shape keywords → rod/plate/chunky/flat).
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { inferItemRender } from "./infer-item-render.js";

describe("inferItemRender", () => {
  it("Gear => rod (new keyword coverage)", () => {
    assert.strictEqual(inferItemRender("Gear"), "rod");
    assert.strictEqual(inferItemRender("Metal Gear"), "rod");
  });
  it("Coin / Disc => plate", () => {
    assert.strictEqual(inferItemRender("Coin"), "plate");
    assert.strictEqual(inferItemRender("Disc"), "plate");
  });
  it("Pebble / Shard / Bead => chunky", () => {
    assert.strictEqual(inferItemRender("Pebble"), "chunky");
    assert.strictEqual(inferItemRender("Crystal Shard"), "chunky");
    assert.strictEqual(inferItemRender("Bead"), "chunky");
  });
  it("Ingot / Rod => rod", () => {
    assert.strictEqual(inferItemRender("Ingot"), "rod");
    assert.strictEqual(inferItemRender("Metal Rod"), "rod");
  });
  it("generic name => chunky (default 3D when uncertain)", () => {
    assert.strictEqual(inferItemRender("Something"), "chunky");
    assert.strictEqual(inferItemRender("Custom Item"), "chunky");
  });
  it("explicit flat/icon/sprite => flat", () => {
    assert.strictEqual(inferItemRender("Flat Icon"), "flat");
    assert.strictEqual(inferItemRender("2D Sprite"), "flat");
    assert.strictEqual(inferItemRender("Icon"), "flat");
  });
});
