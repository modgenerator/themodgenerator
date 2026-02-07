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

/** Vanilla-style trapdoor blockstate: facing + half + open with rotations. */
export function trapdoorBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  const variants: Record<string, { model: string; y?: number }> = {};
  const facings = ["north", "south", "east", "west"] as const;
  const halves = ["bottom", "top"] as const;
  const opens = [false, true] as const;
  for (const facing of facings) {
    for (const half of halves) {
      for (const open of opens) {
        const key = `facing=${facing},half=${half},open=${open}`;
        let y = 0;
        if (open) {
          if (facing === "east") y = 90;
          else if (facing === "south") y = 180;
          else if (facing === "west") y = 270;
        }
        variants[key] = open
          ? { model: `${modelBase}_open`, ...(y ? { y } : {}) }
          : { model: half === "bottom" ? `${modelBase}_bottom` : `${modelBase}_top` };
      }
    }
  }
  return JSON.stringify({ variants }, null, 2);
}

/** Vanilla-style button blockstate: face + facing + powered with rotations. */
export function buttonBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  const variants: Record<string, { model: string; x?: number; y?: number; uvlock?: boolean }> = {};
  const faces = ["floor", "wall", "ceiling"] as const;
  const facings = ["north", "south", "east", "west"] as const;
  const powereds = [false, true] as const;
  for (const face of faces) {
    for (const facing of facings) {
      for (const powered of powereds) {
        const key = `face=${face},facing=${facing},powered=${powered}`;
        const model = powered ? `${modelBase}_pressed` : modelBase;
        let x = 0;
        let y = 0;
        if (face === "ceiling") {
          x = 180;
          if (facing === "north") y = 180;
          else if (facing === "east") y = 270;
          else if (facing === "west") y = 90;
        } else if (face === "wall") {
          x = 90;
          if (facing === "south") y = 180;
          else if (facing === "west") y = 270;
          else if (facing === "east") y = 90;
          variants[key] = { model, uvlock: true, x, ...(y ? { y } : {}) };
          continue;
        } else {
          if (facing === "south") y = 180;
          else if (facing === "west") y = 270;
          else if (facing === "east") y = 90;
        }
        variants[key] = { model, ...(x ? { x } : {}), ...(y ? { y } : {}) };
      }
    }
  }
  return JSON.stringify({ variants }, null, 2);
}

/** Vanilla-style pressure plate blockstate: powered true/false. */
export function pressurePlateBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      variants: {
        "powered=false": { model: `${modelBase}_up` },
        "powered=true": { model: `${modelBase}_down` },
      },
    },
    null,
    2
  );
}

/** Vanilla-style fence gate blockstate: facing + open + in_wall. */
export function fenceGateBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  const variants: Record<string, { model: string; y?: number; uvlock?: boolean }> = {};
  const facings = ["north", "south", "east", "west"] as const;
  const opens = [false, true] as const;
  const inWalls = [false, true] as const;
  for (const facing of facings) {
    for (const open of opens) {
      for (const inWall of inWalls) {
        const key = `facing=${facing},open=${open},in_wall=${inWall}`;
        const suffix = inWall ? (open ? "_wall_open" : "_wall") : (open ? "_open" : "");
        const model = `${modelBase}${suffix}`;
        let y = 0;
        if (facing === "south") y = 180;
        else if (facing === "west") y = 270;
        else if (facing === "east") y = 90;
        variants[key] = { model, uvlock: true, ...(y ? { y } : {}) };
      }
    }
  }
  return JSON.stringify({ variants }, null, 2);
}

/** Vanilla-style slab blockstate: type=bottom/top/double. */
export function slabBlockstateJson(modId: string, blockId: string, planksId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  const planksModel = `${modId}:block/${planksId}`;
  return JSON.stringify(
    {
      variants: {
        "type=bottom": { model: modelBase },
        "type=top": { model: `${modelBase}_top` },
        "type=double": { model: planksModel },
      },
    },
    null,
    2
  );
}

/** Vanilla-style stairs blockstate: facing + half + shape with rotations. */
export function stairsBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  const variants: Record<string, { model: string; y?: number; uvlock?: boolean }> = {};
  const facings = ["north", "south", "east", "west"] as const;
  const halves = ["bottom", "top"] as const;
  const shapes = ["straight", "inner_left", "inner_right", "outer_left", "outer_right"] as const;
  for (const facing of facings) {
    for (const half of halves) {
      for (const shape of shapes) {
        const key = `facing=${facing},half=${half},shape=${shape}`;
        let model = modelBase;
        if (shape === "inner_left" || shape === "inner_right") model = `${modelBase}_inner`;
        else if (shape === "outer_left" || shape === "outer_right") model = `${modelBase}_outer`;
        let y = 0;
        if (facing === "south") y = 180;
        else if (facing === "west") y = 270;
        else if (facing === "east") y = 90;
        variants[key] = { model, uvlock: true, ...(y ? { y } : {}) };
      }
    }
  }
  return JSON.stringify({ variants }, null, 2);
}

/** Sign blockstate. Use "" variant for generic Block (SignBlock would use rotation). */
export function signBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      variants: {
        "": { model: modelBase },
      },
    },
    null,
    2
  );
}

