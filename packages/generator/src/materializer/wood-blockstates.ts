/**
 * Vanilla-style multipart blockstates and models for doors and trapdoors.
 * Required so doors place visibly and open correctly (not as cubes).
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";

function isDoorBlock(blockId: string, woodIds: string[]): boolean {
  return woodIds.some((w) => blockId === w + "_door");
}

function isTrapdoorBlock(blockId: string, woodIds: string[]): boolean {
  return woodIds.some((w) => blockId === w + "_trapdoor");
}

/** Vanilla-style multipart door blockstate. Half lower/upper, rotation handled by block state. */
export function doorBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      multipart: [
        { when: { half: "lower" }, apply: { model: `${modelBase}_bottom`, uvlock: true } },
        { when: { half: "upper" }, apply: { model: `${modelBase}_top`, uvlock: true } },
      ],
    },
    null,
    2
  );
}

/** Vanilla-style multipart trapdoor blockstate. */
export function trapdoorBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      multipart: [
        { when: { half: "bottom" }, apply: { model: `${modelBase}_bottom`, uvlock: true } },
        { when: { half: "top" }, apply: { model: `${modelBase}_top`, uvlock: true } },
      ],
    },
    null,
    2
  );
}

/** Door bottom model - parent minecraft:block/door_bottom with our texture. */
export function doorModelBottom(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      parent: "minecraft:block/door_bottom",
      textures: { bottom: tex, top: tex },
    },
    null,
    2
  );
}

/** Door top model. */
export function doorModelTop(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      parent: "minecraft:block/door_top",
      textures: { bottom: tex, top: tex },
    },
    null,
    2
  );
}

/** Trapdoor bottom model - parent minecraft:block/template_orientable_trapdoor_bottom. */
export function trapdoorModelBottom(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      parent: "minecraft:block/template_orientable_trapdoor_bottom",
      textures: { texture: tex },
    },
    null,
    2
  );
}

/** Trapdoor top model. */
export function trapdoorModelTop(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      parent: "minecraft:block/template_orientable_trapdoor_top",
      textures: { texture: tex },
    },
    null,
    2
  );
}

/** Check if block needs multipart blockstate (door or trapdoor). */
export function needsMultipartBlockstate(blockId: string, expanded: ExpandedSpecTier1): boolean {
  const woodIds = (expanded.spec.woodTypes ?? []).map((w) => w.id);
  return isDoorBlock(blockId, woodIds) || isTrapdoorBlock(blockId, woodIds);
}
