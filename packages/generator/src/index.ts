export { fromSpec } from "./from-spec.js";
export { emitHelloWorld } from "./templates/hello-world.js";
export type { AssetKey } from "./composer-stub.js";
export { composeTier1Stub } from "./composer-stub.js";
export type { MaterializedFile, FabricMaterializerTier1 } from "./materializer/index.js";
export {
  materializeTier1,
  materializeTier1WithPlans,
  fabricMaterializerTier1,
  assetKeysToFiles,
  fabricScaffoldFiles,
} from "./materializer/index.js";
export type { Primitive, PrimitiveDefinition, PrimitiveSafety } from "./primitives.js";
export { PRIMITIVE_REGISTRY } from "./primitives.js";
export type {
  ItemPrimitive,
  BlockPrimitive,
  EffectPrimitive,
  PassiveEffectPrimitive,
  ItemCategory,
  ItemRarity,
  BlockMaterial,
  BlockShape,
  SemanticTag,
  PhysicalTraits,
  GameplayTraits,
  GameplayEffect,
  AestheticProfile,
  MaterialHint,
  TextureSource,
  AnimationSpec,
  AestheticTextureRecipe,
} from "./item-block-primitives.js";
export {
  defaultItemPrimitive,
  defaultBlockPrimitive,
  defaultPhysicalTraits,
  defaultAestheticProfile,
  deriveTextureRecipe,
} from "./item-block-primitives.js";
export type { InterpretedKind, InterpretedResult } from "./interpretation.js";
export { interpretItemOrBlock } from "./interpretation.js";
export type { UserIntent, ExecutionPlan } from "./execution-plan.js";
export { planFromIntent, calculateCredits, intentToSystems } from "./execution-plan.js";
export type { SystemUnit, SystemDefinition, PrimitiveId } from "./system-units.js";
export { SYSTEM_REGISTRY, primitivesFromSystems } from "./system-units.js";
export type { ExpectationContract } from "./expectation-contract.js";
export { buildExpectationContract } from "./expectation-contract.js";
export type { AggregatedExecutionPlan } from "./plan-aggregation.js";
export { aggregateExecutionPlans } from "./plan-aggregation.js";
export { buildAggregatedExpectationContract } from "./expectation-aggregation.js";
export type { SafetyDisclosure } from "./safety-disclosure.js";
export { buildSafetyDisclosure, NOTHING_IS_FAKE_DISCLOSURE } from "./safety-disclosure.js";
export type { Capability, ScopeCosting } from "./capability-vs-scope.js";
export type { ScopeUnit, ScopeCost } from "./scope-metrics.js";
export { SCOPE_COSTS, SCOPE_UNIT_LABELS } from "./scope-metrics.js";
export { expandIntentToScope, expandPromptToScope } from "./scope-expansion.js";
export type { CreditBudget, ScopeBudgetResult } from "./credit-calculator.js";
export {
  calculateCreditsFromScope,
  fitsWithinBudget,
  getScopeBudgetResult,
} from "./credit-calculator.js";
export type { VisualLevel, VisualLevelDefinition, TextureResolution } from "./visual-levels.js";
export {
  creditsToVisualLevel,
  getVisualLevelDefinition,
  VISUAL_LEVEL_DEFINITIONS,
} from "./visual-levels.js";
export type {
  VisualBlueprint,
  BaseShape,
  MaterialFinish,
  OverlayMotif,
  ResolveBlueprintInput,
} from "./visual-blueprints.js";
export { resolveVisualBlueprint } from "./visual-blueprints.js";
export type { TextureRecipe, TextureRecipeLayer, LayerType } from "./texture-recipe.js";
export { recipeFromBlueprint } from "./texture-recipe.js";
export type { TextureSourceKind, TextureSourceResult } from "./texture-sources.js";
export { selectTextureSource } from "./texture-sources.js";
export {
  synthesizeTexture,
  generateProceduralTexture,
  generatePaletteAndMotifs,
  applyStyleTransfer,
  TextureStyle,
} from "./texture/index.js";
export type {
  FinalTexturePlan,
  ProceduralTextureSpec,
  GeneratedPalette,
  StyledTextureSpec,
  PaletteLLMInput,
} from "./texture/index.js";
export type { VisualSummaryForFrontend } from "./visual-summary.js";
export { getVisualSummaryForFrontend } from "./visual-summary.js";
export type {
  CanonicalMaterial,
  ArchetypeId,
  ArchetypeDefinition,
  ArchetypeGuarantees,
  IntentSignals,
  BehaviorSemanticKey,
  BehaviorSemanticLabel,
} from "./canonical-interpretation.js";
export {
  getCanonicalMaterial,
  CANONICAL_MODEL_ITEM,
  CANONICAL_MODEL_BLOCK,
  ARCHETYPES,
  resolveArchetype,
  hasUserProvidedAsset,
  BEHAVIOR_SEMANTICS,
  BEHAVIOR_INTENT_TO_VANILLA,
} from "./canonical-interpretation.js";