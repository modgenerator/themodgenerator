/**
 * Interpretation layer: prompt understanding + clarification gate + Spec output.
 * Flow: User Prompt → interpretToSpec (analyze + gate + build Spec)
 *   → if request_clarification → return (no generation yet)
 *   → if proceed → spec from interpreter → planner sanitizes → materializer compiles
 * Code must NEVER infer content meaning from prompt keywords; IDs from concepts/semantics only.
 */

import type { ClarificationResponse } from "./clarification.js";
import { clarificationGate } from "./clarification.js";
import { analyzePromptIntent } from "./prompt-understanding.js";

export { analyzePromptIntent, type PromptAnalysis, type PromptIssue } from "./prompt-understanding.js";
export { clarificationGate, isCosmeticContradiction, type ClarificationResponse, type ClarificationGateOptions } from "./clarification.js";
export { interpretToSpec, type InterpretToSpecResult } from "./interpret-to-spec.js";

/** Single entry point: analyze + clarification gate. Caller proceeds with response.prompt if type === "proceed". */
export function interpretWithClarification(
  prompt: string,
  options?: { blockOnly?: boolean }
): ClarificationResponse {
  return clarificationGate(analyzePromptIntent(prompt), options);
}
