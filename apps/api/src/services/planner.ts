import type { ModSpecV1 } from "@themodgenerator/spec";
import { createHelloWorldSpec } from "@themodgenerator/spec";

/** Hard rule: modId is never derived from prompt. Use fixed id for deterministic packaging. */
const FIXED_MOD_ID = "generated";

const MAX_CONTENT_ID_LEN = 32;

/**
 * Map user prompt → canonical ModSpecV1.
 * modId is always "generated". Registry IDs come from parsed spec semantics (short ids), not raw prompt slug.
 */
export function planSpec(prompt: string): ModSpecV1 {
  const trimmed = prompt.trim();
  const modName = trimmed.length > 0 ? sanitizeModName(trimmed.slice(0, 64)) : "Generated Mod";
  const spec = createHelloWorldSpec(FIXED_MOD_ID, modName);

  if (trimmed.length === 0) {
    return spec;
  }

  const lower = trimmed.toLowerCase();
  const isBlock = isBlockPrompt(trimmed);

  if (/\bcheese\b/.test(lower)) {
    spec.items = [
      { id: "cheese", name: "Cheese" },
      { id: "melted_cheese", name: "Melted Cheese" },
    ];
    spec.blocks = [{ id: "cheese_block", name: "Block of Cheese" }];
    spec.recipes = [
      { id: "cheese_block_from_cheese", type: "crafting_shapeless", result: { id: "cheese_block", count: 1 } },
      { id: "melted_cheese_from_block", type: "smelting", result: { id: "melted_cheese", count: 1 } },
    ];
    if (!spec.features.includes("ingot")) spec.features.push("ingot");
    return spec;
  }

  const contentName = promptToContentName(trimmed);
  const contentId = shortContentId(contentName, isBlock);

  if (isBlock) {
    spec.blocks = [{ id: contentId, name: contentName }];
  } else {
    spec.items = [{ id: contentId, name: contentName }];
  }

  return spec;
}

function sanitizeModName(s: string): string {
  return s.replace(/[^\p{L}\p{N}\s\-_]/gu, "").trim() || "Generated Mod";
}

/** Derive a display name for the content from the prompt (first meaningful phrase). */
function promptToContentName(prompt: string): string {
  let s = prompt
    .replace(/^(?:a|an|the)\s+/i, "")
    .trim()
    .slice(0, 48);
  s = s.replace(/[^\p{L}\p{N}\s\-_]/gu, " ").replace(/\s+/g, " ").trim();
  if (!s) return "Custom";
  return s
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

/**
 * Short registry id from semantics, not full prompt slug.
 * Block: "X block" -> "x_block"; else "custom_block".
 * Item: first word (noun) -> "word"; else "custom_item". Max length MAX_CONTENT_ID_LEN.
 */
function shortContentId(contentName: string, isBlock: boolean): string {
  const slug = contentName
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .slice(0, MAX_CONTENT_ID_LEN);
  const base = slug || (isBlock ? "custom_block" : "custom_item");
  const id = /^\d/.test(base) ? "m_" + base : base;
  return id.slice(0, MAX_CONTENT_ID_LEN);
}

/** True when the prompt clearly describes a block (e.g. "block", "ore"). Exported for clarification gating (block-only = skip cosmetic ask). */
export function isBlockPrompt(prompt: string): boolean {
  return /\b(block|blocks|ore)\b/i.test(prompt);
}
