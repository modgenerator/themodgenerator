/**
 * Resolve and read vanilla Minecraft assets (client jar or bundled pack).
 * Used when MaterializedFile has copyFromVanillaPaths so we copy instead of generating.
 * Fail loud with clear error if assets source is not found.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";
import { env } from "node:process";

/** Canonical filename for the repo-bundled vanilla assets zip (MC 1.21.1). */
export const VANILLA_ASSETS_ZIP_FILENAME = "vanilla-assets-1.21.1.zip";

const _thisDir = dirname(fileURLToPath(import.meta.url));

/**
 * Path to zip inside dist (runtime container). When running from dist/vanilla-asset-source.js
 * this is dist/assets/vanilla-assets-1.21.1.zip — the path copied in during Docker build.
 */
function getDistAssetsZipPath(): string {
  return join(_thisDir, "assets", VANILLA_ASSETS_ZIP_FILENAME);
}

/**
 * Fallback for local dev: builder package's assets dir + zip (../assets from dist).
 * See docs/VANILLA-DEFAULTS.md.
 */
export function getDefaultVanillaAssetsPackPath(): string {
  return join(_thisDir, "..", "assets", VANILLA_ASSETS_ZIP_FILENAME);
}

/**
 * Resolution order for bundled_pack root:
 * a) options override / VANILLA_ASSETS_PACK (if set)
 * b) dist/assets/vanilla-assets-1.21.1.zip (if exists)
 * c) ../assets/vanilla-assets-1.21.1.zip (local dev fallback)
 */
export function getResolvedBundledPackPath(override?: string): string {
  if (override?.trim()) return override;
  if (env.VANILLA_ASSETS_PACK?.trim()) return env.VANILLA_ASSETS_PACK;
  const distPath = getDistAssetsZipPath();
  if (existsSync(distPath)) return distPath;
  return getDefaultVanillaAssetsPackPath();
}

/** Call at startup when using bundled_pack: log chosen path, existence, and size. */
export function logVanillaAssetsPackAtStartup(): void {
  const override = env.VANILLA_ASSETS_PACK?.trim();
  const distPath = getDistAssetsZipPath();
  const fallbackPath = getDefaultVanillaAssetsPackPath();
  const path = override ?? (existsSync(distPath) ? distPath : fallbackPath);
  const source = override ? "VANILLA_ASSETS_PACK (env)" : existsSync(distPath) ? "dist/assets (runtime zip)" : "../assets (local dev fallback)";
  const exists = existsSync(path);
  let sizeStr = "N/A";
  if (exists) {
    try {
      const stat = statSync(path);
      sizeStr = `${stat.size} bytes`;
    } catch {
      sizeStr = "(stat failed)";
    }
  }
  console.log("[VANILLA_ASSETS] Bundled pack resolution:", {
    source,
    path,
    exists,
    size: sizeStr,
  });
  if (!exists) {
    console.error("[VANILLA_ASSETS] Bundled pack path does not exist. Set VANILLA_ASSETS_PACK or ensure the zip is at dist/assets or ../assets.");
  }
}

export type VanillaAssetsSource = "client_jar" | "bundled_pack";

const DEFAULT_MC_VERSION = "1.21.1";

/**
 * Resolve Minecraft client jar path from MC version.
 * Windows: %APPDATA%\.minecraft\versions\<version>\<version>.jar
 * macOS/Linux: ~/.minecraft/versions/<version>/<version>.jar
 */
export function resolveClientJarPath(mcVersion: string): string {
  const v = mcVersion || DEFAULT_MC_VERSION;
  let base: string;
  if (platform() === "win32") {
    const appData = env.APPDATA || join(env.USERPROFILE || env.HOME || "", "AppData", "Roaming");
    base = join(appData, ".minecraft", "versions", v);
  } else {
    const home = env.HOME || "~";
    base = join(home, ".minecraft", "versions", v);
  }
  return join(base, `${v}.jar`);
}

/**
 * Path inside the jar to a texture. vanillaPath is relative to assets/minecraft/textures (e.g. "item/iron_ingot").
 */
