import type { ModSpecV1 } from "@themodgenerator/spec";
import { createHelloWorldSpec } from "@themodgenerator/spec";

/**
 * Map user prompt → canonical ModSpecV1.
 * Phase 1: Populate spec.items or spec.blocks from prompt so the generated mod contains
 * at least one real item or block. Name and id are derived deterministically from prompt text.
 * No hardcoded materials or example content.
 */
export function planSpec(prompt: string): ModSpecV1 {
  const trimmed = prompt.trim();
  const modName = trimmed.length > 0 ? sanitizeModName(trimmed.slice(0, 64)) : "Generated Mod";
  const modId = toModId(modName);
  const spec = createHelloWorldSpec(modId, modName);

  if (trimmed.length === 0) {
    return spec;
  }

  const contentName = promptToContentName(trimmed);
  const contentId = contentIdFromName(contentName);
  const isBlock = isBlockPrompt(trimmed);

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

function toModId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .slice(0, 64);
  const id = base || "generated_mod";
  return /^[a-z]/.test(id) ? id : "m_" + id;
}

/** Derive a display name for the content from the prompt. No hardcoded examples. */
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

/** Derive a valid resource id from a display name (lowercase, underscores). */
function contentIdFromName(name: string): string {
  const id = toModId(name);
  if (!id || /^\d+$/.test(id)) return "custom_item";
  return id;
}

/** True when the prompt clearly describes a block (e.g. "block", "ore"). */
function isBlockPrompt(prompt: string): boolean {
  return /\b(block|blocks|ore)\b/i.test(prompt);
}
