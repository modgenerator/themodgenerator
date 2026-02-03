/**
 * Interpreter → Spec. Builds a structured ModSpecV1 from prompt analysis ONLY.
 * IDs and displayNames MUST NOT be derived from clarification question or raw prompt text.
 * Rule: Use only the original user request (strip "Clarification Answer:" suffix); never use question phrases.
 */

import type { ModSpecV1 } from "@themodgenerator/spec";
import { SUPPORTED_MINECRAFT_VERSION, SUPPORTED_LOADER } from "@themodgenerator/spec";
import type { ClarificationResponse } from "./clarification.js";
import { clarificationGate } from "./clarification.js";
import { analyzePromptIntent } from "./prompt-understanding.js";

const MAX_ID_LEN = 32;
const MAX_DISPLAY_NAME_LEN = 48;
const META_CONCEPTS = new Set(["block", "blocks", "item", "items", "magic", "magical", "strange", "mysterious"]);

/** Phrases that must NEVER appear in ids, displayName, modName, or lang (clarification/question text). */
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

export type InterpretToSpecResult =
  | ClarificationResponse
  | { type: "proceed"; spec: ModSpecV1 };

/**
 * Use only the original user request for name/id derivation. Strip "Clarification Answer:" and everything after (case-insensitive).
 * Handles both "\n\nClarification Answer:" and " Clarification Answer:" (normalized single space).
 */
function stripClarificationSuffix(prompt: string): string {
  const lower = prompt.toLowerCase();
  const marker = "clarification answer:";
  for (const sep of ["\n\n" + marker, "\n" + marker, " " + marker, marker]) {
    const idx = lower.indexOf(sep);
    if (idx >= 0) return prompt.slice(0, idx).trim();
  }
  return prompt;
}

function containsPoison(text: string): boolean {
  const lower = text.toLowerCase();
  return POISON_PHRASES.some((p) => lower.includes(p));
}

/**
 * Slug from display name ONLY. Max 32 chars, ^[a-z][a-z0-9_]*$. Used for ids when displayName is clean.
 */
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

/**
 * Derive a short registry id from concepts only (no full prompt). Max 32 chars, [a-z][a-z0-9_]*.
 * Fallback when slug(displayName) is not used.
 */
function shortIdFromConcepts(concepts: string[], isBlock: boolean): string {
  const content = concepts.filter((c) => !META_CONCEPTS.has(c.toLowerCase()));
  const base = (content[0] ?? "custom").toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "custom";
  const id = isBlock ? (base.endsWith("_block") ? base : base + "_block") : base;
  const out = id.slice(0, MAX_ID_LEN);
  return /^[a-z]/.test(out) ? out : "m_" + out;
}

/**
 * Short human display name from original request only. Prefer "called X" / "X block" pattern; never include question text.
 */
function displayNameFromOriginal(originalOnly: string, firstConcept: string, isBlock: boolean): string {
  const lower = originalOnly.toLowerCase();
  // Stop at first period (sentence end), not comma, so "called Cheese Block. It should" → "Cheese Block"
  const calledMatch = lower.match(/\bcalled\s+([a-z][a-z0-9\s]*?)(?=\s*[.,]|\s+and\s|$)/i);
  if (calledMatch) {
    const name = calledMatch[1].trim().replace(/\s+/g, " ").slice(0, MAX_DISPLAY_NAME_LEN);
    if (name && !containsPoison(name)) {
      const title = name.split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "")).join(" ");
      if (title) return isBlock && !/block$/i.test(title) ? `${title} Block` : title;
    }
  }
  const blockMatch = lower.match(/\b(a\s+)?([a-z][a-z0-9\s]{0,24})\s+block\b/i);
  if (blockMatch) {
    const name = blockMatch[2].trim().replace(/\s+/g, " ").slice(0, MAX_DISPLAY_NAME_LEN);
    if (name && !containsPoison(name)) {
      const title = name.split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "")).join(" ");
      if (title) return `${title} Block`;
    }
  }
  const fallback = firstConcept ? firstConcept[0].toUpperCase() + firstConcept.slice(1) : "Custom";
  return isBlock ? `${fallback} Block` : fallback;
}

