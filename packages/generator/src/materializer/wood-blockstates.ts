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

/**
 * Vanilla door rotation: facing north=0, east=90, south=180, west=270 when closed.
 * When open, hinge left swings +90, hinge right swings -90.
 */
const DOOR_Y_ROTATION: Record<string, number> = {
  "lower,north,left,false": 0,
  "lower,north,right,false": 0,
  "lower,east,left,false": 90,
  "lower,east,right,false": 90,
  "lower,south,left,false": 180,
  "lower,south,right,false": 180,
  "lower,west,left,false": 270,
  "lower,west,right,false": 270,
  "lower,north,left,true": 90,
  "lower,north,right,true": 270,
  "lower,east,left,true": 180,
  "lower,east,right,true": 0,
  "lower,south,left,true": 270,
  "lower,south,right,true": 90,
  "lower,west,left,true": 0,
  "lower,west,right,true": 180,
  "upper,north,left,false": 0,
  "upper,north,right,false": 0,
  "upper,east,left,false": 90,
  "upper,east,right,false": 90,
  "upper,south,left,false": 180,
  "upper,south,right,false": 180,
  "upper,west,left,false": 270,
  "upper,west,right,false": 270,
  "upper,north,left,true": 90,
  "upper,north,right,true": 270,
  "upper,east,left,true": 180,
  "upper,east,right,true": 0,
  "upper,south,left,true": 270,
  "upper,south,right,true": 90,
  "upper,west,left,true": 0,
  "upper,west,right,true": 180,
};

/** Full vanilla door multipart: half + facing + hinge + open with correct model refs and rotations. */
export function doorBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  const multipart: Array<{ when: Record<string, string | boolean>; apply: { model: string; y?: number; uvlock: boolean } }> = [];

  const halves: Array<"lower" | "upper"> = ["lower", "upper"];
  const facings = ["north", "east", "south", "west"] as const;
  const hinges = ["left", "right"] as const;
  const opens = [false, true];

  for (const half of halves) {
    const modelSuffix = half === "lower" ? "_bottom" : "_top";
    const model = `${modelBase}${modelSuffix}`;
    for (const facing of facings) {
      for (const hinge of hinges) {
        for (const open of opens) {
          const key = `${half},${facing},${hinge},${open}`;
          const y = DOOR_Y_ROTATION[key] ?? 0;
          multipart.push({
            when: { half, facing, hinge, open },
            apply: { model, y, uvlock: true },
          });
        }
      }
    }
  }

  return JSON.stringify({ multipart });
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
