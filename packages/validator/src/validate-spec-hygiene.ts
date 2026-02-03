/**
 * Spec hygiene: fail if ids or display names contain clarification/question text or exceed limits.
 * Prevents "spec poisoning" from prompt or clarification question leaking into output.
 */

import type { ModSpecV1 } from "@themodgenerator/spec";

const MAX_LANG_VALUE_LEN = 80;

const POISON_PHRASES = [
  "should i",
  "which direction",
  "conflicting ideas",
  "hot and frozen",
  "hot or cold",
  "something else",
  "rephrase",
  "have in mind",
  "not quite sure",
];

function containsPoison(text: string): boolean {
  const lower = text.toLowerCase();
  return POISON_PHRASES.some((p) => lower.includes(p));
}

export interface ValidateSpecHygieneResult {
  valid: boolean;
  errors: string[];
}

export function validateSpecHygiene(spec: ModSpecV1): ValidateSpecHygieneResult {
  const errors: string[] = [];

  if (spec.modName && (containsPoison(spec.modName) || spec.modName.length > MAX_LANG_VALUE_LEN)) {
    if (containsPoison(spec.modName)) errors.push(`modName contains disallowed phrase: "${spec.modName}"`);
    else errors.push(`modName exceeds ${MAX_LANG_VALUE_LEN} chars`);
  }

  for (const item of spec.items ?? []) {
    if (containsPoison(item.id)) errors.push(`item id "${item.id}" contains disallowed phrase`);
    if (item.name && containsPoison(item.name)) errors.push(`item "${item.id}" name contains disallowed phrase: "${item.name}"`);
    if (item.name && item.name.length > MAX_LANG_VALUE_LEN) errors.push(`item "${item.id}" name exceeds ${MAX_LANG_VALUE_LEN} chars`);
  }

  for (const block of spec.blocks ?? []) {
    if (containsPoison(block.id)) errors.push(`block id "${block.id}" contains disallowed phrase`);
    if (block.name && containsPoison(block.name)) errors.push(`block "${block.id}" name contains disallowed phrase: "${block.name}"`);
    if (block.name && block.name.length > MAX_LANG_VALUE_LEN) errors.push(`block "${block.id}" name exceeds ${MAX_LANG_VALUE_LEN} chars`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
