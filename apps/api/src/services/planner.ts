import type { ModSpecV1 } from "@themodgenerator/spec";
import { createHelloWorldSpec } from "@themodgenerator/spec";

/**
 * Map user prompt → canonical ModSpecV1.
 * Milestone 1: always return hello-world spec. modId/modName derived from prompt or defaults.
 * Later: LLM or intent extraction → spec.
 */
export function planSpec(prompt: string): ModSpecV1 {
  const trimmed = prompt.trim();
  const modName = trimmed.length > 0 ? sanitizeModName(trimmed.slice(0, 64)) : "Generated Mod";
  const modId = toModId(modName);
  return createHelloWorldSpec(modId, modName);
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
