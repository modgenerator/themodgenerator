#!/usr/bin/env node
/**
 * Build-time script: ensure apps/builder/assets/vanilla-assets-1.21.1.zip exists.
 * Copies the FULL assets/minecraft/** tree from the Minecraft 1.21.1 client jar into the zip.
 * No path rewriting, flattening, or filtering. Zip entry paths match the client jar byte-for-byte.
 * Set FORCE_REBUILD=1 to delete existing zip and rebuild.
 */

import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const MC_VERSION = "1.21.1";
const MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const ASSETS_PREFIX = "assets/minecraft/";

/** Required entries in the zip (verification). Paths as in jar. */
const REQUIRED_ENTRIES = [
  "assets/minecraft/textures/block/stone.png",
  "assets/minecraft/textures/item/iron_ingot.png",
  "assets/minecraft/models/item/iron_ingot.json",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "..", "assets");
const zipPath = join(assetsDir, "vanilla-assets-1.21.1.zip");

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function downloadToTemp(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const { tmpdir } = await import("node:os");
  const tmpPath = join(tmpdir(), `mc-client-${MC_VERSION}-${Date.now()}.jar`);
  const out = createWriteStream(tmpPath);
  await pipeline(Readable.fromWeb(res.body), out);
  return tmpPath;
}

/**
 * Verify the zip: required entries exist and log total entry count.
 * Fails the process if any required entry is missing.
 */
async function verifyZip(zipPathToVerify) {
  const yauzl = await import("yauzl");
  return new Promise((resolve, reject) => {
    const found = new Set();
    let totalEntries = 0;
    yauzl.open(zipPathToVerify, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      if (!zipfile) {
        reject(new Error("Failed to open zip for verification"));
        return;
      }
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        const name = entry.fileName.replace(/\\/g, "/");
        totalEntries++;
        if (REQUIRED_ENTRIES.includes(name)) found.add(name);
        zipfile.readEntry();
      });
      zipfile.on("end", () => {
        zipfile.close();
        const missing = REQUIRED_ENTRIES.filter((e) => !found.has(e));
        if (missing.length) {
          reject(
            new Error(
              `[ensure-vanilla-assets] Verification failed: missing entries: ${missing.join(", ")}. Total entries in zip: ${totalEntries}.`
            )
          );
          return;
        }
        console.log("[ensure-vanilla-assets] Verification passed. Total entries in zip:", totalEntries);
        resolve();
      });
      zipfile.on("error", reject);
    });
  });
}

async function main() {
  const forceRebuild = process.env.FORCE_REBUILD === "1";
  if (existsSync(zipPath) && !forceRebuild) {
    console.log("[ensure-vanilla-assets] Already exists:", zipPath);
    await verifyZip(zipPath);
    return;
  }
  if (forceRebuild && existsSync(zipPath)) {
    unlinkSync(zipPath);
    console.log("[ensure-vanilla-assets] FORCE_REBUILD: deleted existing zip");
  }

  console.log("[ensure-vanilla-assets] Downloading Minecraft", MC_VERSION, "client jar...");
  const manifest = await fetchJson(MANIFEST_URL);
  const versionEntry = manifest.versions?.find((v) => v.id === MC_VERSION);
  if (!versionEntry?.url) throw new Error(`Version ${MC_VERSION} not found in manifest`);
  const versionJson = await fetchJson(versionEntry.url);
  const clientUrl = versionJson.downloads?.client?.url;
  if (!clientUrl) throw new Error("No client download in version JSON");

  const tmpJar = await downloadToTemp(clientUrl);
  console.log("[ensure-vanilla-assets] Copying full assets/minecraft/** into zip (no filtering)...");

  const yauzl = await import("yauzl");
  const archiver = await import("archiver");

  mkdirSync(assetsDir, { recursive: true });

  await new Promise((resolve, reject) => {
    yauzl.open(tmpJar, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      if (!zipfile) {
        reject(new Error("Failed to open jar"));
        return;
      }

      const outStream = createWriteStream(zipPath);
      const archive = archiver.default("zip", { zlib: { level: 5 } });
      archive.pipe(outStream);
      outStream.on("close", () => resolve());
      archive.on("error", reject);
      outStream.on("error", reject);

      let pending = 0;
      let ended = false;
      function maybeFinish() {
        if (ended && pending === 0) archive.finalize();
      }
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        // Use exact jar path, only normalize backslashes (no filtering, no rewriting)
        const name = entry.fileName.replace(/\\/g, "/");
        const isDir = entry.fileName.endsWith("/");
        if (!name.startsWith(ASSETS_PREFIX)) {
          zipfile.readEntry();
          return;
        }
        if (isDir) {
          zipfile.readEntry();
          return;
        }
        pending++;
        zipfile.openReadStream(entry, (errRead, readStream) => {
          if (errRead) {
            zipfile.close();
            reject(errRead);
            return;
          }
          if (!readStream) {
            pending--;
            zipfile.readEntry();
            return;
          }
          archive.append(readStream, { name });
          readStream.on("end", () => {
            pending--;
            zipfile.readEntry();
            maybeFinish();
          });
          readStream.on("error", (e) => {
            zipfile.close();
            reject(e);
          });
        });
      });
      zipfile.on("end", () => {
        ended = true;
        maybeFinish();
      });
      zipfile.on("error", reject);
    });
  });

  try {
    unlinkSync(tmpJar);
  } catch (_) {}

  console.log("[ensure-vanilla-assets] Wrote:", zipPath);
  await verifyZip(zipPath);
}

main().catch((e) => {
  console.error("[ensure-vanilla-assets]", e);
  process.exit(1);
});
