/**
 * Unit tests for vanilla dep collection: oak_button and oak_fence_gate must NOT
 * include non-existent textures (textures/block/oak_button.png, oak_fence_gate.png).
 * Requires vanilla-assets zip (built by ensure-vanilla-assets).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { collectVanillaDepsForBlock } from "./vanilla-dep-collector.js";
import { VANILLA_ASSETS_ZIP_FILENAME } from "./vanilla-asset-source.js";

const _dir = dirname(fileURLToPath(import.meta.url));
const zipPath = join(_dir, "..", "assets", VANILLA_ASSETS_ZIP_FILENAME);

describe("collectVanillaDepsForBlock", () => {
  it("oak_button MUST NOT include textures/block/oak_button.png; should include referenced texture (e.g. oak_planks)", async () => {
    if (!existsSync(zipPath)) {
      console.log("[SKIP] vanilla-assets zip not found, run ensure-vanilla-assets first");
      return;
    }
    const deps = await collectVanillaDepsForBlock("oak_button", "bundled_pack", {
      bundledPackRoot: zipPath,
    });
    const hasBogusButton = deps.texturePaths.some((p) => p.includes("oak_button") && p.includes("block/"));
    assert.ok(!hasBogusButton, "must NOT include block/oak_button (vanilla has no such texture)");
    assert.ok(deps.texturePaths.length >= 1, "should resolve at least one texture from models");
    const hasPlanks = deps.texturePaths.some((p) => p.includes("oak_planks"));
    assert.ok(hasPlanks, "oak_button model references oak_planks; should include block/oak_planks");
  });

  it("oak_fence_gate MUST NOT include textures/block/oak_fence_gate.png; should include referenced textures", async () => {
    if (!existsSync(zipPath)) {
      console.log("[SKIP] vanilla-assets zip not found");
      return;
    }
    const deps = await collectVanillaDepsForBlock("oak_fence_gate", "bundled_pack", {
      bundledPackRoot: zipPath,
    });
    const hasBogusFenceGate = deps.texturePaths.some((p) => p.includes("oak_fence_gate") && p.includes("block/"));
    assert.ok(!hasBogusFenceGate, "must NOT include block/oak_fence_gate (vanilla has no such texture)");
    assert.ok(deps.texturePaths.length >= 1, "should resolve at least one texture from models");
  });
});
