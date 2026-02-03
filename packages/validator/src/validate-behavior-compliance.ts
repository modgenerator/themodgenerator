/**
 * Behavior compliance: fail if spec violates constraints from interpreter.
 * - forbidToolsWeapons: no "tools" feature, no tool/weapon-like item ids
 * - requirePickaxeMining: at least one block when set (mining tags emitted by materializer)
 */

import type { ModSpecV1, ModSpecConstraints } from "@themodgenerator/spec";

const TOOL_WEAPON_ID_PATTERNS = [
  /sword$/,
  /pickaxe$/,
  /axe$/,
  /shovel$/,
  /hoe$/,
  /_sword$/,
  /_pickaxe$/,
  /_axe$/,
  /_shovel$/,
  /_hoe$/,
];

export interface ValidateBehaviorComplianceResult {
  valid: boolean;
  errors: string[];
}

function isToolOrWeaponId(id: string): boolean {
  const lower = id.toLowerCase();
  return TOOL_WEAPON_ID_PATTERNS.some((re) => re.test(lower)) || lower === "sword" || lower === "pickaxe" || lower === "axe" || lower === "shovel" || lower === "hoe";
}

export function validateBehaviorCompliance(
  spec: ModSpecV1,
  constraints?: ModSpecConstraints | null
): ValidateBehaviorComplianceResult {
  const errors: string[] = [];
  const c = constraints ?? spec.constraints;
  if (!c) return { valid: true, errors: [] };

  if (c.forbidToolsWeapons) {
    if (spec.features?.includes("tools")) {
      errors.push("Constraint forbidToolsWeapons: spec must not include 'tools' feature.");
    }
    for (const item of spec.items ?? []) {
      if (isToolOrWeaponId(item.id)) {
        errors.push(`Constraint forbidToolsWeapons: item id "${item.id}" looks like a tool or weapon.`);
      }
    }
  }

  if (c.requirePickaxeMining) {
    const blockCount = spec.blocks?.length ?? 0;
    if (blockCount === 0) {
      errors.push("Constraint requirePickaxeMining: spec must define at least one block.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
