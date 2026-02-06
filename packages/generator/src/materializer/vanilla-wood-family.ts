/**
 * Single source of truth for vanilla wood family generation.
 * All wood-related blocks/items/recipes/resources use this template.
 * NO dropsNothing / noDrops / custom drop overrides.
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
  /** Java expression for block registration (e.g. "new Block(settings)"). */
  javaCtor: string;
  /** Needs vanilla-style multipart blockstate (door, trapdoor). */
  needsMultipartBlockstate: boolean;
}

/** Vanilla oak block for Settings.copy() - same for all wood types. */
const OAK_BY_SUFFIX: Record<string, string> = {
  _planks: "Blocks.OAK_PLANKS",
  _log: "Blocks.OAK_LOG",
  _stripped_log: "Blocks.STRIPPED_OAK_LOG",
  _wood: "Blocks.OAK_WOOD",
  _stripped_wood: "Blocks.STRIPPED_OAK_WOOD",
  _stairs: "Blocks.OAK_STAIRS",
  _slab: "Blocks.OAK_SLAB",
  _fence: "Blocks.OAK_FENCE",
  _fence_gate: "Blocks.OAK_FENCE_GATE",
  _door: "Blocks.OAK_DOOR",
  _trapdoor: "Blocks.OAK_TRAPDOOR",
  _button: "Blocks.OAK_BUTTON",
  _pressure_plate: "Blocks.OAK_PRESSURE_PLATE",
  _sign: "Blocks.OAK_SIGN",
  _hanging_sign: "Blocks.OAK_HANGING_SIGN",
};

/** Settings expression - AbstractBlock.Settings.copy(oak) for wood blocks. Never dropsNothing. */
function woodSettings(suffix: string): string {
  const oak = OAK_BY_SUFFIX[suffix];
  if (oak) return `AbstractBlock.Settings.copy(${oak})`;
  return "AbstractBlock.Settings.create().strength(2.0f, 3.0f).sounds(BlockSoundGroup.WOOD).burnable()";
}

/** Block specs: suffix → class + Java constructor. Doors/trapdoors need multipart blockstate. */
export const WOOD_BLOCK_SPECS: WoodBlockSpec[] = [
  { suffix: "_planks", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
  { suffix: "_log", blockClass: "PillarBlock", javaCtor: "new PillarBlock(settings)", needsMultipartBlockstate: false },
  { suffix: "_stripped_log", blockClass: "PillarBlock", javaCtor: "new PillarBlock(settings)", needsMultipartBlockstate: false },
  { suffix: "_wood", blockClass: "PillarBlock", javaCtor: "new PillarBlock(settings)", needsMultipartBlockstate: false },
  { suffix: "_stripped_wood", blockClass: "PillarBlock", javaCtor: "new PillarBlock(settings)", needsMultipartBlockstate: false },
  { suffix: "_stairs", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
  { suffix: "_slab", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
  { suffix: "_fence", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
  { suffix: "_fence_gate", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
  { suffix: "_door", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: true },
  { suffix: "_trapdoor", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: true },
  { suffix: "_pressure_plate", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
  { suffix: "_button", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
  { suffix: "_sign", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
  { suffix: "_hanging_sign", blockClass: "Block", javaCtor: "new Block(settings)", needsMultipartBlockstate: false },
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

/** Java block registration line for a wood block. */
export function woodBlockRegistrationJava(blockId: string, woodIds: string[]): { varName: string; line: string } | null {
  const spec = getWoodBlockSpec(blockId, woodIds);
  if (!spec) return null;
  const varName = blockId.replace(/-/g, "_") + "Block";
  const settings = woodSettings(spec.suffix);
  const ctor = spec.javaCtor.replace("settings", settings);
  return {
    varName,
    line: `Block ${varName} = Registry.register(Registries.BLOCK, Identifier.of(MOD_ID, "${blockId}"), ${ctor});`,
  };
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
