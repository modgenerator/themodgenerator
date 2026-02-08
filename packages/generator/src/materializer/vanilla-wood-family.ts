/**
 * Single source of truth for vanilla wood family generation.
 * CRITICAL: Correct block classes + Settings.copy(vanilla) so:
 * - Mining speed scales with tool tier
 * - Correct tool (axe) is applied
 * - Hardness/resistance match vanilla
 * - Loot tables apply (NO dropsNothing, NO getDroppedStacks override)
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";

/** Wood block suffixes (must match expand-wood-type). */
export const WOOD_BLOCK_SUFFIXES = [
  "_log",
  "_stripped_log",
  "_wood",
  "_stripped_wood",
  "_planks",
  "_stairs",
  "_slab",
  "_fence",
  "_fence_gate",
  "_door",
  "_trapdoor",
  "_pressure_plate",
  "_button",
  "_sign",
  "_hanging_sign",
] as const;

/** Log/wood only (PillarBlock for StrippableBlockRegistry). */
export const LOG_OR_WOOD_SUFFIXES = ["_log", "_stripped_log", "_wood", "_stripped_wood"] as const;

export type WoodBlockSuffix = (typeof WOOD_BLOCK_SUFFIXES)[number];

/** Block class type for Java generation. */
export type WoodBlockClass =
  | "Block"
  | "PillarBlock"
  | "StairsBlock"
  | "SlabBlock"
  | "FenceBlock"
  | "FenceGateBlock"
  | "DoorBlock"
  | "TrapdoorBlock"
  | "ButtonBlock"
  | "PressurePlateBlock"
  | "SignBlock"
  | "HangingSignBlock";

export interface WoodBlockSpec {
  suffix: WoodBlockSuffix;
  blockClass: WoodBlockClass;
  /** Java expression for block registration. Use PLACEHOLDER_SETTINGS for settings, PLACEHOLDER_PLANKS for planks var. */
  javaCtor: string;
  /** Vanilla block for Settings.copy() - REQUIRED for mining speed/tool/hardness. */
  vanillaBlock: string;
  /** Needs vanilla-style multipart blockstate (door, trapdoor). */
  needsMultipartBlockstate: boolean;
}

/** Block specs: correct vanilla classes + Settings.copy(oak). NO dropsNothing ever. */
export const WOOD_BLOCK_SPECS: WoodBlockSpec[] = [
  { suffix: "_planks", blockClass: "Block", javaCtor: "new Block(PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_PLANKS", needsMultipartBlockstate: false },
  { suffix: "_log", blockClass: "PillarBlock", javaCtor: "new PillarBlock(PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_LOG", needsMultipartBlockstate: false },
  { suffix: "_stripped_log", blockClass: "PillarBlock", javaCtor: "new PillarBlock(PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.STRIPPED_OAK_LOG", needsMultipartBlockstate: false },
  { suffix: "_wood", blockClass: "PillarBlock", javaCtor: "new PillarBlock(PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_WOOD", needsMultipartBlockstate: false },
  { suffix: "_stripped_wood", blockClass: "PillarBlock", javaCtor: "new PillarBlock(PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.STRIPPED_OAK_WOOD", needsMultipartBlockstate: false },
  { suffix: "_stairs", blockClass: "StairsBlock", javaCtor: "new StairsBlock(PLACEHOLDER_PLANKS.getDefaultState(), PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_STAIRS", needsMultipartBlockstate: false },
  { suffix: "_slab", blockClass: "SlabBlock", javaCtor: "new SlabBlock(PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_SLAB", needsMultipartBlockstate: false },
  { suffix: "_fence", blockClass: "FenceBlock", javaCtor: "new FenceBlock(PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_FENCE", needsMultipartBlockstate: false },
  { suffix: "_fence_gate", blockClass: "FenceGateBlock", javaCtor: "new FenceGateBlock(WoodType.OAK, PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_FENCE_GATE", needsMultipartBlockstate: false },
  { suffix: "_door", blockClass: "DoorBlock", javaCtor: "new DoorBlock(BlockSetType.OAK, PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_DOOR", needsMultipartBlockstate: true },
  { suffix: "_trapdoor", blockClass: "TrapdoorBlock", javaCtor: "new TrapdoorBlock(BlockSetType.OAK, PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_TRAPDOOR", needsMultipartBlockstate: true },
  { suffix: "_pressure_plate", blockClass: "PressurePlateBlock", javaCtor: "new PressurePlateBlock(BlockSetType.OAK, PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_PRESSURE_PLATE", needsMultipartBlockstate: false },
  { suffix: "_button", blockClass: "ButtonBlock", javaCtor: "new ButtonBlock(BlockSetType.OAK, 30, PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_BUTTON", needsMultipartBlockstate: false },
  { suffix: "_sign", blockClass: "Block", javaCtor: "new Block(PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_SIGN", needsMultipartBlockstate: false },
  { suffix: "_hanging_sign", blockClass: "HangingSignBlock", javaCtor: "new HangingSignBlock(WoodType.OAK, PLACEHOLDER_SETTINGS)", vanillaBlock: "Blocks.OAK_HANGING_SIGN", needsMultipartBlockstate: false },
];

