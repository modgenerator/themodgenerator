import type { ModSpecV1, ModItem, ModBlock, ModRecipe } from "@themodgenerator/spec";
import { SUPPORTED_MINECRAFT_VERSION, SUPPORTED_LOADER } from "@themodgenerator/spec";

/** Hard rule: modId is never derived from prompt. Use fixed id for deterministic packaging. */
export const FIXED_MOD_ID = "generated";

const MAX_ID_LEN = 32;
const VALID_ID = /^[a-z][a-z0-9_]*$/;

/**
 * Planner is DUMB: it does NOT infer content from prompt.
 * It only sanitizes a Spec: fixed modId, normalize/shorten ids from Spec fields only.
 * Caller (interpreter) provides the Spec; planner never creates items/blocks/recipes.
 */
export function sanitizeSpec(spec: ModSpecV1): ModSpecV1 {
  const modName = spec.modName?.trim()?.slice(0, 128) || "Generated Mod";

  const out: ModSpecV1 = {
    ...spec,
    modId: FIXED_MOD_ID,
    modName,
    items: spec.items?.map((i) => ({
      ...i,
      id: sanitizeId(i.id, "item"),
      name: i.name?.trim()?.slice(0, 128) || sanitizeId(i.id, "item"),
    })),
    blocks: spec.blocks?.map((b) => ({
      ...b,
      id: sanitizeId(b.id, "block"),
      name: b.name?.trim()?.slice(0, 128) || sanitizeId(b.id, "block"),
    })),
    recipes: spec.recipes?.map((r) => ({
      ...r,
      id: sanitizeId(r.id, "recipe"),
      result: {
        id: sanitizeId(r.result.id, "result"),
        count: r.result.count ?? 1,
      },
      ingredients: r.ingredients?.map((ing) => ({
        id: sanitizeId(ing.id, "ingredient"),
        count: ing.count ?? 1,
      })),
    })),
  };

  return out;
}

/**
 * Sanitize a registry id: [a-z0-9_], starts with letter, max MAX_ID_LEN.
 * If missing/blank, returns a fallback. Never derive from prompt text.
 */
function sanitizeId(id: string | undefined, kind: string): string {
  if (id == null || typeof id !== "string" || !id.trim()) {
    return kind === "block" ? "custom_block" : kind === "item" ? "custom_item" : "recipe";
  }
  const slug = id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, MAX_ID_LEN);
  if (!slug) return kind === "block" ? "custom_block" : "custom_item";
  const out = /^[a-z]/.test(slug) ? slug : "m_" + slug;
  return out.slice(0, MAX_ID_LEN);
}

/** True when the prompt clearly describes a block (e.g. "block", "ore"). Exported for clarification gating. */
export function isBlockPrompt(prompt: string): boolean {
  return /\b(block|blocks|ore)\b/i.test(prompt);
}
