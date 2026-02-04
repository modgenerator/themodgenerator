/**
 * Extract cooking directives from prompt text (Smelt X into Y, Blast X into Y, etc.).
 * Returns ModRecipe[] and ModItem[] for any referenced entities that are not yet in spec.
 * No noun-specific hardcoding; resolves X and Y by display name or creates items.
 */

import type { ModSpecV1, ModRecipe, ModItem, CookingKind } from "@themodgenerator/spec";

const MAX_ID_LEN = 32;

function slugFromDisplayName(displayName: string, isBlock: boolean): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, MAX_ID_LEN) || "custom";
  const base = slug || "custom";
  const id = isBlock ? (base.endsWith("_block") ? base : base + "_block") : base;
  const out = id.slice(0, MAX_ID_LEN);
  return /^[a-z]/.test(out) ? out : "m_" + out;
}

/** Resolve display name to an existing item or block id in spec; otherwise return null. */
function resolveDisplayNameToId(spec: ModSpecV1, displayName: string): string | null {
  const normalized = displayName.trim();
  const slug = slugFromDisplayName(normalized, false);
  const slugBlock = slugFromDisplayName(normalized, true);
  for (const item of spec.items ?? []) {
    if (item.id === slug || item.name.toLowerCase() === normalized.toLowerCase()) return item.id;
  }
  for (const block of spec.blocks ?? []) {
    if (block.id === slug || block.id === slugBlock || block.name.toLowerCase() === normalized.toLowerCase())
      return block.id;
  }
  return null;
}

/** Ensure we have an id for this display name: use existing or create new item (return id and optional item to add). */
function ensureIdForDisplayName(
  spec: ModSpecV1,
  displayName: string,
  existing: Map<string, ModItem>
): { id: string; itemToAdd?: ModItem } {
  const id = resolveDisplayNameToId(spec, displayName);
  if (id) return { id };
  const newId = slugFromDisplayName(displayName.trim(), false);
  if (existing.has(newId)) return { id: newId };
  const name = displayName.trim() || "Item";
  const item: ModItem = { id: newId, name };
  existing.set(newId, item);
  return { id: newId, itemToAdd: item };
}

export interface CookingDirective {
  kind: CookingKind;
  ingredientName: string;
  resultName: string;
}

/** Strip trailing " and smelt ..." from result name so we don't capture the next clause. */
function trimResultName(s: string): string {
  return s
    .trim()
    .replace(/\s+and\s+(?:smelt|blast|smoke|cook)\s+.*$/i, "")
    .trim();
}

/** Split by " and smelt " / " and blast " etc. so each segment contains at most one cooking verb. */
function splitCookingSegments(prompt: string): string[] {
  return prompt
    .split(/\s+and\s+(?=smelt\s|blast\s|smoke\s|cook\s)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse prompt for cooking phrases; returns list of (kind, ingredient display name, result display name). */
export function parseCookingPhrases(prompt: string): CookingDirective[] {
  const out: CookingDirective[] = [];
  const seen = new Set<string>();

  function add(kind: CookingKind, ingredientName: string, resultName: string) {
    const key = `${kind}:${ingredientName}:${resultName}`;
    if (seen.has(key)) return;
    seen.add(key);
    const ing = ingredientName.trim();
    const res = trimResultName(resultName);
    if (ing && res) out.push({ kind, ingredientName: ing, resultName: res });
  }

  const segments = splitCookingSegments(prompt);

  for (const segment of segments) {
    let m: RegExpExecArray | null;
    // "Smelt X into Y" or "Smelt X to make Y"
    const smeltRe = /\bsmelt\s+(.+?)\s+into\s+(.+?)(?=[.]|$)/gi;
    while ((m = smeltRe.exec(segment)) !== null) {
      add("smelting", m[1], m[2]);
    }
    const smeltMakeRe = /\bsmelt\s+(.+?)\s+to\s+make\s+(.+?)(?=[.]|$)/gi;
    while ((m = smeltMakeRe.exec(segment)) !== null) {
      add("smelting", m[1], m[2]);
    }
  }

  for (const segment of segments) {
    let m: RegExpExecArray | null;
    // "Blast X into Y"
    const blastRe = /\bblast\s+(.+?)\s+into\s+(.+?)(?=[.]|$)/gi;
    while ((m = blastRe.exec(segment)) !== null) {
      add("blasting", m[1], m[2]);
    }
    // "Smoke X into Y"
    const smokeRe = /\bsmoke\s+(.+?)\s+into\s+(.+?)(?=[.]|$)/gi;
    while ((m = smokeRe.exec(segment)) !== null) {
      add("smoking", m[1], m[2]);
    }
    // "Cook X into Y in a campfire" or "Cook X in a campfire"
    const cookIntoRe = /\bcook\s+(.+?)\s+into\s+(.+?)\s+in\s+(?:a\s+)?campfire/gi;
    while ((m = cookIntoRe.exec(segment)) !== null) {
      add("campfire_cooking", m[1], m[2]);
    }
    const cookRe = /\bcook\s+(.+?)\s+in\s+(?:a\s+)?campfire/gi;
    while ((m = cookRe.exec(segment)) !== null) {
      const ing = m[1].trim();
      add("campfire_cooking", ing, ing);
    }
  }

  return out;
}

/** Stable recipe id: resultId_from_ingredientId_kind (colons replaced with _). */
export function cookingRecipeId(resultId: string, ingredientId: string, kind: CookingKind): string {
  const r = resultId.replace(/:/g, "_");
  const i = ingredientId.replace(/:/g, "_");
  return `${r}_from_${i}_${kind}`;
}

export interface ExtractCookingResult {
  recipes: ModRecipe[];
  itemsToAdd: ModItem[];
}

/**
 * Extract cooking recipes from prompt and resolve to spec entities.
 * Creates missing items for referenced names; returns recipes to merge and items to add.
 */
export function extractCookingDirectives(
  prompt: string,
  spec: ModSpecV1,
  options: { noRecipes?: boolean }
): ExtractCookingResult {
  const recipes: ModRecipe[] = [];
  const itemsToAddMap = new Map<string, ModItem>();

  if (options.noRecipes) return { recipes: [], itemsToAdd: [] };

  const directives = parseCookingPhrases(prompt);
  for (const d of directives) {
    if (!d.ingredientName || !d.resultName) continue;
    const ing = ensureIdForDisplayName(spec, d.ingredientName, itemsToAddMap);
    const res = ensureIdForDisplayName(spec, d.resultName, itemsToAddMap);
    if (ing.id === res.id) continue; // no self-loop
    const recipeId = cookingRecipeId(res.id, ing.id, d.kind);
    recipes.push({
      id: recipeId,
      type: d.kind,
      ingredients: [{ id: ing.id, count: 1 }],
      result: { id: res.id, count: 1 },
      experience: 0.35,
      cookingtime: d.kind === "smelting" ? 200 : d.kind === "campfire_cooking" ? 600 : 100,
    });
  }

  const itemsToAdd = Array.from(itemsToAddMap.values());
  return { recipes, itemsToAdd };
}
