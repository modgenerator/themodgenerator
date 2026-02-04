# Source of truth map — Spec → Generator → Validator → Builder → API → DB

Pipeline (no material-specific branches; all driven by Spec).

---

## 1. Spec creation

| Path | Responsibility |
|------|----------------|
| `packages/generator/src/interpretation/interpret-to-spec.ts` | Prompt → `ModSpecV1`: items[], blocks[], recipes[], smelting[], decisions[], blockFamilies[]. Infers textureProfile (materialHint from displayName; traits from generic keywords). |
| `packages/generator/src/interpretation/texture-profile-inference.ts` | Infer TextureProfile (materialHint, physicalTraits, surfaceStyle) from displayName/familyType. |

**Output:** `ModSpecV1` with items, blocks, recipes (type + ingredients + result), optional smelting/decisions/blockFamilies, textureProfile on each texture-bearing entity.

---

## 2. Expansion / normalization

| Path | Responsibility |
|------|----------------|
| `packages/spec/src/expansion.ts` | `expandSpecTier1(spec)` → ItemSpec[], BlockSpec[], descriptors. No path/asset logic. |
| `packages/spec/src/modspec-v2-to-v1.ts` | `expandedModSpecV2ToV1(expanded)` → ModSpecV1 (items/blocks/recipes + textureProfile from name). |

**Output:** `ExpandedSpecTier1` (spec + items[] + blocks[] + descriptors).

---

## 3. Materialization (file tree only; no FS)

| Path | Responsibility |
|------|----------------|
| `packages/generator/src/materializer/asset-mapping.ts` | `assetKeysToFiles(expanded, assets)` → textures (item/block), models, blockstates, lang. Attaches textureProfile/texturePrompt. |
| `packages/generator/src/materializer/recipe-generator.ts` | `recipeDataFiles(expanded)` → `data/<modId>/recipes/*.json`. Crafting: result.item + count. Cooking: result string + top-level count. |
| `packages/generator/src/materializer/fabric-scaffold.ts` | `fabricScaffoldFiles(expanded)` → build.gradle, fabric.mod.json, ModMain.java with `Registry.register(Registries.ITEM/BLOCK, Identifier.of(MOD_ID, id), ...)`. |
| `packages/generator/src/materializer/behavior-generator.ts` | Custom item classes when ExecutionPlan requires (e.g. on_use). |
| `packages/generator/src/materializer/index.ts` | `materializeTier1` / `materializeTier1WithPlans`: scaffold + assetFiles + recipeFiles (+ behaviorFiles). |

**Output:** In-memory `MaterializedFile[]` (paths under `src/main/resources/` and project root). Recipe path: `src/main/resources/data/<modId>/recipes/<id>.json`. Mod ID in Java and recipes must match `expanded.spec.modId` (from fabric.mod.json).

---

## 4. Registration (Fabric)

| Path | Responsibility |
|------|----------------|
| `packages/generator/src/materializer/fabric-scaffold.ts` | Emits Java: `Identifier.of(MOD_ID, "<id>")` for each item and block. MOD_ID = spec.modId. So recipe references `<modId>:<id>` match registration. |

**Contract:** Every id in spec.items / spec.blocks is registered as `<modId>:<id>`. Recipes use the same modId.

---

## 5. Persistence (builder)

| Path | Responsibility |
|------|----------------|
| `apps/builder/src/index.ts` | Loads job.spec_json → validates → expandSpecTier1(specToUse) → materialize → writeMaterializedFiles(workDir) → validateGeneratedRecipeJsonFromFiles → … → Gradle → on success `updateJob(pool, JOB_ID, { ..., spec_json: specToUse })`. |

**Contract:** On succeeded job, `job.spec_json` is the exact spec used for materialization (items, blocks, recipes, smelting, decisions, blockFamilies).

---

## 6. API response

| Path | Responsibility |
|------|----------------|
| `apps/api/src/routes/jobs.ts` | GET /jobs/:id: if job.spec_json exists → out.instructions = { items, blocks, recipes }, out.counts = { items, blocks, recipes, families }, out.spec_json = job.spec_json. If !spec_json → empty instructions + zero counts. |

**Contract:** Frontend gets blocks and recipes from job.spec_json or job.instructions; counts always present.

---

## 7. Validators (fail-fast)

| Path | Responsibility |
|------|----------------|
| `packages/validator/src/validate-recipes.ts` | Spec-level: ingredients/result ids in spec; no self-loop; crafting has ingredients. |
| `packages/validator/src/validate-generated-recipe-json.ts` | Post-materialize: parsed recipe JSON → crafting result.item, cooking result string, refs in spec, no self-loop. |
| `packages/validator/src/validate-texture-profile.ts` | Every item/block has textureProfile (intent, materialHint, physicalTraits, surfaceStyle). |
| `apps/builder/src/validate-block-as-item-assets.ts` | Block has item model (parent block or layer0 texture). |
| Builder | validateNoDuplicateTextures, validateNoPerceptuallyIdenticalTextures. |

---

## Quick reference

- **Where items/blocks come from:** interpret-to-spec (from prompt) or modspec-v2-to-v1.
- **Where recipe JSON gets its modId:** expanded.spec.modId in recipe-generator; same modId in fabric-scaffold.
- **Where spec is persisted:** builder updateJob(..., spec_json: specToUse) on success.
- **Where frontend gets blocks/recipes:** GET /jobs/:id → spec_json and instructions (from spec_json).
