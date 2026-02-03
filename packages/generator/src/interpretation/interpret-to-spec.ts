/**
 * Interpreter → Spec. Builds a structured ModSpecV1 from prompt analysis ONLY.
 * No keyword hacks (no "cheese", "ruby" branches). IDs come from concepts/semantics only.
 * Rule: "Never embed full user prompt in ids. Provide clean ids like cheese_block, melted_cheese."
 */

import type { ModSpecV1 } from "@themodgenerator/spec";
import { SUPPORTED_MINECRAFT_VERSION, SUPPORTED_LOADER } from "@themodgenerator/spec";
import type { ClarificationResponse } from "./clarification.js";
import { clarificationGate } from "./clarification.js";
import { analyzePromptIntent } from "./prompt-understanding.js";

const MAX_ID_LEN = 32;
const META_CONCEPTS = new Set(["block", "blocks", "item", "items", "magic", "magical", "strange", "mysterious"]);

export type InterpretToSpecResult =
  | ClarificationResponse
  | { type: "proceed"; spec: ModSpecV1 };

/**
 * Derive a short registry id from concepts only (no full prompt).
 * Block: first content concept + "_block"; item: first content concept. Max 32 chars.
 */
function shortIdFromConcepts(concepts: string[], isBlock: boolean): string {
  const content = concepts.filter((c) => !META_CONCEPTS.has(c.toLowerCase()));
  const base = (content[0] ?? "custom").toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "custom";
  const id = isBlock ? (base.endsWith("_block") ? base : base + "_block") : base;
  const out = id.slice(0, MAX_ID_LEN);
  return /^[a-z]/.test(out) ? out : "m_" + out;
}

/** Display name from normalized prompt (first phrase, title case). */
function displayNameFromNormalized(normalized: string): string {
  const s = normalized.trim().slice(0, 48).replace(/\s+/g, " ").trim();
  if (!s) return "Custom";
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

/**
 * Build Spec from interpreter analysis. No prompt-text in ids; only concepts + generic rules.
 * - One block or one item (from kind + concepts).
 * - If prompt mentions smelt/smelting and we have a block: add melted_<base> item and smelting recipe.
 */
export function interpretToSpec(
  prompt: string,
  options?: { blockOnly?: boolean }
): InterpretToSpecResult {
  const analysis = analyzePromptIntent(prompt);
  const gate = clarificationGate(analysis, options);
  if (gate.type === "request_clarification") {
    return gate;
  }

  const normalized = gate.prompt;
  const concepts = analysis.detectedIntent?.concepts ?? [];
  const kind = analysis.detectedIntent?.kind ?? (concepts.some((c) => ["block", "brick", "stone"].includes(c)) ? "block" : "item");
  const isBlock = kind === "block";

  const baseId = shortIdFromConcepts(concepts, false);
  const blockId = shortIdFromConcepts(concepts, true);
  const displayName = displayNameFromNormalized(normalized);

  const modName = displayName.length > 0 ? displayName + " Mod" : "Generated Mod";

  const spec: ModSpecV1 = {
    schemaVersion: 1,
    minecraftVersion: SUPPORTED_MINECRAFT_VERSION,
    loader: SUPPORTED_LOADER,
    modId: "generated",
    modName,
    features: ["hello-world"],
    items: [],
    blocks: [],
    recipes: [],
  };

  const lower = normalized.toLowerCase();
  const wantsSmelt = /\bsmelt(s|ing|able)?\b|\bfurnace\b|\bmelt(ed)?\b/.test(lower);
  const craftFromMatch = lower.match(/\bcraft(able)?\s+from\s+(\d+)\s+(?:(\w+)\s+)?(?:items?|ingredients?)?\b/);
  const craftCount = craftFromMatch ? Math.min(9, Math.max(1, parseInt(craftFromMatch[2], 10))) : 0;
  const colorHint = simpleColorFromPrompt(lower);

  if (isBlock) {
    const blockEntry = { id: blockId, name: displayName || "Block", ...(colorHint && { colorHint }) };
    spec.blocks = [blockEntry];
    if (craftCount > 0) {
      spec.items = [{ id: baseId, name: displayName || "Item", ...(colorHint && { colorHint }) }];
      spec.recipes = [
        {
          id: `${blockId}_from_${baseId}`,
          type: "crafting_shapeless",
          ingredients: [{ id: baseId, count: craftCount }],
          result: { id: blockId, count: 1 },
        },
      ];
    }
    if (wantsSmelt) {
      const meltedId = "melted_" + (baseId === "custom" ? "block" : baseId);
      if (!spec.items?.some((i) => i.id === meltedId)) {
        spec.items = [...(spec.items ?? []), { id: meltedId, name: "Melted " + (displayName || "Block") }];
      }
      spec.recipes = [
        ...(spec.recipes ?? []),
        {
          id: `${meltedId}_from_block`,
          type: "smelting",
          ingredients: [{ id: blockId, count: 1 }],
          result: { id: meltedId, count: 1 },
        },
      ];
    }
  } else {
    spec.items = [{ id: baseId, name: displayName || "Item", ...(colorHint && { colorHint }) }];
    if (wantsSmelt) {
      const meltedId = "melted_" + baseId;
      spec.items.push({ id: meltedId, name: "Melted " + (displayName || "Item") });
      spec.recipes = [
        {
          id: `${meltedId}_from_item`,
          type: "smelting",
          ingredients: [{ id: baseId, count: 1 }],
          result: { id: meltedId, count: 1 },
        },
      ];
    }
  }

  return { type: "proceed", spec };
}

function simpleColorFromPrompt(lower: string): string | undefined {
  if (/\byellow\b/.test(lower)) return "yellow";
  if (/\bred\b/.test(lower)) return "red";
  if (/\bblue\b/.test(lower)) return "blue";
  if (/\bgreen\b/.test(lower)) return "green";
  if (/\borange\b/.test(lower)) return "orange";
  if (/\bpurple\b/.test(lower)) return "purple";
  if (/\bwhite\b/.test(lower)) return "white";
  if (/\bblack\b/.test(lower)) return "black";
  if (/\bgray\b|\bgrey\b/.test(lower)) return "gray";
  return undefined;
}
