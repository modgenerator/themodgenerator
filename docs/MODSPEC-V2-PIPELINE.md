# ModSpec V2 deterministic pipeline (Stage A)

Pipeline: **User prompt → LLM produces ModSpec JSON → RuleEngine expands → Validator fails if violated → Compiler (existing materializer) → Builder → JAR.**

Stats (tool/armor) are **derived deterministically** from rarity + overrides (`deriveToolStats` / `deriveArmorStats`); the LLM must not invent them.

## Files added/changed

### New: ModSpec V2 schema and types
- **packages/spec/src/modspec-v2.ts** — TypeScript types: materials, blocks (textureSpec, miningSpec, dropsSpec), worldgen, items (kind, materialRef), recipes (type, inputs, result), tags.
- **packages/spec/src/modspec-v2-schema.json** — JSON Schema for ModSpecV2.
- **packages/spec/scripts/copy-schema.mjs** — Copies `modspec-v2-schema.json` to `dist/`.

### RuleEngine (deterministic expansion)
- **packages/spec/src/rule-engine.ts** — `expandModSpecV2(spec)`:
  - Ore material (e.g. ruby) → gem + raw item, ore block, storage block, smelting + blasting recipes, 9↔storage_block recipes, worldgen entry.
  - Food/cheese block → enforce `textureSpec.base = "food"`.

### Balance / rarity (no LLM-invented stats)
- **packages/generator/src/balance.ts**:
  - `computeRarityScore(worldgen)` — from veinsPerChunk, veinSize, vertical range, biome restriction.
  - `deriveToolStats(materialId, rarityScore, overrides)` — durability, miningSpeed, attackDamageBonus, enchantability, miningLevel (clamped).
  - `deriveArmorStats(materialId, rarityScore, overrides)` — durabilityMultiplier, protectionPoints[4], toughness, knockbackResistance.
  - Overrides: `powerProfile` (cosmetic | glass_cannon | tank | utility), `styleOverPower` (lower stats).

### Validator (fail job if violated)
- **packages/validator/src/validate-modspec-v2.ts** — `validateModSpecV2(expanded)`:
  - All refs exist (materialRef, dropsSpec.itemId, recipe result/inputs, worldgen.oreBlockId).
  - Recipe types: ores → smelting/blasting only (no smoking); smoker → food only; stonecutting → blocks only.
  - Tool/armor materialRef present (bounds enforced by balance layer).

### Adapter and builder
- **packages/spec/src/modspec-v2-to-v1.ts** — `expandedModSpecV2ToV1(expanded)` → ModSpecV1 for existing materializer.
- **apps/builder/src/index.ts** — If `isModSpecV2(spec_json)`: logPhase `spec_generated` → `expandModSpecV2` → `rules_expanded` → `validateModSpecV2` (exit 1 if invalid) → `validated` → convert to V1 → existing expandSpecTier1 + materialize → `compiled` → Gradle → `building_mod` → upload → `uploaded` → `completed`.
- **apps/api/src/routes/jobs.ts** — `phaseToProgress` extended with spec_generated, rules_expanded, validated, compiled, uploaded.

### Examples and tests
- **packages/spec/src/examples/ruby-ore-modspec-v2.ts** — One gem material "ruby"; RuleEngine adds items/blocks/recipes/worldgen.
- **packages/spec/src/examples/cheese-block-modspec-v2.ts** — Food block + cheese slice + recipe.
- **packages/spec/src/rule-engine.test.ts** — Ruby ore expansion, cheese block texture.
- **packages/generator/src/balance.test.ts** — Rarity score, tool/armor stats, styleOverPower.
- **packages/validator/src/validate-modspec-v2.test.ts** — Valid refs, missing result, missing worldgen block.

## Example ModSpec JSON

### Ruby ore (minimal; RuleEngine fills the rest)
```json
{
  "schemaVersion": 2,
  "namespace": "example",
  "modId": "rubyores",
  "modName": "Ruby Ores",
  "minecraftVersion": "1.21.1",
  "fabricVersion": "0.15",
  "materials": [
    { "id": "ruby", "category": "gem", "palette": ["red", "#c41e3a"], "powerProfile": "default" }
  ],
  "blocks": [], "worldgen": [], "items": [], "recipes": [], "tags": []
}
```

### Cheese block
```json
{
  "schemaVersion": 2,
  "namespace": "example",
  "modId": "cheesemod",
  "modName": "Cheese Mod",
  "minecraftVersion": "1.21.1",
  "fabricVersion": "0.15",
  "materials": [
    { "id": "cheese", "category": "food", "palette": ["yellow"], "powerProfile": "cosmetic", "styleOverPower": true }
  ],
  "blocks": [
    {
      "id": "cheese_block",
      "name": "Block of Cheese",
      "kind": "basic",
      "textureSpec": { "base": "food", "palette": ["yellow"] },
      "miningSpec": { "toolTag": "none", "requiredLevel": 0, "hardness": 0.5 },
      "dropsSpec": { "itemId": "cheese_block" },
      "materialRef": "cheese"
    }
  ],
  "items": [ { "id": "cheese_slice", "kind": "food", "materialRef": "cheese" } ],
  "recipes": [
    { "id": "cheese_block_from_slices", "type": "crafting_shapeless", "inputs": [{"id": "cheese_slice", "count": 1}, "...x9"], "result": { "id": "cheese_block", "count": 1 } }
  ],
  "worldgen": [], "tags": []
}
```

## Running tests

- `packages/spec`: `npm test` (expansion + rule-engine).
- `packages/generator`: `node --test dist/balance.test.js` (or full `npm test`).
- `packages/validator`: `npm test` (validate-tier1 + validate-modspec-v2).

## Stage B (later)

- Verification step (Fabric GameTest or runtime check): assert tool damage/protection = derived stats, recipes correct types, ore smelts in furnace/blast not smoker.
