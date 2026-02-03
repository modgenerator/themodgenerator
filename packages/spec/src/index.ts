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

export type {
  ModSpecV2,
  ModSpecV2Material,
  ModSpecV2Block,
  ModSpecV2Item,
  ModSpecV2Recipe,
  ModSpecV2Worldgen,
  ModSpecV2Tag,
  MaterialCategory,
  PowerProfile,
  BlockKind,
  RecipeType,
} from "./modspec-v2.js";
export { MODSPEC_V2_VERSION, SUPPORTED_MINECRAFT_V2, SUPPORTED_FABRIC_V2, isModSpecV2 } from "./modspec-v2.js";
export type { ExpandedModSpecV2 } from "./rule-engine.js";
export { expandModSpecV2 } from "./rule-engine.js";
export { expandedModSpecV2ToV1 } from "./modspec-v2-to-v1.js";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
export const modSpecV1JsonSchema = JSON.parse(
  readFileSync(join(__dirname, "schema.json"), "utf8")
) as Record<string, unknown>;
export const modSpecV2JsonSchema = JSON.parse(
  readFileSync(join(__dirname, "modspec-v2-schema.json"), "utf8")
) as Record<string, unknown>;
