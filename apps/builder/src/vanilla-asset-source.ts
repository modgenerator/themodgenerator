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

/**
 * Default path for VANILLA_ASSETS_PACK when not set: builder package's assets dir + zip.
 * Resolved relative to this file so it works from any cwd (dev, dist, Docker).
 * See docs/VANILLA-DEFAULTS.md.
 */
export function getDefaultVanillaAssetsPackPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return join(thisDir, "..", "assets", VANILLA_ASSETS_ZIP_FILENAME);
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
    const root = options.bundledPackRoot ?? env.VANILLA_ASSETS_PACK ?? getDefaultVanillaAssetsPackPath();
    if (!root) {
      throw new Error(
        `[VANILLA_ASSETS] VANILLA_ASSETS_SOURCE=bundled_pack requires VANILLA_ASSETS_PACK (path to zip or unpacked assets) or options.bundledPackRoot.`
      );
    }
    if (!existsSync(root)) {
      throw new Error(
        `[VANILLA_ASSETS] Bundled pack path does not exist: ${root}. Run 'npm run ensure-vanilla-assets' in apps/builder to create the default zip, or set VANILLA_ASSETS_PACK to an existing path.`
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
