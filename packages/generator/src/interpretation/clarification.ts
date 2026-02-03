/**
 * Clarification gate: ask only when genuinely unclear or contradictory.
 * Underspecified prompts (e.g. "a magic item") must NOT block generation.
 * Gating: for block-only mods, do not ask for cosmetic ambiguity (hot vs cold vibe).
 * Messages: friendly, specific, never shame, offer examples. Never "error"/"invalid"/"unsupported".
 */

import type { PromptAnalysis, PromptIssue } from "./prompt-understanding.js";

export type ClarificationResponse =
  | { type: "request_clarification"; message: string; examples?: string[] }
  | { type: "proceed"; prompt: string };

export type ClarificationGateOptions = {
  /** When true, do not ask for cosmetic-only contradiction (hot/cold, icy look). */
  blockOnly?: boolean;
};

const NONSENSE_MESSAGE =
  "I'm not quite sure what you meant there — could you rephrase or describe the item or block you have in mind?\nFor example: 'a glowing crystal', 'a strange magical food', or 'a mysterious block'.";

const NONSENSE_EXAMPLES = ["a glowing crystal", "a strange magical food", "a mysterious block"];

const CONTRADICTION_MESSAGE =
  "I noticed a few conflicting ideas (for example, hot and frozen at the same time). Which direction should I go — hot, cold, or something else?";

/** Cosmetic contradiction keywords: hot/cold, icy, vibe, aesthetic — do not ask for block-only. */
const COSMETIC_CONTRADICTION_HINTS = /(\bhot\b|\bcold\b|\bfrozen\b|\bice\b|\bicy\b|\bfire\b|\bflame\b|\bsnow\b|\bfrost\b|\bvibe\b|\baesthetic\b|\blook\b)/i;

/** True when the only issue is contradiction and it's purely cosmetic (hot vs cold, look, vibe). */
export function isCosmeticContradiction(issues: PromptIssue[]): boolean {
  if (issues.length !== 1 || issues[0].type !== "contradiction") return false;
  const details = (issues[0] as { type: "contradiction"; details: string[] }).details.join(" ");
  return COSMETIC_CONTRADICTION_HINTS.test(details);
}

/** Build friendly clarification message from issues. Never "error", "invalid", or "unsupported". */
function buildClarificationMessage(issues: PromptIssue[]): { message: string; examples?: string[] } {
  const hasNonsense = issues.some((i) => i.type === "nonsense");
  const hasContradiction = issues.some((i) => i.type === "contradiction");
  if (hasNonsense && !hasContradiction) {
    return { message: NONSENSE_MESSAGE, examples: NONSENSE_EXAMPLES };
  }
  if (hasContradiction) {
    return { message: CONTRADICTION_MESSAGE };
  }
  return { message: NONSENSE_MESSAGE, examples: NONSENSE_EXAMPLES };
}

/**
 * Clarification gate. ASK only when: confidence === "low" OR nonsense OR contradiction.
 * PROCEED when: confidence === "high" OR (confidence === "medium" AND issues only "underspecified").
 * Gating: if blockOnly and only issue is cosmetic contradiction, PROCEED (prioritize functional instructions).
 */
export function clarificationGate(
  analysis: PromptAnalysis,
  options?: ClarificationGateOptions
): ClarificationResponse {
  const { normalizedPrompt, confidence, issues } = analysis;

  // Gating: block-only + cosmetic contradiction only → proceed (no ask)
  if (options?.blockOnly && issues.length === 1 && issues[0].type === "contradiction" && isCosmeticContradiction(issues)) {
    return { type: "proceed", prompt: normalizedPrompt };
  }

  // A) When to ASK
  if (confidence === "low") {
    const { message, examples } = buildClarificationMessage(issues);
    return { type: "request_clarification", message, examples };
  }
  if (issues.some((i) => i.type === "nonsense")) {
    const { message, examples } = buildClarificationMessage(issues);
    return { type: "request_clarification", message, examples };
  }
  if (issues.some((i) => i.type === "contradiction")) {
    const { message } = buildClarificationMessage(issues);
    return { type: "request_clarification", message };
  }

  // B) When to PROCEED (high confidence, or medium with only underspecified)
  const onlyUnderspecified =
    issues.length === 0 || issues.every((i) => i.type === "underspecified");
  if (confidence === "high" || (confidence === "medium" && onlyUnderspecified)) {
    return { type: "proceed", prompt: normalizedPrompt };
  }

  // Default: proceed with normalized prompt (do not block creative/abstract)
  return { type: "proceed", prompt: normalizedPrompt };
}
