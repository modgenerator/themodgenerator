/**
 * Clarification gate: ask only when genuinely unclear or contradictory.
 * Underspecified prompts (e.g. "a magic item") must NOT block generation.
 * Messages: friendly, specific, never shame, offer examples. Never "error"/"invalid"/"unsupported".
 */

import type { PromptAnalysis, PromptIssue } from "./prompt-understanding.js";

export type ClarificationResponse =
  | { type: "request_clarification"; message: string; examples?: string[] }
  | { type: "proceed"; prompt: string };

const NONSENSE_MESSAGE =
  "I'm not quite sure what you meant there — could you rephrase or describe the item or block you have in mind?\nFor example: 'a glowing crystal', 'a strange magical food', or 'a mysterious block'.";

const NONSENSE_EXAMPLES = ["a glowing crystal", "a strange magical food", "a mysterious block"];

const CONTRADICTION_MESSAGE =
  "I noticed a few conflicting ideas (for example, hot and frozen at the same time). Which direction should I go — hot, cold, or something else?";

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
 */
export function clarificationGate(analysis: PromptAnalysis): ClarificationResponse {
  const { normalizedPrompt, confidence, issues } = analysis;

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