/**
 * Build Spec from interpreter analysis. IDs and displayNames from original request only (strip Clarification Answer).
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

  const promptForSpec = stripClarificationSuffix(gate.prompt);
  const originalOnly = stripClarificationSuffix(prompt);
  const analysisForSpec = analyzePromptIntent(promptForSpec);
  const concepts = analysisForSpec.detectedIntent?.concepts ?? [];
  const kind = analysisForSpec.detectedIntent?.kind ?? (concepts.some((c) => ["block", "brick", "stone"].includes(c)) ? "block" : "item");
  const isBlock = kind === "block";

  const firstConcept = concepts.filter((c) => !META_CONCEPTS.has(c.toLowerCase()))[0] ?? "custom";
  // Use original prompt (with punctuation) for display name so "called Cheese Block. It" stops at period
  const displayNameRaw = displayNameFromOriginal(originalOnly, firstConcept, isBlock);
  const displayName = containsPoison(displayNameRaw) ? (isBlock ? `${firstConcept[0].toUpperCase()}${firstConcept.slice(1)} Block` : firstConcept[0].toUpperCase() + firstConcept.slice(1)) : displayNameRaw;

  // IDs from slug(displayName) only — never from raw prompt or clarification question.
  const blockId = slugFromDisplayName(displayName, true);
  const baseId = slugFromDisplayName(displayName.replace(/\s+Block$/i, "").trim() || displayName, false);
  const sanitizedBlockId = /^[a-z][a-z0-9_]*$/.test(blockId) && blockId.length <= MAX_ID_LEN ? blockId : shortIdFromConcepts(concepts, true);
  const sanitizedBaseId = /^[a-z][a-z0-9_]*$/.test(baseId) && baseId.length <= MAX_ID_LEN ? baseId : shortIdFromConcepts(concepts, false);
  const finalBlockId = sanitizedBlockId.slice(0, MAX_ID_LEN);
  const finalBaseId = sanitizedBaseId.slice(0, MAX_ID_LEN);

  const modName = displayName.length > 0 && !containsPoison(displayName) ? `${displayName.replace(/\s+Block$/, "").trim()} Mod` : "Generated Mod";

  const lowerForConstraints = originalOnly.toLowerCase();
  const forbidToolsWeapons =
    /\bno\s+(tools?|weapons?)\b|\bno\s+tools?\s+or\s+weapons?\b|\b(without|don't?\s*add)\s+(any\s+)?(tools?|weapons?)\b/.test(lowerForConstraints);
  const requirePickaxeMining = /\bmineable\s+with\s+(a\s+)?pickaxe\b|\bpickaxe\s+min(eable|ing)\b/.test(lowerForConstraints);

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
    ...((forbidToolsWeapons || requirePickaxeMining) && {
      constraints: {
        ...(forbidToolsWeapons && { forbidToolsWeapons: true }),
        ...(requirePickaxeMining && { requirePickaxeMining: true }),
      },
    }),
  };

  const lowerFull = gate.prompt.toLowerCase();
  const wantsSmelt = /\bsmelt(s|ing|able)?\b|\bfurnace\b|\bmelt(ed)?\b/.test(lowerFull);
  const craftFromMatch = lowerFull.match(/\bcraft(able)?\s+from\s+(\d+)\s+(?:(\w+)\s+)?(?:items?|ingredients?)?\b/);
  const craftCount = craftFromMatch ? Math.min(9, Math.max(1, parseInt(craftFromMatch[2], 10))) : 0;
  let colorHint = simpleColorFromPrompt(promptForSpec.toLowerCase());
  if (!colorHint && gate.prompt.includes("Clarification Answer:")) {
    const answerPart = gate.prompt.split("Clarification Answer:")[1]?.trim().toLowerCase() ?? "";
    colorHint = simpleColorFromPrompt(answerPart);
  }

  if (isBlock) {
    const blockEntry = { id: finalBlockId, name: displayName || "Block", ...(colorHint && { colorHint }) };
    spec.blocks = [blockEntry];
    if (craftCount > 0) {
      spec.items = [{ id: finalBaseId, name: displayName.replace(/\s+Block$/i, "").trim() || displayName || "Item", ...(colorHint && { colorHint }) }];
      spec.recipes = [
        {
          id: `${finalBlockId}_from_${finalBaseId}`,
          type: "crafting_shapeless",
          ingredients: [{ id: finalBaseId, count: craftCount }],
          result: { id: finalBlockId, count: 1 },
        },
      ];
    }
    if (wantsSmelt) {
      const meltedSlug = slugFromDisplayName("Melted " + (displayName.replace(/\s+Block$/i, "").trim() || displayName), false);
      const meltedId = ("melted_" + (finalBaseId === "custom" ? "block" : finalBaseId)).slice(0, MAX_ID_LEN);
      const finalMeltedId = /^[a-z][a-z0-9_]*$/.test(meltedSlug) ? meltedSlug.slice(0, MAX_ID_LEN) : meltedId;
      if (!spec.items?.some((i) => i.id === finalMeltedId)) {
        spec.items = [...(spec.items ?? []), { id: finalMeltedId, name: "Melted " + (displayName.replace(/\s+Block$/i, "").trim() || displayName), ...(colorHint && { colorHint }) }];
      }
      spec.recipes = [
        ...(spec.recipes ?? []),
        {
          id: `${finalMeltedId}_from_block`,
          type: "smelting",
          ingredients: [{ id: finalBlockId, count: 1 }],
          result: { id: finalMeltedId, count: 1 },
        },
      ];
    }
  } else {
    spec.items = [{ id: finalBaseId, name: displayName || "Item", ...(colorHint && { colorHint }) }];
    if (wantsSmelt) {
      const meltedId = ("melted_" + finalBaseId).slice(0, MAX_ID_LEN);
      const finalMeltedId = /^[a-z][a-z0-9_]*$/.test(meltedId) ? meltedId : "melted_" + finalBaseId.slice(0, MAX_ID_LEN - 7);
      spec.items.push({ id: finalMeltedId, name: "Melted " + (displayName || "Item"), ...(colorHint && { colorHint }) });
      spec.recipes = [
        {
          id: `${finalMeltedId}_from_item`,
          type: "smelting",
          ingredients: [{ id: finalBaseId, count: 1 }],
          result: { id: finalMeltedId, count: 1 },
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
