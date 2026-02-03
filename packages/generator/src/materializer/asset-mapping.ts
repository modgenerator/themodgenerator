/**
 * Plane 3: AssetKey → file mapping. Deterministic, stable ordering.
 * Items: textures/item/<contentId>.png, models/item/<id>.json, lang (merged).
 * Blocks: textures/block/<contentId>.png, models/block/<id>.json, blockstates/<id>.json, lang (merged).
 * Canonical Interpretation: item/generated, block/cube_all; placeholder by material semantics.
 * Missing keys = bug (throw). No randomness.
 */

import type { AssetKey } from "../composer-stub.js";
import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";
import {
  CANONICAL_MODEL_ITEM,
  CANONICAL_MODEL_BLOCK,
  getCanonicalMaterial,
  resolveArchetype,
  hasUserProvidedAsset,
  ARCHETYPES,
} from "../canonical-interpretation.js";

const ITEM_PREFIX = "item/";
const BLOCK_PREFIX = "block/";

function parseKey(key: string): { category: "item" | "block"; id: string } {
  if (key.startsWith(ITEM_PREFIX)) {
    return { category: "item", id: key.slice(ITEM_PREFIX.length) };
  }
  if (key.startsWith(BLOCK_PREFIX)) {
    return { category: "block", id: key.slice(BLOCK_PREFIX.length) };
  }
  throw new Error(`Invalid AssetKey key (expected item/<id> or block/<id>): ${key}`);
}

/** Collect unique item and block ids from assets in stable order. */
function collectIds(assets: AssetKey[]): { itemIds: string[]; blockIds: string[] } {
  const itemIds = new Set<string>();
  const blockIds = new Set<string>();
  for (const a of assets) {
    const { category, id } = parseKey(a.key);
    if (category === "item") itemIds.add(id);
    else blockIds.add(id);
  }
  return {
    itemIds: Array.from(itemIds).sort(),
    blockIds: Array.from(blockIds).sort(),
  };
}

function itemModelJson(modId: string, id: string): string {
  return `{
  "parent": "${CANONICAL_MODEL_ITEM}",
  "textures": {
    "layer0": "${modId}:item/${id}"
  }
}
`;
}

function blockModelJson(modId: string, id: string): string {
  return `{
  "parent": "${CANONICAL_MODEL_BLOCK}",
  "textures": {
    "all": "${modId}:block/${id}"
  }
}
`;
}

function blockstateJson(id: string): string {
  return `{
  "variants": {
    "": {
      "model": "${id}"
    }
  }
}
`;
}

function escapeJson(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** Build merged en_us.json from expanded items and blocks. */
function langEn(
  modId: string,
  modName: string,
  expanded: ExpandedSpecTier1
): string {
  const entries: Record<string, string> = {
    [`mod.${modId}.name`]: modName,
  };
  for (const item of expanded.items) {
    entries[`item.${modId}.${item.id}`] = item.name;
  }
  for (const block of expanded.blocks) {
    entries[`block.${modId}.${block.id}`] = block.name;
  }
  const lines = Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  "${escapeJson(k)}": "${escapeJson(v)}"`);
  return `{\n${lines.join(",\n")}\n}\n`;
}

/**
 * Map AssetKeys + expanded spec to MaterializedFile list.
 * Deterministic: same inputs → same outputs. Throws on invalid/missing keys.
 */
/** Resolve material for an item or block id from expanded spec. Deterministic. */
function materialForId(
  expanded: ExpandedSpecTier1,
  id: string,
  category: "item" | "block"
): string {
  if (category === "item") {
    const item = expanded.items.find((i) => i.id === id);
    return item?.material ?? "generic";
  }
  const block = expanded.blocks.find((b) => b.id === id);
  return block?.material ?? "generic";
}

/** Resolve display name for an item or block id from expanded spec. */
function nameForId(
  expanded: ExpandedSpecTier1,
  id: string,
  category: "item" | "block"
): string {
  if (category === "item") {
    const item = expanded.items.find((i) => i.id === id);
    return item?.name ?? id;
  }
  const block = expanded.blocks.find((b) => b.id === id);
  return block?.name ?? id;
}

/**
 * Build semantic metadata for a texture file (Phase C).
 * Only attaches archetype/hints/guarantees when user has NOT provided explicit asset (Phase D).
 */
function semanticMetadataForTexture(
  expanded: ExpandedSpecTier1,
  id: string,
  category: "item" | "block"
): Pick<MaterializedFile, "archetype" | "emissiveHint" | "translucencyHint" | "glowHint" | "archetypeGuarantees"> {
  if (hasUserProvidedAsset(expanded, id, category)) {
    return {};
  }
  const archetype = resolveArchetype({
    contentId: id,
    name: nameForId(expanded, id, category),
    category,
    material: materialForId(expanded, id, category),
  });
  const def = ARCHETYPES[archetype];
  return {
    archetype,
    emissiveHint: def.emissiveHint,
    translucencyHint: def.translucencyHint,
    glowHint: def.glowHint,
    archetypeGuarantees: def.guarantees,
  };
}

export function assetKeysToFiles(
  expanded: ExpandedSpecTier1,
  assets: AssetKey[]
): MaterializedFile[] {
  const modId = expanded.spec.modId;
  const modName = expanded.spec.modName;
  const baseAssets = `src/main/resources/assets/${modId}`;
  const files: MaterializedFile[] = [];
  const { itemIds, blockIds } = collectIds(assets);

  for (const id of itemIds) {
    const material = getCanonicalMaterial(materialForId(expanded, id, "item"));
    const meta = semanticMetadataForTexture(expanded, id, "item");
    const colorHint = expanded.spec.items?.find((i) => i.id === id)?.colorHint;
    files.push({
      path: `${baseAssets}/textures/item/${id}.png`,
      contents: "",
      placeholderMaterial: material,
      ...(colorHint && { colorHint }),
      ...meta,
    });
    files.push({
      path: `${baseAssets}/models/item/${id}.json`,
      contents: itemModelJson(modId, id),
    });
  }
  for (const id of blockIds) {
    const material = getCanonicalMaterial(materialForId(expanded, id, "block"));
    const meta = semanticMetadataForTexture(expanded, id, "block");
    const colorHint = expanded.spec.blocks?.find((b) => b.id === id)?.colorHint;
    files.push({
      path: `${baseAssets}/textures/block/${id}.png`,
      contents: "",
      placeholderMaterial: material,
      ...(colorHint && { colorHint }),
      ...meta,
    });
    files.push({
      path: `${baseAssets}/models/block/${id}.json`,
      contents: blockModelJson(modId, id),
    });
    files.push({
      path: `${baseAssets}/blockstates/${id}.json`,
      contents: blockstateJson(`${modId}:block/${id}`),
    });
  }

  files.push({
    path: `${baseAssets}/lang/en_us.json`,
    contents: langEn(modId, modName, expanded),
  });

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
