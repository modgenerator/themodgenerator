/**
 * Plane 3: Fabric materialization for Tier 1 only.
 * Consumes ExpandedSpecTier1 and AssetKey[]; optional ExecutionPlan[] for behavior.
 * No filesystem writes; no Gradle invocation. Deterministic.
 *
 * MATERIALIZER RULE (VERY IMPORTANT)
 * Items and blocks must always produce:
 * - Registered Fabric item/block
 * - Correct textures folder
 * - Default JSON models
 * - Language entries
 * - Functional behaviors where defined
 * If behavior is undefined → safe default, never failure.
 * No "preview-only"; no fake logic.
 * If something is outside item/block scope: log it, scaffold it, do not block generation.
 *
 * TEXTURE INTELLIGENCE
 * FinalTexturePlan (from texture/synthesize) is AUTHORITATIVE for item/block visuals.
 * Never fall back to gray/default textures. If rasterization is not implemented:
 * log the plan, scaffold the asset, continue generation.
 * Generation must NEVER block due to rendering gaps.
 * This system generates texture intelligence even if rasterization is deferred.
 *
 * RASTERIZATION
 * Rasterization is deterministic, semantic-free, and never blocks generation.
 * If rasterization succeeds → embed textures. If rasterization fails → log + scaffold assets → DO NOT BLOCK.
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { AssetKey } from "../composer-stub.js";
import type { ExecutionPlan } from "../execution-plan.js";
import type { FabricMaterializerTier1, MaterializedFile } from "./types.js";
import { assetKeysToFiles } from "./asset-mapping.js";
import { fabricScaffoldFiles } from "./fabric-scaffold.js";
import { recipeDataFiles } from "./recipe-generator.js";
import { woodTagDataFiles } from "./wood-tags.js";
import { woodLootTableFiles } from "./wood-loot-tables.js";
import { behaviorFilesFromPlans } from "./behavior-generator.js";
import { enrichTextureFilesWithVisualMetadata } from "./visual-enrichment.js";
import { calculateCredits } from "../execution-plan.js";
import { creditsToVisualLevel } from "../visual-levels.js";

/**
 * Tier 1 Fabric materializer: expanded spec + asset keys → MaterializedFile[].
 * Stable ordering: scaffold first (sorted by path), then asset-derived files (sorted).
 * Existing Tier 1 path unchanged; no execution plans.
 */
export function materializeTier1(
  expanded: ExpandedSpecTier1,
  assets: AssetKey[]
): MaterializedFile[] {
  const scaffold = fabricScaffoldFiles(expanded);
  const assetFiles = assetKeysToFiles(expanded, assets);
  const recipeFiles = recipeDataFiles(expanded);
  const woodTags = woodTagDataFiles(expanded);
  const woodLoot = woodLootTableFiles(expanded);
  const all = [...scaffold, ...assetFiles, ...recipeFiles, ...woodTags, ...woodLoot];
  return all.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Materialize with execution plans: scaffold + assets + behavior Java (e.g. lightning wand).
 * Visual fidelity: compute visualLevel from totalCredits, resolve blueprint per item/block,
 * derive TextureRecipe, select texture source, attach visual metadata to texture files.
 * Paths, keys, and registry logic unchanged.
 */
export function materializeTier1WithPlans(
  expanded: ExpandedSpecTier1,
  assets: AssetKey[],
  itemPlans: ExecutionPlan[]
): MaterializedFile[] {
  const scaffold = fabricScaffoldFiles(expanded, { itemPlans });
  let assetFiles = assetKeysToFiles(expanded, assets);
  const totalCredits = itemPlans.reduce((sum, p) => sum + calculateCredits(p), 0);
  const visualLevel = creditsToVisualLevel(totalCredits);
  assetFiles = enrichTextureFilesWithVisualMetadata(assetFiles, expanded, visualLevel);
  const behaviorFiles = behaviorFilesFromPlans(expanded, itemPlans);
  const recipeFiles = recipeDataFiles(expanded);
  const woodTags = woodTagDataFiles(expanded);
  const woodLoot = woodLootTableFiles(expanded);
  const all = [...scaffold, ...assetFiles, ...behaviorFiles, ...recipeFiles, ...woodTags, ...woodLoot];
  return all.sort((a, b) => a.path.localeCompare(b.path));
}

export const fabricMaterializerTier1: FabricMaterializerTier1 = {
  materialize: materializeTier1,
};

export type { MaterializedFile, FabricMaterializerTier1 } from "./types.js";
export { assetKeysToFiles } from "./asset-mapping.js";
export { fabricScaffoldFiles } from "./fabric-scaffold.js";
export type { FabricScaffoldOptions } from "./fabric-scaffold.js";
export {
  behaviorFilesFromPlans,
  planRequiresCustomItem,
  getItemClassNameForRegistration,
} from "./behavior-generator.js";
export { recipeDataFiles } from "./recipe-generator.js";
export {
  validateNoMinecraftPlanksInRecipes,
  validateWoodBlocksHaveLootTables,
  validateWoodRecipeCoverage,
  validateLootTableJson,
  getWoodBlocksNeedingMultipartBlockstate,
} from "./validators.js";