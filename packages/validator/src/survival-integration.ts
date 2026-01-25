import type { ModSpecV1 } from "@themodgenerator/spec";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Survival integration gate: if ore/block exists, it must have loot + recipe + use.
 * For hello-world we have no ores; this is a stub for future expansion.
 */
export function validateSurvivalIntegration(spec: ModSpecV1): ValidationResult {
  if (spec.ores && spec.ores.length > 0) {
    for (const ore of spec.ores) {
      if (!ore.lootTable) {
        return { valid: false, reason: `Ore "${ore.id}" must have loot (Survival integration).` };
      }
      if (!ore.recipeId && spec.recipes) {
        const hasRecipe = spec.recipes.some((r) => r.result.id === ore.blockId || r.id === ore.recipeId);
        if (!hasRecipe) {
          return { valid: false, reason: `Ore "${ore.id}" should have a recipe for Survival.` };
        }
      }
    }
  }
  return { valid: true };
}
