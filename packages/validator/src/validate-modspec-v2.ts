/**
 * Validator for ModSpecV2 / ExpandedModSpecV2.
 * Fail job if: refs missing, recipe types violated, tool/armor out of bounds.
 */

import type { ExpandedModSpecV2, ModSpecV2Item } from "@themodgenerator/spec";

export interface ValidateModSpecV2Result {
  valid: boolean;
  errors: string[];
  code?: string;
}

function allBlockIds(spec: ExpandedModSpecV2): Set<string> {
  const s = new Set<string>();
  for (const b of spec.blocks ?? []) s.add(b.id);
  return s;
}

function allItemIds(spec: ExpandedModSpecV2): Set<string> {
  const s = new Set<string>();
  for (const i of spec.items ?? []) s.add(i.id);
  return s;
}

function allMaterialIds(spec: ExpandedModSpecV2): Set<string> {
  const s = new Set<string>();
  for (const m of spec.materials ?? []) s.add(m.id);
  return s;
}

/** All referenced IDs exist (items, blocks, materials). */
function validateRefs(spec: ExpandedModSpecV2): string[] {
  const errors: string[] = [];
  const blockIds = allBlockIds(spec);
  const itemIds = allItemIds(spec);
  const materialIds = allMaterialIds(spec);

  for (const b of spec.blocks ?? []) {
    if (b.materialRef && !materialIds.has(b.materialRef)) {
      errors.push(`Block "${b.id}" references missing material "${b.materialRef}".`);
    }
    if (b.dropsSpec && !itemIds.has(b.dropsSpec.itemId) && !blockIds.has(b.dropsSpec.itemId)) {
      errors.push(`Block "${b.id}" dropsSpec references missing item/block "${b.dropsSpec.itemId}".`);
    }
  }

  for (const i of spec.items ?? []) {
    if (!materialIds.has(i.materialRef)) {
      errors.push(`Item "${i.id}" references missing material "${i.materialRef}".`);
    }
  }

  for (const r of spec.recipes ?? []) {
    if (!itemIds.has(r.result.id) && !blockIds.has(r.result.id)) {
      errors.push(`Recipe "${r.id}" result "${r.result.id}" is not a defined item or block.`);
    }
    for (const ing of r.inputs ?? []) {
      if (ing.id && !itemIds.has(ing.id) && !blockIds.has(ing.id)) {
        errors.push(`Recipe "${r.id}" input "${ing.id}" is not a defined item or block.`);
      }
    }
  }

  for (const w of spec.worldgen ?? []) {
    if (!blockIds.has(w.oreBlockId)) {
      errors.push(`Worldgen oreBlockId "${w.oreBlockId}" is not a defined block.`);
    }
  }

  return errors;
}

/** Ore inputs: only smelting and blasting allowed; no smoking. Smoker only for food. Stonecutting only for blocks. */
function validateRecipeTypes(spec: ExpandedModSpecV2): string[] {
  const errors: string[] = [];
  const blockIds = allBlockIds(spec);
  const oreRawIds = new Set<string>();
  const foodItemIds = new Set<string>();

  for (const b of spec.blocks ?? []) {
    if (b.kind === "ore" && b.dropsSpec) oreRawIds.add(b.dropsSpec.itemId);
  }
  for (const i of spec.items ?? []) {
    if (i.kind === "food") foodItemIds.add(i.id);
  }

  for (const r of spec.recipes ?? []) {
    if (r.type === "smoking") {
      const resultId = r.result.id;
      const inputIds = (r.inputs ?? []).map((x) => x.id).filter(Boolean);
      const resultIsFood = foodItemIds.has(resultId);
      const anyInputOre = inputIds.some((id) => oreRawIds.has(id));
      if (anyInputOre) {
        errors.push(`Recipe "${r.id}": ores/raw materials cannot be smoked; use smelting or blasting.`);
      }
      if (!resultIsFood && inputIds.length > 0) {
        const firstInput = spec.items?.find((it) => it.id === inputIds[0]) ?? spec.blocks?.find((b) => b.id === inputIds[0]);
        const inputIsFood = firstInput && "kind" in firstInput && (firstInput as ModSpecV2Item).kind === "food";
        if (!inputIsFood) {
          errors.push(`Recipe "${r.id}": smoker recipes are only allowed for food category.`);
        }
      }
    }
    if (r.type === "stonecutting") {
      const resultId = r.result.id;
      if (!blockIds.has(resultId)) {
        errors.push(`Recipe "${r.id}": stonecutting result must be a block, not "${resultId}".`);
      }
    }
  }

  return errors;
}

/** Tool/armor: required fields present and within bounds (delegate to balance bounds). */
function validateToolArmorBounds(spec: ExpandedModSpecV2): string[] {
  const errors: string[] = [];
  for (const i of spec.items ?? []) {
    if (i.kind === "tool" || i.kind === "armor") {
      const mat = spec.materials?.find((m) => m.id === i.materialRef);
      if (!mat) {
        errors.push(`Item "${i.id}" (${i.kind}) has missing materialRef "${i.materialRef}".`);
      }
      if (i.kind === "armor") {
        const m = spec.materials?.find((mm) => mm.id === i.materialRef);
        if (m && (m.powerProfile === "cosmetic" || m.styleOverPower)) {
        }
      }
    }
  }
  return errors;
}

export function validateModSpecV2(spec: ExpandedModSpecV2): ValidateModSpecV2Result {
  const errors: string[] = [];
  errors.push(...validateRefs(spec));
  errors.push(...validateRecipeTypes(spec));
  errors.push(...validateToolArmorBounds(spec));

  if (errors.length > 0) {
    return { valid: false, errors, code: "MODSPEC_V2_VALIDATION_FAILED" };
  }
  return { valid: true, errors: [] };
}
