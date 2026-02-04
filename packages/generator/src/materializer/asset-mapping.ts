/**
 * Plane 3: AssetKey → file mapping. Deterministic, stable ordering.
 * Items: textures/item/<contentId>.png, models/item/<id>.json, lang (merged).
 * Blocks: textures/block/<contentId>.png, models/block/<id>.json, blockstates/<id>.json, lang (merged).
 * Canonical Interpretation: item/generated, block/cube_all; placeholder by material semantics.
 * Missing keys = bug (throw). No randomness.
 */

import type { AssetKey } from "../composer-stub.js";
import type { ExpandedSpecTier1, TextureProfile } from "@themodgenerator/spec";
import type { MaterializedFile } from "./types.js";
import {
  CANONICAL_MODEL_ITEM,
  CANONICAL_MODEL_BLOCK,
  getCanonicalMaterial,
  resolveArchetype,
  hasUserProvidedAsset,
  ARCHETYPES,
} from "../canonical-interpretation.js";
import { resolveVanillaVisualDefaults } from "../materialization/vanilla-visual-defaults.js";

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

function itemModelJson(modId: string, id: string, parent?: string): string {
  const modelParent = parent ?? CANONICAL_MODEL_ITEM;
  return `{
  "parent": "${modelParent}",
  "textures": {
    "layer0": "${modId}:item/${id}"
  }
}
`;
}

/** Item model with 3D elements (rod: thin bar; chunky: small cube; plate: flat box). MC 1.21.1. */
function itemModelJsonWithElements(modId: string, id: string, shape: "rod" | "chunky" | "plate"): string {
  const tex = `"${modId}:item/${id}"`;
  let from: [number, number, number];
  let to: [number, number, number];
  if (shape === "rod") {
    from = [7, 0, 7];
    to = [9, 16, 9];
  } else if (shape === "chunky") {
    from = [4, 4, 4];
    to = [12, 12, 12];
  } else {
    from = [2, 0, 2];
    to = [14, 2, 14];
  }
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  const faces = [
    `"down": { "uv": [0, 0, 16, 16], "texture": "#layer0" }`,
    `"up": { "uv": [0, 0, 16, 16], "texture": "#layer0" }`,
    `"north": { "uv": [0, 0, 16, 16], "texture": "#layer0" }`,
    `"south": { "uv": [0, 0, 16, 16], "texture": "#layer0" }`,
    `"west": { "uv": [0, 0, 16, 16], "texture": "#layer0" }`,
    `"east": { "uv": [0, 0, 16, 16], "texture": "#layer0" }`,
  ].join(", ");
  const element = `{ "from": [${x0}, ${y0}, ${z0}], "to": [${x1}, ${y1}, ${z1}], "faces": { ${faces} } }`;
  return `{
  "textures": {
    "layer0": ${tex}
  },
  "elements": [${element}],
  "display": {
    "thirdperson_righthand": { "rotation": [75, 45, 0], "translation": [0, 2.5, 0], "scale": [0.375, 0.375, 0.375] },
    "firstperson_righthand": { "rotation": [0, 45, 0], "scale": [0.4, 0.4, 0.4] },
    "ground": { "translation": [0, 3, 0], "scale": [0.25, 0.25, 0.25] },
    "gui": { "rotation": [30, 225, 0], "translation": [0, 0, 0], "scale": [0.625, 0.625, 0.625] },
    "fixed": { "scale": [0.5, 0.5, 0.5] }
  }
}
`;
}

/** Block-as-item model: reference block model so held/inventory uses block appearance. No separate item texture. */
function blockAsItemModelJson(modId: string, blockId: string): string {
  return `{
  "parent": "${modId}:block/${blockId}"
}
`;
}

