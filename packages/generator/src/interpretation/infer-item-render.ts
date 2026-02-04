/**
 * Infer item render intent from display name (generic keyword matching).
 * Used when creating ModItem with intent "item" so materializer can pick flat vs 3D model.
 */

import type { ItemRenderIntent } from "@themodgenerator/spec";

export function inferItemRender(displayName: string): ItemRenderIntent {
  const lower = displayName.toLowerCase();
  if (/\brod\b|\bingot\b/.test(lower)) return "rod";
  if (/\bplate\b|\bslab\b/.test(lower)) return "plate";
  if (/\bchunk\b|\bgem\b/.test(lower)) return "chunky";
  if (/\bblock\s+item\b|item\s+form\s+of\s+block\b/.test(lower)) return "blocklike";
  return "flat";
}
