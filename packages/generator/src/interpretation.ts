/**
 * ChatGPT-like interpretation: any prompt → rich, believable item or block.
 * No prompt is "unknown". Semantic decomposition + fallback synthesis.
 * Never return null; never throw.
 */

import type {
  SemanticTag,
  PhysicalTraits,
  GameplayTraits,
  AestheticProfile,
  ItemPrimitive,
  BlockPrimitive,
} from "./item-block-primitives.js";
import {
  defaultItemPrimitive,
  defaultBlockPrimitive,
  defaultPhysicalTraits,
  type ItemCategory,
  type BlockMaterial,
} from "./item-block-primitives.js";

export type InterpretedKind = "item" | "block";

export interface InterpretedResult {
  kind: InterpretedKind;
  id: string;
  displayName: string;
  semanticTags: SemanticTag[];
  physical: PhysicalTraits;
  gameplay: GameplayTraits;
  aesthetic: AestheticProfile;
  item?: ItemPrimitive;
  block?: BlockPrimitive;
}

function slugify(prompt: string): string {
  return prompt
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "item";
}

function toDisplayName(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "Mystery Item";
  return trimmed
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

/** Semantic decomposition: map prompt keywords to semantic tags + aesthetic. */
function decompose(prompt: string): { tags: SemanticTag[]; aesthetic: AestheticProfile; kind: InterpretedKind } {
  const text = prompt.toLowerCase().trim();
  const tags: SemanticTag[] = [];
  let materialHint: AestheticProfile["materialHint"] = "organic";
  const colorPalette: string[] = [];
  let glow = false;
  let animationHint: AestheticProfile["animationHint"];
  let kind: InterpretedKind = "item";

  // Block-like: brick, block, dirt, stone, ore, wall, slab, stairs
  if (
    /\b(brick|block|dirt|stone|ore|wall|slab|stairs|pillar|plank|log|sand|gravel|concrete)\b/.test(text) ||
    /\b(grass|leaves|mushroom|flower)\s*(block)?\b/.test(text)
  ) {
    kind = "block";
    tags.push("block", "placeable");
  }

  // Food / edible
  if (
    /\b(ice\s*cream|cream|cheese|food|eat|edible|consumable|fruit|vegetable|meat|sweet|candy|chocolate)\b/.test(text) ||
    /\b(apple|bread|pie|cake|cookie|mushroom)\b/.test(text)
  ) {
    tags.push("food", "edible", "consumable");
  }

  // Cold
  if (/\b(ice|ice cream|cold|frost|snow|freeze|frozen)\b/.test(text)) {
    tags.push("cold");
    materialHint = "ice";
    colorPalette.push("#B0E0E6", "#87CEEB", "#ADD8E6", "#E0FFFF");
  }

  // Hot / fire
  if (/\b(fire|flame|hot|lava|burn|blaze)\b/.test(text)) {
    tags.push("hot");
    materialHint = "energy";
    colorPalette.push("#FF4500", "#FF6347", "#FFA500", "#FFFF00");
    glow = true;
  }

  // Radioactive / dangerous / poison
  if (/\b(radioactive|poison|toxic|curse|cursed|dangerous|deadly)\b/.test(text)) {
    tags.push("dangerous");
    glow = true;
    colorPalette.push("#32CD32", "#ADFF2F", "#7CFC00", "#00FF00");
    if (!materialHint || materialHint === "organic") materialHint = "energy";
  }

  // Magical / glow / dream
  if (/\b(magic|magical|glow|glowing|dream|enchanted|arcane|mystic)\b/.test(text)) {
    tags.push("magical");
    glow = true;
    animationHint = "pulse";
    colorPalette.push("#9370DB", "#8A2BE2", "#DA70D6", "#EE82EE");
    materialHint = "crystal";
  }

  // Cute / soft
  if (/\b(cute|soft|fluffy|plush|sweet)\b/.test(text)) {
    tags.push("cute");
    if (!colorPalette.length) colorPalette.push("#FFB6C1", "#FFC0CB", "#FFE4E1");
  }

  // Metallic / weapon / tool
  if (/\b(metal|metallic|sword|weapon|tool|armor|ingot|nugget)\b/.test(text)) {
    tags.push("metallic");
    if (/\b(sword|weapon|blade)\b/.test(text)) tags.push("weapon");
    if (/\b(tool|pick|axe|shovel)\b/.test(text)) tags.push("tool");
    if (!materialHint || materialHint === "organic") materialHint = "metal";
    if (!colorPalette.length) colorPalette.push("#C0C0C0", "#A8A8A8", "#808080");
  }

  // Organic / wood / stone
  if (/\b(wood|wooden|organic|plant|leaf|vine)\b/.test(text)) {
    tags.push("organic");
    if (!materialHint || materialHint === "ice") materialHint = "wood";
    if (!colorPalette.length) colorPalette.push("#8B7355", "#6B5344", "#4A3728");
  }
  if (/\b(stone|rock|gem|ruby|sapphire|diamond)\b/.test(text)) {
    if (/\b(stone|rock|brick)\b/.test(text)) tags.push("stone");
    if (!tags.includes("metallic")) tags.push("organic");
    if (/\b(gem|ruby|sapphire|diamond|emerald)\b/.test(text)) {
      materialHint = "gem";
      glow = true;
      colorPalette.push("#DC143C", "#4169E1", "#2E8B57", "#50C878");
    } else if (!materialHint || materialHint === "organic") materialHint = "stone";
  }

  // Wet / dry
  if (/\b(water|wet|ocean|slime)\b/.test(text)) {
    tags.push("wet");
    if (/\b(slime)\b/.test(text)) materialHint = "slime";
  }
  if (/\b(dry|sand|desert)\b/.test(text)) tags.push("dry");

  // Fallback palette and material
  if (colorPalette.length === 0) {
    colorPalette.push("#8B7355", "#6B5344", "#4A3728", "#3D2E24");
  }
  if (materialHint === "organic" && kind === "block") materialHint = "stone";

  return {
    tags: tags.length > 0 ? tags : (["organic", "placeable"] as SemanticTag[]),
    aesthetic: { materialHint, colorPalette, glow, animationHint },
    kind,
  };
}

/** Synthesize gameplay traits from semantic tags. */
function synthesizeGameplay(tags: SemanticTag[], kind: InterpretedKind): GameplayTraits {
  const out: GameplayTraits = {};
  if (tags.includes("food") || tags.includes("edible") || tags.includes("consumable")) {
    out.food = { hunger: 4, saturation: 0.3, effects: [] };
  }
  if (tags.includes("weapon")) {
    out.weapon = { damage: 6, speed: 1.6, effects: [] };
  }
  if (kind === "block" || tags.includes("block") || tags.includes("placeable")) {
    out.block = { solid: true, gravity: false, interactive: false };
  }
  return out;
}

/** Build ItemPrimitive from interpreted result. */
function buildItemPrimitive(
  id: string,
  displayName: string,
  tags: SemanticTag[],
  _physical: PhysicalTraits,
  gameplay: GameplayTraits,
  aesthetic: AestheticProfile
): ItemPrimitive {
  const item = defaultItemPrimitive(id, displayName);
  const category: ItemCategory = tags.includes("weapon")
    ? "weapon"
    : tags.includes("tool")
      ? "tool"
      : tags.includes("food") || tags.includes("edible")
        ? "food"
        : tags.includes("magical")
          ? "magic"
          : "misc";
  item.category = category;
  item.visual.textureHints = [aesthetic.materialHint, ...aesthetic.colorPalette.slice(0, 2)];
  item.visual.glow = aesthetic.glow;
  item.visual.animated = !!aesthetic.animationHint;
  if (gameplay.food) {
    item.behavior.onConsume = [{ type: "heal", value: gameplay.food.hunger * 2 }];
    item.stackSize = 16;
  }
  return item;
}

/** Build BlockPrimitive from interpreted result. */
function buildBlockPrimitive(
  id: string,
  displayName: string,
  tags: SemanticTag[],
  physical: PhysicalTraits,
  gameplay: GameplayTraits,
  aesthetic: AestheticProfile
): BlockPrimitive {
  const block = defaultBlockPrimitive(id, displayName);
  const material: BlockMaterial = tags.includes("metallic")
    ? "metal"
    : tags.includes("magical") || aesthetic.glow
      ? "magic"
      : tags.includes("organic") && !tags.includes("stone")
        ? "organic"
        : "stone";
  block.material = material;
  block.hardness = physical.hardness;
  block.visual.textureHints = [aesthetic.materialHint, ...aesthetic.colorPalette.slice(0, 2)];
  block.visual.emissive = aesthetic.glow;
  if (gameplay.block) {
    block.behavior = {};
  }
  return block;
}

/**
 * Interpret any prompt as an item or block. Never returns null; never throws.
 * Low semantic confidence → synthesize reasonable fantasy interpretation.
 */
export function interpretItemOrBlock(prompt: string): InterpretedResult {
  const safePrompt = typeof prompt === "string" && prompt.trim() ? prompt.trim() : "mystery item";
  const id = slugify(safePrompt) || "mystery_item";
  const displayName = toDisplayName(safePrompt);

  const { tags, aesthetic, kind } = decompose(safePrompt);
  const physical = defaultPhysicalTraits();
  const gameplay = synthesizeGameplay(tags, kind);

  if (kind === "block") {
    const block = buildBlockPrimitive(id, displayName, tags, physical, gameplay, aesthetic);
    return {
      kind: "block",
      id,
      displayName,
      semanticTags: tags,
      physical,
      gameplay,
      aesthetic,
      block,
    };
  }

  const item = buildItemPrimitive(id, displayName, tags, physical, gameplay, aesthetic);
  return {
    kind: "item",
    id,
    displayName,
    semanticTags: tags,
    physical,
    gameplay,
    aesthetic,
    item,
  };
}
