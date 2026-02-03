/**
 * Recipe validation: fail fast if recipes are invalid for Minecraft 1.21.1.
 * - crafting_shapeless must have at least one ingredient
 * - smelting/blasting: ingredient must not equal result (no self-loop)
 * - every ingredient and result id must reference an item or block in the spec
 */

import type { ModSpecV1 } from "@themodgenerator/spec";

export interface ValidateRecipesResult {
  valid: boolean;
  errors: string[];
}

function allIds(spec: ModSpecV1): Set<string> {
  const set = new Set<string>();
  for (const i of spec.items ?? []) set.add(i.id);
  for (const b of spec.blocks ?? []) set.add(b.id);
  return set;
}

export function validateRecipes(spec: ModSpecV1): ValidateRecipesResult {
  const errors: string[] = [];
  const ids = allIds(spec);

  for (const rec of spec.recipes ?? []) {
    if (rec.type === "crafting_shapeless") {
      const count = rec.ingredients?.length ?? 0;
      if (count === 0) {
        errors.push(`Recipe ${rec.id}: crafting_shapeless must have at least one ingredient.`);
      }
      for (const ing of rec.ingredients ?? []) {
        if (!ids.has(ing.id)) {
          errors.push(`Recipe ${rec.id}: ingredient "${ing.id}" is not an item or block in the spec.`);
        }
      }
      if (!ids.has(rec.result.id)) {
        errors.push(`Recipe ${rec.id}: result "${rec.result.id}" is not an item or block in the spec.`);
      }
    } else if (rec.type === "smelting" || rec.type === "blasting") {
      const ing = rec.ingredients?.[0];
      if (!ing?.id) {
        errors.push(`Recipe ${rec.id}: ${rec.type} must have at least one ingredient.`);
      } else {
        if (ing.id === rec.result.id) {
          errors.push(`Recipe ${rec.id}: ${rec.type} ingredient must not equal result (no self-loop).`);
        }
        if (!ids.has(ing.id)) {
          errors.push(`Recipe ${rec.id}: ingredient "${ing.id}" is not an item or block in the spec.`);
        }
      }
      if (!ids.has(rec.result.id)) {
        errors.push(`Recipe ${rec.id}: result "${rec.result.id}" is not an item or block in the spec.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
