/**
 * Interpretation layer: prompt understanding + clarification gate.
 * Flow: User Prompt → interpretWithClarification (analyze + gate)
 *   → if request_clarification → return (no generation yet)
 *   → if proceed → interpretItemOrBlock(response.prompt) → texture synthesis → execution plan
 *
 * If generation proceeds, ALL existing guarantees apply (no placeholder, no gray, deterministic).
 */

import type { ClarificationResponse } from "./clarification.js";
import { clarificationGate } from "./clarification.js";
import { analyzePromptIntent } from "./prompt-understanding.js";

export { analyzePromptIntent, type PromptAnalysis, type PromptIssue } from "./prompt-understanding.js";
export { clarificationGate, type ClarificationResponse } from "./clarification.js";

/** Single entry point: analyze + clarification gate. Caller proceeds with response.prompt if type === "proceed". */
export function interpretWithClarification(prompt: string): ClarificationResponse {
  return clarificationGate(analyzePromptIntent(prompt));
}
