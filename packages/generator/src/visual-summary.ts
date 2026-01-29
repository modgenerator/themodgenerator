/**
 * Visual Fidelity Pipeline — Phase 6.
 * Frontend contract: expose visualLevel, blueprintSummary, textureResolution, visualFeatures.
 * For backend response only; no UI built here. Deterministic.
 */

import type { VisualLevel } from "./visual-levels.js";
import { creditsToVisualLevel, getVisualLevelDefinition } from "./visual-levels.js";

export interface VisualSummaryForFrontend {
  visualLevel: VisualLevel;
  blueprintSummary: string;
  textureResolution: number;
  visualFeatures: string[];
}

/**
 * Build the visual summary for frontend display.
 * Same totalCredits + blueprintSummaries → same output.
 * Used by API when returning job details (e.g. GET /jobs/:id).
 */
export function getVisualSummaryForFrontend(
  totalCredits: number,
  options?: { blueprintSummaries?: string[] }
): VisualSummaryForFrontend {
  const visualLevel = creditsToVisualLevel(totalCredits);
  const def = getVisualLevelDefinition(visualLevel);
  const summaries = options?.blueprintSummaries ?? [];
  const blueprintSummary =
    summaries.length === 0
      ? `${visualLevel} (${def.textureResolution}px)`
      : summaries.length === 1
        ? summaries[0]
        : `${summaries[0]} + ${summaries.length - 1} more`;
  const visualFeatures: string[] = [];
  if (def.allowsEmissive) visualFeatures.push("emissive");
  if (def.allowsGlow) visualFeatures.push("glow");
  if (def.allowsLayeredOverlays) visualFeatures.push("layered");
  return {
    visualLevel,
    blueprintSummary,
    textureResolution: def.textureResolution,
    visualFeatures,
  };
}
