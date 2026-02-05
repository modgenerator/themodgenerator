/**
 * E2E regression: "Add a new wood type called Maple" build must succeed with no
 * [VANILLA_ASSETS] Entry not found in jar. Uses collector-driven vanilla paths
 * (no guessed oak_button.png / oak_fence_gate.png). Requires vanilla-assets zip.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  expandSpecTier1,
  type ModSpecV1,
} from "@themodgenerator/spec";
import {
  materializeTier1,
  composeTier1Stub,
} from "@themodgenerator/generator";
import { writeMaterializedFiles } from "./write-materialized-files.js";
import { VANILLA_ASSETS_ZIP_FILENAME } from "./vanilla-asset-source.js";

const _dir = dirname(fileURLToPath(import.meta.url));
const zipPath = join(_dir, "..", "assets", VANILLA_ASSETS_ZIP_FILENAME);

function minimalSpec(overrides: Partial<ModSpecV1> = {}): ModSpecV1 {
  return {
    schemaVersion: 1,
    minecraftVersion: "1.21.1",
    loader: "fabric",
    modId: "maple_mod",
    modName: "Maple Mod",
    features: ["hello-world"],
    items: [],
    blocks: [],
    ...overrides,
  };
}

describe("E2E Maple wood type build", () => {
  it("writeMaterializedFiles with Maple wood type and bundled_pack completes without VANILLA_ASSETS missing errors", async () => {
    if (!existsSync(zipPath)) {
      console.log("[SKIP] vanilla-assets zip not found, run ensure-vanilla-assets first");
      return;
    }
    const spec = minimalSpec({
      woodTypes: [{ id: "maple", displayName: "Maple" }],
    });
    const expanded = expandSpecTier1(spec);
    const assets = composeTier1Stub(expanded.descriptors);
    const files = materializeTier1(expanded, assets);

    const workDir = mkdtempSync(join(tmpdir(), "maple-e2e-"));
    const savedSource = process.env.VANILLA_ASSETS_SOURCE;
    const savedPack = process.env.VANILLA_ASSETS_PACK;
    try {
      process.env.VANILLA_ASSETS_SOURCE = "bundled_pack";
      process.env.VANILLA_ASSETS_PACK = zipPath;
      await writeMaterializedFiles(files, workDir, { mcVersion: "1.21.1" });
      const written = readdirSync(workDir, { recursive: true }) as string[];
      const maplePngs = written.filter(
        (p) => typeof p === "string" && p.includes("maple") && p.endsWith(".png")
      );
      assert.ok(
        maplePngs.length > 0,
        "build must write at least one maple texture PNG"
      );
    } finally {
      if (savedSource !== undefined) process.env.VANILLA_ASSETS_SOURCE = savedSource;
      else delete process.env.VANILLA_ASSETS_SOURCE;
      if (savedPack !== undefined) process.env.VANILLA_ASSETS_PACK = savedPack;
      else delete process.env.VANILLA_ASSETS_PACK;
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