/** Hanging sign blockstate: attached + rotation variants (vanilla-style, MC 1.21.1). */
export function hangingSignBlockstateJson(modId: string, blockId: string): string {
  const modelBase = `${modId}:block/${blockId}`;
  const variants: Record<string, { model: string; y?: number }> = {};
  const attached = [false, true] as const;
  for (const a of attached) {
    for (let rotation = 0; rotation < 16; rotation++) {
      const key = `attached=${a},rotation=${rotation}`;
      const y = rotation * 22.5;
      variants[key] = { model: modelBase, y };
    }
  }
  return JSON.stringify({ variants }, null, 2);
}

/** Door bottom model - uses door_bottom and door_top textures (16x32 door). */
export function doorModelBottom(modId: string, blockId: string): string {
  const bottomTex = `${modId}:block/${blockId}_bottom`;
  const topTex = `${modId}:block/${blockId}_top`;
  return JSON.stringify(
    {
      parent: "minecraft:block/door_bottom",
      textures: { bottom: bottomTex, top: topTex },
    },
    null,
    2
  );
}

/** Door top model. */
export function doorModelTop(modId: string, blockId: string): string {
  const bottomTex = `${modId}:block/${blockId}_bottom`;
  const topTex = `${modId}:block/${blockId}_top`;
  return JSON.stringify(
    {
      parent: "minecraft:block/door_top",
      textures: { bottom: bottomTex, top: topTex },
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

/** Trapdoor open model (horizontal). */
export function trapdoorModelOpen(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      parent: "minecraft:block/template_orientable_trapdoor_open",
      textures: { texture: tex },
    },
    null,
    2
  );
}

/** Button model (parent minecraft:block/button). */
export function buttonModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_button", "_planks")}`;
  return JSON.stringify({ parent: "minecraft:block/button", textures: { texture: tex } }, null, 2);
}

/** Button pressed model. */
export function buttonPressedModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_button", "_planks")}`;
  return JSON.stringify({ parent: "minecraft:block/button_pressed", textures: { texture: tex } }, null, 2);
}

/** Button inventory model (for item). */
export function buttonInventoryModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_button", "_planks")}`;
  return JSON.stringify({ parent: "minecraft:block/button_inventory", textures: { texture: tex } }, null, 2);
}

/** Pressure plate up model. */
export function pressurePlateUpModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_pressure_plate", "_planks")}`;
  return JSON.stringify({ parent: "minecraft:block/pressure_plate_up", textures: { texture: tex } }, null, 2);
}

/** Pressure plate down model. */
export function pressurePlateDownModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_pressure_plate", "_planks")}`;
  return JSON.stringify({ parent: "minecraft:block/pressure_plate_down", textures: { texture: tex } }, null, 2);
}

/** Fence gate models (4 variants). */
export function fenceGateModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_fence_gate", "_planks")}`;
  return JSON.stringify(
    { parent: "minecraft:block/template_fence_gate", textures: { texture: tex } },
    null,
    2
  );
}

export function fenceGateOpenModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_fence_gate", "_planks")}`;
  return JSON.stringify(
    { parent: "minecraft:block/template_fence_gate_open", textures: { texture: tex } },
    null,
    2
  );
}

export function fenceGateWallModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_fence_gate", "_planks")}`;
  return JSON.stringify(
    { parent: "minecraft:block/template_fence_gate_wall", textures: { texture: tex } },
    null,
    2
  );
}

export function fenceGateWallOpenModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_fence_gate", "_planks")}`;
  return JSON.stringify(
    { parent: "minecraft:block/template_fence_gate_wall_open", textures: { texture: tex } },
    null,
    2
  );
}

/** Slab models. */
export function slabModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_slab", "_planks")}`;
  return JSON.stringify({ parent: "minecraft:block/slab", textures: { bottom: tex, top: tex, side: tex } }, null, 2);
}

export function slabTopModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_slab", "_planks")}`;
  return JSON.stringify(
    { parent: "minecraft:block/slab_top", textures: { bottom: tex, top: tex, side: tex } },
    null,
    2
  );
}

/** Stairs models. */
export function stairsModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_stairs", "_planks")}`;
  return JSON.stringify(
    { parent: "minecraft:block/stairs", textures: { bottom: tex, top: tex, side: tex } },
    null,
    2
  );
}

export function stairsInnerModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_stairs", "_planks")}`;
  return JSON.stringify(
    { parent: "minecraft:block/inner_stairs", textures: { bottom: tex, top: tex, side: tex } },
    null,
    2
  );
}

export function stairsOuterModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId.replace("_stairs", "_planks")}`;
  return JSON.stringify(
    { parent: "minecraft:block/outer_stairs", textures: { bottom: tex, top: tex, side: tex } },
    null,
    2
  );
}

/** Sign model - uses template_standing_sign with sign board texture. */
export function signModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      parent: "minecraft:block/template_standing_sign",
      textures: { particle: tex, texture: tex },
    },
    null,
    2
  );
}

/** Hanging sign model - uses template_hanging_sign with sign board texture. */
export function hangingSignModel(modId: string, blockId: string): string {
  const tex = `${modId}:block/${blockId}`;
  return JSON.stringify(
    {
      parent: "minecraft:block/template_hanging_sign",
      textures: { particle: tex, texture: tex },
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