function jarEntryPath(vanillaPath: string): string {
  const withExt = vanillaPath.endsWith(".png") ? vanillaPath : `${vanillaPath}.png`;
  return `assets/minecraft/textures/${withExt}`;
}

/**
 * Full entry path inside jar/pack (e.g. "assets/minecraft/blockstates/oak_button.json").
 * Used for blockstates, models, and textures.
 */
export function getVanillaAssetEntryPath(relativeTo: "textures" | "root", vanillaPath: string): string {
  if (relativeTo === "textures") {
    const withExt = vanillaPath.endsWith(".png") ? vanillaPath : `${vanillaPath}.png`;
    return `assets/minecraft/textures/${withExt}`;
  }
  return vanillaPath.startsWith("assets/") ? vanillaPath : `assets/minecraft/${vanillaPath}`;
}

/**
 * Read one file from a zip (jar) into a buffer. Uses yauzl for zip reading.
 * Fail loud if yauzl is not available.
 */
async function readEntryFromZip(zipPath: string, entryPath: string): Promise<Buffer> {
  const yauzl = await import("yauzl").catch(() => null);
  if (!yauzl?.open) {
    throw new Error(
      `[VANILLA_ASSETS] Reading from client_jar requires the "yauzl" package. Install it in the builder: npm install yauzl. Jar path: ${zipPath}`
    );
  }
  const normalizedEntry = entryPath.replace(/\\/g, "/");
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile: import("yauzl").ZipFile | undefined) => {
      if (err) {
        reject(err);
        return;
      }
      if (!zipfile) {
        reject(new Error("[VANILLA_ASSETS] Failed to open zip"));
        return;
      }
      zipfile.readEntry();
      zipfile.on("entry", (entry: import("yauzl").Entry) => {
        const entryName = entry.fileName.replace(/\\/g, "/");
        if (entryName !== normalizedEntry) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (errRead: Error | null, readStream?: NodeJS.ReadableStream) => {
          if (errRead) {
            zipfile.close();
            reject(errRead);
            return;
          }
          if (!readStream) {
            zipfile.close();
            reject(new Error("[VANILLA_ASSETS] No read stream"));
            return;
          }
          const chunks: Buffer[] = [];
          readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
          readStream.on("end", () => {
            zipfile.close();
            resolve(Buffer.concat(chunks));
          });
          readStream.on("error", (e: Error) => {
            zipfile.close();
            reject(e);
          });
        });
      });
      zipfile.on("end", () => {
        reject(new Error(`[VANILLA_ASSETS] Entry not found in jar: ${entryPath}. Jar: ${zipPath}`));
      });
    });
  });
}

/**
 * Load vanilla texture buffer, trying candidate paths in order. First match wins.
 * Does NOT fail if one candidate is missing; only fails if none exist.
 * Logs the resolved path used (one line).
 * @param source - "client_jar" | "bundled_pack"
 * @param candidatePaths - paths relative to assets/minecraft/textures, no .png (e.g. ["entity/signs/hanging/oak", "entity/hanging_sign/oak"])
 * @param options - mcVersion for client_jar; bundledPackRoot for bundled_pack
 * @param logContext - optional context for log line (e.g. target output path)
 */
