/**
 * Plane 3: Fabric materialization for Tier 1 only.
 * Consumes ExpandedSpecTier1 and AssetKey[]; optional ExecutionPlan[] for behavior.
 * No filesystem writes; no Gradle invocation. Deterministic.
 */

import type { ExpandedSpecTier1 } from "@themodgenerator/spec";
import type { AssetKey } from "../composer-stub.js";
import type { ExecutionPlan } from "../execution-plan.js";
import type { FabricMaterializerTier1, MaterializedFile } from "./types.js";
import { assetKeysToFiles } from "./asset-mapping.js";
import { fabricScaffoldFiles } from "./fabric-scaffold.js";
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
  const all = [...scaffold, ...assetFiles];
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
  const all = [...scaffold, ...assetFiles, ...behaviorFiles];
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
