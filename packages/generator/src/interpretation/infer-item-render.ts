/**
 * Infer item render intent from display name (generic keyword matching).
 * Used when creating ModItem so materializer can pick flat vs 3D model.
 * Default is chunky (3D) for normal physical items when uncertain; flat only when explicitly requested.
 */

import type { ItemRenderIntent } from "@themodgenerator/spec";

export function inferItemRender(displayName: string): ItemRenderIntent {
  const lower = displayName.toLowerCase();
  if (/\b(flat|2d|icon|sprite)\b/.test(lower)) return "flat";
  if (/\brod\b|\bingot\b|\bbolt\b|\bscrew\b|\bgear\b/.test(lower)) return "rod";
  if (/\bplate\b|\bslab\b|\bcoin\b|\bdisc\b/.test(lower)) return "plate";
  if (/\bchunk\b|\bgem\b|\bwedge\b|\bshard\b|\bcube\b|\bpebble\b|\bbead\b|\bcone\b|\bsphere\b/.test(lower)) return "chunky";
  if (/\bblock\s+item\b|item\s+form\s+of\s+block\b/.test(lower)) return "blocklike";
  return "chunky";
}