function blockModelJson(modId: string, id: string, parent?: string): string {
  const modelParent = parent ?? CANONICAL_MODEL_BLOCK;
  return `{
  "parent": "${modelParent}",
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

/** Build texture generation prompt from textureProfile (for logging and manifest). */
export function buildTexturePrompt(profile: TextureProfile): string {
  const parts = [
    "Pixel-art Minecraft texture, 16x16",
    `material: ${profile.materialHint}`,
    `physical traits: ${profile.physicalTraits.join(", ")}`,
    `surface style: ${profile.surfaceStyle.join(", ")}`,
  ];
  if (profile.visualMotifs?.length) {
    parts.push(`motifs: ${profile.visualMotifs.join(", ")}`);
  }
  parts.push("lighting: Minecraft vanilla style", "no photorealism", "tileable");
  return parts.join(", ");
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
    const itemSpec = expanded.spec.items?.find((i) => i.id === id);
    const itemFromExpanded = expanded.items.find((i) => i.id === id);
    const itemRender = itemFromExpanded?.itemRender ?? itemSpec?.itemRender ?? "chunky";
    const colorHint = itemSpec?.colorHint;
    const textureIntent = itemSpec?.textureIntent ?? "item";
    const textureProfile = itemSpec?.textureProfile;
    const texturePrompt = textureProfile ? buildTexturePrompt(textureProfile) : undefined;
    const hasUserTexture = Boolean(itemSpec?.texturePath);
    const vanillaDefault =
      !hasUserTexture && itemFromExpanded
        ? resolveVanillaVisualDefaults({ id: itemFromExpanded.id, name: itemFromExpanded.name }, { modId })
        : null;
    files.push({
      path: `${baseAssets}/textures/item/${id}.png`,
      contents: "",
      placeholderMaterial: material,
      ...(colorHint && { colorHint }),
      textureIntent,
      ...(textureProfile && { textureProfile }),
      ...(texturePrompt && { texturePrompt }),
      ...(vanillaDefault && { copyFromVanillaPaths: vanillaDefault.copyFromVanillaPaths }),
      ...meta,
    });
    const isBlockId = expanded.blocks.some((b) => b.id === id);
    let modelContents: string;
    if (itemRender === "blocklike" && isBlockId) {
      modelContents = blockAsItemModelJson(modId, id);
    } else if (itemRender === "rod" || itemRender === "chunky" || itemRender === "plate") {
      modelContents = itemModelJsonWithElements(modId, id, itemRender);
    } else if (vanillaDefault && !isBlockId) {
      modelContents = itemModelJson(modId, id, vanillaDefault.modelParent);
    } else {
      modelContents = itemModelJson(modId, id);
    }
    files.push({
      path: `${baseAssets}/models/item/${id}.json`,
      contents: modelContents,
    });
  }
  for (const id of blockIds) {
    const material = getCanonicalMaterial(materialForId(expanded, id, "block"));
    const meta = semanticMetadataForTexture(expanded, id, "block");
    const blockSpec = expanded.spec.blocks?.find((b) => b.id === id);
    const blockFromExpanded = expanded.blocks.find((b) => b.id === id);
    const colorHint = blockSpec?.colorHint;
    const textureIntent = blockSpec?.textureIntent ?? "block";
    const textureProfile = blockSpec?.textureProfile;
    const texturePrompt = textureProfile ? buildTexturePrompt(textureProfile) : undefined;
    const hasUserTexture = Boolean(blockSpec?.texturePath);
    const vanillaDefault = !hasUserTexture && blockFromExpanded
      ? resolveVanillaVisualDefaults({ id: blockFromExpanded.id, name: blockFromExpanded.name, type: "block" }, { modId })
      : null;
    files.push({
      path: `${baseAssets}/textures/block/${id}.png`,
      contents: "",
      placeholderMaterial: material,
      ...(colorHint && { colorHint }),
      textureIntent,
      ...(textureProfile && { textureProfile }),
      ...(texturePrompt && { texturePrompt }),
      ...(vanillaDefault && { copyFromVanillaPaths: vanillaDefault.copyFromVanillaPaths }),
      ...meta,
    });
    files.push({
      path: `${baseAssets}/models/block/${id}.json`,
      contents: blockModelJson(modId, id, vanillaDefault?.modelParent),
    });
    files.push({
      path: `${baseAssets}/blockstates/${id}.json`,
      contents: blockstateJson(`${modId}:block/${id}`),
    });
    // Block-as-item: item model references block model (no separate item texture; block texture is used).
    if (!itemIds.includes(id)) {
      files.push({
        path: `${baseAssets}/models/item/${id}.json`,
        contents: blockAsItemModelJson(modId, id),
      });
    }
  }

  files.push({
    path: `${baseAssets}/lang/en_us.json`,
    contents: langEn(modId, modName, expanded),
  });

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