const SPEC_BY_SUFFIX = new Map(WOOD_BLOCK_SPECS.map((s) => [s.suffix, s]));

export function getWoodBlockSpec(blockId: string, woodIds: string[]): WoodBlockSpec | null {
  for (const woodId of woodIds) {
    for (const suffix of WOOD_BLOCK_SUFFIXES) {
      if (blockId === woodId + suffix) return SPEC_BY_SUFFIX.get(suffix) ?? null;
    }
  }
  return null;
}

export function isWoodBlock(blockId: string, woodIds: string[]): boolean {
  return woodIds.some((w) => WOOD_BLOCK_SUFFIXES.some((s) => blockId === w + s));
}

export function isLogOrWoodBlock(blockId: string, woodIds: string[]): boolean {
  return woodIds.some((w) => LOG_OR_WOOD_SUFFIXES.some((s) => blockId === w + s));
}

/** Resolve planks block var name for a wood type (e.g. maple_planks -> maple_planksBlock). */
function planksVarFor(woodId: string): string {
  return (woodId + "_planks").replace(/-/g, "_") + "Block";
}

/** Java block registration line for a wood block. Uses Settings.copy(vanilla) and correct block classes. */
export function woodBlockRegistrationJava(blockId: string, woodIds: string[]): { varName: string; line: string } | null {
  const spec = getWoodBlockSpec(blockId, woodIds);
  if (!spec) return null;
  const varName = blockId.replace(/-/g, "_") + "Block";
  const settings = `AbstractBlock.Settings.copy(${spec.vanillaBlock})`;
  const woodId = woodIds.find((w) => blockId.startsWith(w + "_"));
  const planksVar = woodId ? planksVarFor(woodId) : "null";
  const ctor = spec.javaCtor
    .replace("PLACEHOLDER_SETTINGS", settings)
    .replace("PLACEHOLDER_PLANKS", planksVar);
  return {
    varName,
    line: `Block ${varName} = Registry.register(Registries.BLOCK, Identifier.of(MOD_ID, "${blockId}"), ${ctor});`,
  };
}

/** Block IDs that are hanging signs (need custom BlockEntityType). */
export function hangingSignBlockIds(expanded: ExpandedSpecTier1): string[] {
  const woodIds = (expanded.spec.woodTypes ?? []).map((w) => w.id);
  return expanded.blocks
    .filter((b) => woodIds.some((w) => b.id === w + "_hanging_sign"))
    .map((b) => b.id);
}

/** Block IDs that need multipart blockstate (door, trapdoor). */
export function woodBlocksNeedingMultipartBlockstate(expanded: ExpandedSpecTier1): string[] {
  const woodIds = (expanded.spec.woodTypes ?? []).map((w) => w.id);
  const out: string[] = [];
  for (const block of expanded.blocks) {
    const spec = getWoodBlockSpec(block.id, woodIds);
    if (spec?.needsMultipartBlockstate) out.push(block.id);
  }
  return out;
}
