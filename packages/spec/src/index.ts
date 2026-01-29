export type {
  ModSpecV1,
  FeatureKey,
  ModItem,
  ModBlock,
  ModOre,
  ModRecipe,
  ModLoot,
  AssetRef,
  ConstraintsReport,
} from "./types.js";
export {
  SUPPORTED_MINECRAFT_VERSION,
  SUPPORTED_LOADER,
  createHelloWorldSpec,
} from "./types.js";

export type { Tier } from "./tier.js";
export {
  TIER_1,
  TIER_2,
  TIER_3,
  TIER_4,
  TIER_5,
  TIER_LABELS,
  MAX_TIER_ALLOWED,
  FEATURE_TIER,
  getTierForFeature,
  requireTierForFeature,
  isAllowedAtTier1,
} from "./tier.js";

export type { BaseSpec, ItemSpec, BlockSpec } from "./specs.js";
export {
  itemSpecFromModItem,
  blockSpecFromModBlock,
} from "./specs.js";

export type {
  HandheldItemDescriptor,
  CubeBlockDescriptor,
  VisualDescriptorTier1,
} from "./descriptor.js";
export {
  isHandheldItemDescriptor,
  isCubeBlockDescriptor,
} from "./descriptor.js";

export type { ExpandedSpecTier1 } from "./expansion.js";
export { expandSpecTier1 } from "./expansion.js";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
export const modSpecV1JsonSchema = JSON.parse(
  readFileSync(join(__dirname, "schema.json"), "utf8")
) as Record<string, unknown>;