export async function getVanillaTextureBufferWithFallbacks(
  source: VanillaAssetsSource,
  candidatePaths: string[],
  options: { mcVersion?: string; bundledPackRoot?: string },
  logContext?: string
): Promise<Buffer> {
  const errors: string[] = [];
  for (const vanillaPath of candidatePaths) {
    try {
      const buffer = await getVanillaTextureBuffer(source, vanillaPath, options);
      const entryPath = jarEntryPath(vanillaPath);
      console.log(`[VANILLA_ASSETS] Resolved: ${entryPath}${logContext ? ` (for ${logContext})` : ""}`);
      return buffer;
    } catch (e) {
      errors.push(`${vanillaPath}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(
    `[VANILLA_ASSETS] No candidate texture found. Tried: ${candidatePaths.join(", ")}. ${errors.join("; ")}`
  );
}

/**
 * Load vanilla texture buffer from the configured source.
 * @param source - "client_jar" | "bundled_pack"
 * @param vanillaPath - path relative to assets/minecraft/textures, no .png (e.g. "item/iron_ingot")
 * @param options - mcVersion for client_jar; bundledPackRoot for bundled_pack
 * @returns Buffer of the PNG file
 */
export async function getVanillaTextureBuffer(
  source: VanillaAssetsSource,
  vanillaPath: string,
  options: { mcVersion?: string; bundledPackRoot?: string }
): Promise<Buffer> {
  const entryPath = jarEntryPath(vanillaPath);

  if (source === "client_jar") {
    const mcVersion = options.mcVersion ?? env.MC_VERSION ?? DEFAULT_MC_VERSION;
    const jarPath = resolveClientJarPath(mcVersion);
    if (!existsSync(jarPath)) {
      throw new Error(
        `[VANILLA_ASSETS] Minecraft client jar not found. Set MC_VERSION (e.g. 1.21.1) and ensure the client is installed. Expected: ${jarPath}`
      );
    }
    return readEntryFromZip(jarPath, entryPath);
  }

  if (source === "bundled_pack") {
    const root = getResolvedBundledPackPath(options.bundledPackRoot);
    if (!root) {
      throw new Error(
        `[VANILLA_ASSETS] VANILLA_ASSETS_SOURCE=bundled_pack requires VANILLA_ASSETS_PACK (path to zip or unpacked assets) or options.bundledPackRoot.`
      );
    }
    if (!existsSync(root)) {
      throw new Error(
        `[VANILLA_ASSETS] Bundled pack path does not exist: ${root}. Set VANILLA_ASSETS_PACK to a valid path, or ensure the zip is at dist/assets/vanilla-assets-1.21.1.zip (deploy) or ../assets (local).`
      );
    }
    const stat = statSync(root);
    if (stat.isFile() && root.toLowerCase().endsWith(".zip")) {
      return readEntryFromZip(root, entryPath);
    }
    const fullPath = join(root, "assets", "minecraft", "textures", vanillaPath + (vanillaPath.endsWith(".png") ? "" : ".png"));
    if (!existsSync(fullPath)) {
      throw new Error(`[VANILLA_ASSETS] Bundled asset not found: ${fullPath}`);
    }
    return readFileSync(fullPath);
  }

  throw new Error(`[VANILLA_ASSETS] Unknown VANILLA_ASSETS_SOURCE: ${source}. Use "client_jar" or "bundled_pack".`);
}

/**
 * Read any vanilla asset by full entry path (e.g. "assets/minecraft/blockstates/oak_button.json").
 * Used by vanilla-dep-collector for blockstates and models.
 */
export async function getVanillaAssetBuffer(
  source: VanillaAssetsSource,
  entryPath: string,
  options: { mcVersion?: string; bundledPackRoot?: string }
): Promise<Buffer> {
  const normalizedEntry = entryPath.replace(/\\/g, "/");

  if (source === "client_jar") {
    const mcVersion = options.mcVersion ?? env.MC_VERSION ?? DEFAULT_MC_VERSION;
    const jarPath = resolveClientJarPath(mcVersion);
    if (!existsSync(jarPath)) {
      throw new Error(
        `[VANILLA_ASSETS] Minecraft client jar not found. Expected: ${jarPath}`
      );
    }
    return readEntryFromZip(jarPath, normalizedEntry);
  }

  if (source === "bundled_pack") {
    const root = getResolvedBundledPackPath(options.bundledPackRoot);
    if (!root || !existsSync(root)) {
      throw new Error(
        `[VANILLA_ASSETS] VANILLA_ASSETS_SOURCE=bundled_pack requires a valid pack path.`
      );
    }
    const stat = statSync(root);
    if (stat.isFile() && root.toLowerCase().endsWith(".zip")) {
      return readEntryFromZip(root, normalizedEntry);
    }
    const fullPath = join(root, normalizedEntry);
    if (!existsSync(fullPath)) {
      throw new Error(`[VANILLA_ASSETS] Bundled asset not found: ${fullPath}`);
    }
    return readFileSync(fullPath);
  }

  throw new Error(`[VANILLA_ASSETS] Unknown VANILLA_ASSETS_SOURCE: ${source}.`);
}
