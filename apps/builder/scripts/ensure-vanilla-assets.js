#!/usr/bin/env node
/**
 * Build-time script: ensure apps/builder/assets/vanilla-assets-1.21.1.zip exists.
 * If not, download Minecraft 1.21.1 client jar from Mojang and extract assets/minecraft/** into that zip.
 * Run from repo root or apps/builder: npm run ensure-vanilla-assets -w @themodgenerator/builder
 */

import { createWriteStream, existsSync, mkdirSync, createReadStream } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const MC_VERSION = "1.21.1";
const MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const ASSETS_PREFIX = "assets/minecraft/";

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

async function main() {
  if (existsSync(zipPath)) {
    console.log("[ensure-vanilla-assets] Already exists:", zipPath);
    return;
  }

  console.log("[ensure-vanilla-assets] Downloading Minecraft", MC_VERSION, "client jar...");
  const manifest = await fetchJson(MANIFEST_URL);
  const versionEntry = manifest.versions?.find((v) => v.id === MC_VERSION);
  if (!versionEntry?.url) throw new Error(`Version ${MC_VERSION} not found in manifest`);
  const versionJson = await fetchJson(versionEntry.url);
  const clientUrl = versionJson.downloads?.client?.url;
  if (!clientUrl) throw new Error("No client download in version JSON");

  const tmpJar = await downloadToTemp(clientUrl);
  console.log("[ensure-vanilla-assets] Extracting assets/minecraft/** into zip...");

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
        const name = entry.fileName.replace(/\\/g, "/");
        if (!name.startsWith(ASSETS_PREFIX) || entry.fileName.endsWith("/")) {
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
    const { unlinkSync } = await import("node:fs");
    unlinkSync(tmpJar);
  } catch (_) {}

  console.log("[ensure-vanilla-assets] Wrote:", zipPath);
}

main().catch((e) => {
  console.error("[ensure-vanilla-assets]", e);
  process.exit(1);
});
