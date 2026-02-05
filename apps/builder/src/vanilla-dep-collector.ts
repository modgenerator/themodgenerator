/**
 * Collect vanilla asset dependencies for a block by reading blockstate + models.
 * Returns only textures actually referenced by models (no guessed paths like oak_button.png).
 */

import type { VanillaAssetsSource } from "./vanilla-asset-source.js";
import { getVanillaAssetBuffer } from "./vanilla-asset-source.js";

export interface VanillaDepsResult {
  /** Paths relative to assets/minecraft/textures (no .png), for copying. */
  texturePaths: string[];
  /** Full entry paths for blockstate and model JSONs (for reference). */
  blockstatePath: string;
  modelPaths: string[];
}

/**
 * Extract model references from a blockstate JSON (variants + multipart).
 * Returns normalized model paths (e.g. "block/oak_button" from "minecraft:block/oak_button").
 */
function extractModelRefsFromBlockstate(blockstate: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  const add = (model: string) => {
    if (typeof model !== "string") return;
    const normalized = model.replace(/^minecraft:/, "").replace(/^block\//, "block/");
    refs.add(normalized.startsWith("block/") ? normalized : `block/${normalized}`);
  };

  const variants = blockstate.variants as Record<string, unknown> | undefined;
  if (variants && typeof variants === "object") {
    for (const v of Object.values(variants)) {
      if (typeof v === "object" && v !== null && "model" in v && typeof (v as { model: string }).model === "string") {
        add((v as { model: string }).model);
      } else if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "object" && item !== null && "model" in item && typeof (item as { model: string }).model === "string") {
            add((item as { model: string }).model);
          }
        }
      }
    }
  }
  const multipart = blockstate.multipart as Array<{ apply?: unknown }> | undefined;
  if (Array.isArray(multipart)) {
    for (const part of multipart) {
      const apply = part.apply;
      if (typeof apply === "object" && apply !== null && "model" in apply && typeof (apply as { model: string }).model === "string") {
        add((apply as { model: string }).model);
      } else if (Array.isArray(apply)) {
        for (const a of apply) {
          if (typeof a === "object" && a !== null && "model" in a && typeof (a as { model: string }).model === "string") {
            add((a as { model: string }).model);
          }
        }
      }
    }
  }
  return [...refs];
}

/**
 * Normalize model path to full assets path (e.g. "block/oak_button" -> "assets/minecraft/models/block/oak_button.json").
 */
function modelPathToEntry(modelPath: string): string {
  const p = modelPath.replace(/^minecraft:/, "").replace(/\.json$/, "");
  return `assets/minecraft/models/${p}.json`;
}

/**
 * Resolve texture value to path relative to assets/minecraft/textures (no .png).
 * "minecraft:block/oak_planks" -> "block/oak_planks"
 */
function textureRefToPath(ref: string): string {
  const s = String(ref).trim();
  const withoutNs = s.replace(/^minecraft:/, "");
  return withoutNs.endsWith(".png") ? withoutNs.slice(0, -4) : withoutNs;
}

/**
 * Resolve #key refs in a textures map. Mutates resolved in place; returns set of final texture paths.
 */
function resolveTexturesMap(
  textures: Record<string, string>,
  resolved: Map<string, string>
): Set<string> {
  const out = new Set<string>();
  const resolve = (val: string): string => {
    if (!val.startsWith("#")) return val;
    const key = val.slice(1);
    if (resolved.has(key)) return resolved.get(key)!;
    const raw = textures[key];
    if (raw) return resolve(raw);
    return val;
  };
  for (const [k, v] of Object.entries(textures)) {
    const r = resolve(v);
    resolved.set(k, r);
    if (!r.startsWith("#")) out.add(textureRefToPath(r));
  }
  return out;
}

/**
 * Collect all texture paths referenced by a model JSON and its parents.
 */
function collectTexturesFromModel(
  modelJson: Record<string, unknown>,
  visited: Set<string>,
  allTextures: Set<string>,
  getModel: (entryPath: string) => Promise<Buffer>
): Promise<void> {
  const textures = modelJson.textures as Record<string, string> | undefined;
  if (textures && typeof textures === "object") {
    const resolved = new Map<string, string>();
    const fromThis = resolveTexturesMap(textures, resolved);
    fromThis.forEach((p) => allTextures.add(p));
  }
  const parent = modelJson.parent as string | undefined;
  if (typeof parent === "string" && parent.startsWith("minecraft:")) {
    const parentPath = parent.replace("minecraft:", "") + ".json";
    const entryPath = `assets/minecraft/models/${parentPath}`;
    if (visited.has(entryPath)) return Promise.resolve();
    visited.add(entryPath);
    return getModel(entryPath)
      .then((buf) => {
        const parsed = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
        return collectTexturesFromModel(parsed, visited, allTextures, getModel);
      })
      .catch(() => undefined);
  }
  return Promise.resolve();
}

/**
 * Collect vanilla asset dependencies for a block: blockstate + models + textures actually referenced.
 * Never invents texture filenames; only returns textures present in model JSONs.
 */
export async function collectVanillaDepsForBlock(
  blockId: string,
  source: VanillaAssetsSource,
  options: { mcVersion?: string; bundledPackRoot?: string }
): Promise<VanillaDepsResult> {
  const blockstatePath = `assets/minecraft/blockstates/${blockId}.json`;
  const texturePaths = new Set<string>();
  const modelPaths: string[] = [];
  const visitedModels = new Set<string>();

  const getAsset = (entryPath: string) =>
    getVanillaAssetBuffer(source, entryPath, options);

  let blockstate: Record<string, unknown>;
  try {
    const buf = await getAsset(blockstatePath);
    blockstate = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
  } catch {
    return { texturePaths: [], blockstatePath, modelPaths };
  }

  const modelRefs = extractModelRefsFromBlockstate(blockstate);
  for (const modelPath of modelRefs) {
    const entryPath = modelPathToEntry(modelPath);
    if (visitedModels.has(entryPath)) continue;
    visitedModels.add(entryPath);
    modelPaths.push(entryPath);
    try {
      const modelBuf = await getAsset(entryPath);
      const modelJson = JSON.parse(modelBuf.toString("utf8")) as Record<string, unknown>;
      await collectTexturesFromModel(
        modelJson,
        new Set([entryPath]),
        texturePaths,
        (p) => getAsset(p)
      );
    } catch {
      // Skip broken model refs
    }
  }

  return {
    texturePaths: [...texturePaths],
    blockstatePath,
    modelPaths,
  };
}
