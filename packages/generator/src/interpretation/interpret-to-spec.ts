/**
 * Interpreter → Spec. Builds a structured ModSpecV1 from prompt analysis ONLY.
 * IDs and displayNames MUST NOT be derived from clarification question or raw prompt text.
 * Rule: Use only the original user request (strip "Clarification Answer:" suffix); never use question phrases.
 */

import type { ModSpecV1, ItemRenderIntent } from "@themodgenerator/spec";
import { SUPPORTED_MINECRAFT_VERSION, SUPPORTED_LOADER } from "@themodgenerator/spec";
import type { ClarificationResponse } from "./clarification.js";
import { extractEntityList } from "./entity-list-extractor.js";
import { inferItemRender } from "./infer-item-render.js";
import { clarificationGate } from "./clarification.js";
import { analyzePromptIntent } from "./prompt-understanding.js";
import {
  inferTextureProfile,
  getTextureProfileConfidenceThreshold,
} from "./texture-profile-inference.js";

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

  const entityExtraction = extractEntityList(originalOnly);

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

  const threshold = getTextureProfileConfidenceThreshold();

  function attachTextureProfile<T extends { id: string; name: string; colorHint?: string }>(
    displayName: string,
    intent: "block" | "item" | "processed",
    entity: T,
    familyType?: string
  ): { entity: T & { textureIntent: "block" | "item" | "processed"; textureProfile: import("@themodgenerator/spec").TextureProfile }; clarification?: ClarificationResponse } {
    const { profile, confidence } = inferTextureProfile(displayName, intent, { familyType });
    if (confidence < threshold) {
      return {
        entity: entity as T & { textureIntent: "block" | "item" | "processed"; textureProfile: import("@themodgenerator/spec").TextureProfile },
        clarification: {
          type: "request_clarification",
          message: `Texture inference confidence too low (${confidence.toFixed(2)} < ${threshold}): cannot infer texture profile for "${displayName}". Use a more descriptive name (e.g. "Cheese Block", "Ocean Wood").`,
        },
      };
    }
    const out = { ...entity, textureIntent: intent, textureProfile: profile };
    if (intent === "item") {
      (out as { itemRender?: ItemRenderIntent }).itemRender = inferItemRender(displayName);
    } else if (intent === "processed") {
      (out as { itemRender?: ItemRenderIntent }).itemRender = "flat";
    }
    return { entity: out };
  }

  if (entityExtraction.entities.length > 0) {
    for (const e of entityExtraction.entities) {
      const displayName = e.displayName.trim() || "Item";
      const isBlockEntity = e.type === "block" && !entityExtraction.noBlocks;
      const rawId = slugFromDisplayName(displayName, isBlockEntity);
      const finalId = (/^[a-z][a-z0-9_]*$/.test(rawId) && rawId.length <= MAX_ID_LEN ? rawId : shortIdFromConcepts([displayName.toLowerCase().replace(/[^a-z0-9]/g, "_")], isBlockEntity)).slice(0, MAX_ID_LEN);
      if (isBlockEntity) {
        const blockResult = attachTextureProfile(displayName, "block", { id: finalId, name: displayName, ...(colorHint && { colorHint }) });
        if (blockResult.clarification) return blockResult.clarification;
        spec.blocks = [...(spec.blocks ?? []), blockResult.entity];
      } else {
        const itemResult = attachTextureProfile(displayName, "item", { id: finalId, name: displayName, ...(colorHint && { colorHint }) });
        if (itemResult.clarification) return itemResult.clarification;
        spec.items = [...(spec.items ?? []), itemResult.entity];
      }
    }
    const firstName = spec.items?.[0]?.name ?? spec.blocks?.[0]?.name;
    if (firstName && !containsPoison(firstName)) {
      (spec as { modName?: string }).modName = `${firstName.replace(/\s+Block$/i, "").trim()} Mod`;
    }
    return { type: "proceed", spec };
  }

  const noBlocks = entityExtraction.noBlocks;
  const noRecipes = entityExtraction.noRecipes;
  const effectiveBlock = isBlock && !noBlocks;

  if (effectiveBlock) {
    const blockResult = attachTextureProfile(displayName || "Block", "block", {
      id: finalBlockId,
      name: displayName || "Block",
      ...(colorHint && { colorHint }),
    });
    if (blockResult.clarification) return blockResult.clarification;
    spec.blocks = [blockResult.entity];
    if (craftCount > 0) {
      const itemName = displayName.replace(/\s+Block$/i, "").trim() || displayName || "Item";
      const itemResult = attachTextureProfile(itemName, "item", {
        id: finalBaseId,
        name: itemName,
        ...(colorHint && { colorHint }),
      });
      if (itemResult.clarification) return itemResult.clarification;
      spec.items = [itemResult.entity];
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
      const meltedName = "Melted " + (displayName.replace(/\s+Block$/i, "").trim() || displayName);
      if (!spec.items?.some((i) => i.id === finalMeltedId)) {
        const meltedResult = attachTextureProfile(meltedName, "processed", {
          id: finalMeltedId,
          name: meltedName,
          ...(colorHint && { colorHint }),
        });
        if (meltedResult.clarification) return meltedResult.clarification;
        spec.items = [...(spec.items ?? []), meltedResult.entity];
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
      spec.smelting = [...(spec.smelting ?? []), { input: "block", sourceId: finalBlockId, resultId: finalMeltedId }];
    }
  } else {
    const itemResult = attachTextureProfile(displayName || "Item", "item", {
      id: finalBaseId,
      name: displayName || "Item",
      ...(colorHint && { colorHint }),
    });
    if (itemResult.clarification) return itemResult.clarification;
    spec.items = [itemResult.entity];
    if (!noRecipes && wantsSmelt) {
      const meltedId = ("melted_" + finalBaseId).slice(0, MAX_ID_LEN);
      const finalMeltedId = /^[a-z][a-z0-9_]*$/.test(meltedId) ? meltedId : "melted_" + finalBaseId.slice(0, MAX_ID_LEN - 7);
      const meltedResult = attachTextureProfile("Melted " + (displayName || "Item"), "processed", {
        id: finalMeltedId,
        name: "Melted " + (displayName || "Item"),
        ...(colorHint && { colorHint }),
      });
      if (meltedResult.clarification) return meltedResult.clarification;
      (spec.items ??= []).push(meltedResult.entity);
      spec.recipes = [
        {
          id: `${finalMeltedId}_from_item`,
          type: "smelting",
          ingredients: [{ id: finalBaseId, count: 1 }],
          result: { id: finalMeltedId, count: 1 },
        },
      ];
      spec.decisions = [...(spec.decisions ?? []), { kind: "smelting_input_default", chosen: "item" }];
      spec.smelting = [...(spec.smelting ?? []), { input: "item", sourceId: finalBaseId, resultId: finalMeltedId }];
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
