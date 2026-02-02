# Full System Audit & Production Roadmap

**Purpose:** Evaluate Path A (generalized item/block system) vs Path B (narrow scope to production quality) and recommend how to evolve the mod generation pipeline into a real mod production engine.

---

## 1. Audit Findings

### 1.1 Prompt → Plan → Code Path

| Stage | Current state | Where meaning is lost |
|-------|----------------|------------------------|
| **Planner** (`apps/api/src/services/planner.ts`) | `planSpec(prompt)` **always** returns `createHelloWorldSpec(modId, modName)`. It uses the prompt only for mod name/id sanitization. | **All content meaning is lost here.** `spec.items`, `spec.blocks`, `spec.recipes`, `spec.loot` are never set. The user’s request (e.g. “magic wand that shoots lightning”) never becomes structured spec content. |
| **Spec** (`packages/spec`) | `ModSpecV1` has `items`, `blocks`, `ores`, `recipes`, `loot`. `expandSpecTier1(spec)` maps these to `ItemSpec`/`BlockSpec` and descriptors. | With current planner, `spec.items` and `spec.blocks` are always `undefined` → expanded has **zero** items and blocks. |
| **Execution plan** (API + builder) | `itemPlans` / `blockPlans` are built from `expanded.items` and `expanded.blocks` via `planFromIntent(...)`. Scope comes from `expandPromptToScope(prompt)` + per-item/block scope. | Plans are empty when spec has no items/blocks. Scope and credits can still be computed from prompt-only scope, but **no registered content** is generated. |
| **Materializer** (builder) | `materializeTier1(expanded, assets)` or `materializeTier1WithPlans(expanded, assets, itemPlans)`. Scaffold emits ModMain, registries, lang. | With empty `expanded.items`/`blocks`, the generated mod has **no item or block registrations** — only `LOGGER.info(modName + " initialized.")`. Behavior exists only for the single “lightning wand” template when a plan has `on_use` + `spawn_entity` + `raycast_target`. |

**Conclusion:** The critical break is **prompt → spec**. The rest of the pipeline (expansion, execution plan, scope, behavior, materialization) is built to support content, but the planner never fills that content. Fixing this is the first prerequisite for any path.

---

### 1.2 Generator Architecture

- **System units & primitives** (`system-units.ts`, `primitives.ts`): Extensible and deterministic. Adding a new system (e.g. `tool_durability`) means adding a `SystemUnit` and mapping to primitives; no file explosion.
- **Execution plan schema:** `ExecutionPlan` (primitives, systems, behaviorPlan, worldIntegration) is expressive enough for items/blocks with use, damage, effects, cooldowns. Gaps: no explicit “recipe” or “harvest level” in the plan today; those live in `WorldIntegrationPlan` and in spec types.
- **Behavior generation:**  
  - **Single hardcoded branch:** `planRequiresCustomItem(plan)` is true only when plan has `on_use` + `spawn_entity` + `raycast_target` → one Java template (`generateLightningWandItem`).  
  - **No composition:** Other combinations (e.g. status_effect only, area_effect only, projectile without lightning) do not yet produce custom Java. BehaviorPlan (interactionBehaviors, areaEffects, etc.) is data-only; only one code path is implemented.
- **Extensibility risk:** Adding “sword” or “bow” by cloning `behavior-generator.ts` with new templates would recreate enforcement-style branching. The right direction is: **plan primitives/systems → pick or compose behavior templates**, not “if wand then X, if sword then Y”.

**Conclusion:** The plan schema is extensible. The missing piece is **generic behavior emission**: map from plan (primitives + behaviorPlan) to one or more behavior templates (e.g. “on_use + raycast + spawn_entity”, “on_use + status_effect”) without per-item-type conditionals.

---

### 1.3 Recipe & Interaction Modeling

- **Recipe representation:**  
  - `ModSpecV1.recipes` and `WorldIntegrationPlan.recipes` (`RecipeSpec`: type, output, ingredients, pattern, cause) are generic.  
  - **Synthesis is not generic:** `synthesizeWorldIntegration` in `world-integration.ts` uses **hardcoded ingredient strings**: `["magical_catalyst", "rare_dust", "gem"]`, `["hazardous_ingredient", "base_material"]`, `["common_material_1", "common_material_2"]`. These are placeholders, not inferred from materials or semantics.
- **Crafting/smelting:** Types support `shaped`, `shapeless`, `smelting`, `special`. No logic infers “ore → ingot → block” or “logs → planks → sticks” from material names or tags. Validator’s `survival-integration` checks that ores have a recipe reference but does not generate recipes.
- **Safety:** Inferring recipes from natural language is risky (wrong materials, wrong counts). The right approach is: **semantic tags + material hints → deterministic recipe patterns** (e.g. “metal” → smelting from ore; “magical” → shapeless with N abstract “magic” inputs), with **no fixed material names** (no “ruby”, “planks”). Ingredients should be **inferred IDs** from the same spec (e.g. other items/blocks in the mod or well-defined vanilla/material categories).

**Conclusion:** Recipe modeling is structurally present but **violates “no hardcoded content”**. Replace fixed strings with **inferred ingredients** from spec + semantic tags (and later, material graphs). Do not add more literal examples (wood, ruby, planks).

---

### 1.4 Frontend Truthfulness

- **Job response** (GET `/jobs/:id`): Returns `status`, `artifactUrl`, `executionPlan`, `capabilitySummary`, `scopeSummary`, `totalCredits`, `fitsBudget`, `expectationContract`, `safetyDisclosure`.
- **Capabilities:** `deriveCapabilitiesFromPlan(allPlans, aggregatedPlan)` is **reflective only** (hasUseAction, dealsDamage, appliesEffects). Not used for validation. Good.
- **Credits:** From scope (prompt + expanded items/blocks), snapped to tiers 5 | 30 | 60 | 120 | 300. When spec has no items, scope is prompt-only; credits can still be high if the prompt implies entities/dimensions. So the frontend can show “30 credits” and “no behavior” when the actual mod has **no items/blocks** — truthful to the current spec but misleading if the user believes their prompt was “used”.
- **Risk:** If the planner is fixed to populate items/blocks, the same API contract remains correct; capabilitySummary and credits will then reflect real content. No frontend change required for truthfulness **once the backend is correct**.

**Conclusion:** Frontend is set up for truthfulness. The main issue is **backend correctness**: once prompt → spec and spec → plan are fixed, UI will show the right capabilities and credits.

---

### 1.5 Scalability Risks

- **Current design under more content types:**  
  - **More item types:** Today, only “lightning wand” gets custom Java. Adding tools, armor, consumables would require either (a) more `if (planHasX)` branches in behavior-generator (bad: enforcement-style), or (b) a **plan-driven behavior selector** that picks templates by primitives/systems (good).  
  - **Blocks with behavior:** Block entities, on-use blocks, etc. are not yet in the materializer; only simple block registration exists.  
  - **Recipes:** Proliferating hardcoded ingredient lists does not scale. Need a **material/recipe inference layer** that outputs concrete item IDs (from spec or vanilla) from semantics.
- **Enforcement vs semantics:** Enforcement has been removed (no wand-enforcement). Semantics today are regex-based in `intentToSystems` and `expandIntentToScope`. To support “unknown future prompts” without endless regex, the system needs either (1) a **structured semantic layer** (e.g. LLM or NLU → intent slots: category, material, actions, effects), or (2) a **conservative default** (e.g. “unknown item” → interaction + cooldown only) and gradual enrichment. Recommendation: keep regex as fallback; add a single **prompt → structured intent** step (e.g. “items”, “blocks”, “actions”) that can be swapped (rule-based now, model later) so that plan and scope stay semantic, not keyword-bound.

**Conclusion:** Scaling will break if we add per-type enforcement or more hardcoded recipes. Scaling holds if we add: (1) prompt → spec content, (2) plan-driven behavior composition, (3) semantic recipe inference without fixed material names.

---

## 2. Path Evaluation

### Path A — Expand Into a Generalized Item/Block System

- **Goal:** Support from any user input: items (tools, weapons, wands, consumables), blocks (decorative, functional, storage), ores/materials, crafting/smelting/transformations, interactions (right-click, damage, effects, tool behavior), texture/model generation, vanilla-compatible behavior (crafting table, furnace, tool tiers, harvest levels). All inferred; no hardcoded examples.
- **Verdict:** **Not feasible as the next step.**  
  - The pipeline does not yet produce **any** user-requested content (planner does not fill spec).  
  - Recipes use hardcoded ingredients; behavior has one template.  
  - Expanding “everything” before fixing prompt → spec and recipe/behavior generality would produce a broad but shallow and brittle system (more regex, more templates, same structural gaps).
- **When Path A makes sense:** After (1) prompt → spec is reliable, (2) at least one content slice (e.g. items + blocks) is correct end-to-end, and (3) recipe inference and behavior are plan-driven and generic.

---

### Path B — Perfect a Smaller Scope (e.g. Blocks-First) to Production Quality

- **Goal:** Narrow scope (e.g. blocks + materials only); achieve high quality (recipes, block states, drops, crafting/smelting, textures/models); then expand.
- **Verdict:** **Aligned with fixing the real bottleneck.**  
  - “Blocks + materials” (or “items + blocks” with simple behaviors) forces: (1) **planner that outputs at least items and blocks** from the prompt, (2) **recipe model** that can express “block ↔ item” and “ore → ingot” without literal “planks”/“ruby”, (3) **correct registration and data gen** (block states, loot, lang).  
  - Doing this well gives a **reusable pattern** for “spec content → plan → code” that can later be extended to tools, wands, entities.
- **Risk:** Over-narrowing (e.g. blocks only, no items) might underuse the existing execution plan and behavior stack. A slightly wider “items + blocks + one behavior family” (e.g. right-click use) keeps the architecture exercised.

---

### Hybrid (Recommended)

- **Recommendation:** **Hybrid: fix the core path first (prompt → spec → plan → code) on a bounded scope; make recipes and behavior generic and plan-driven; then expand content and systems.**  
  - **Why:**  
    1. **Correctness:** The system must actually generate what the user asked for. That requires the planner to populate the spec.  
    2. **Extensibility:** Recipe inference and behavior generation must be semantic/plan-driven from day one so that adding new content types does not require new enforcement files or hardcoded lists.  
    3. **Long-term richness:** A small but correct and generic slice (e.g. items + blocks + simple use behavior + inferred recipes) is a better foundation than a broad, content-empty or placeholder-heavy system.
- **What not to build yet:**  
  - Do not add: dimensions, worldgen, NPCs, quests, tool tiers, harvest levels, or multiple behavior templates until (1) prompt → spec works and (2) at least one behavior family is generated from plan composition.  
  - Do not add: more hardcoded ingredient lists or “example” materials (wood, ruby, planks).  
  - Do not add: per-item-type or per-block-type enforcement files.

---

## 3. Architectural Changes Required

1. **Planner (prompt → spec)**  
   - **Change:** From “always hello-world” to **populating `spec.items` and/or `spec.blocks`** (and optionally `spec.recipes`) from the prompt.  
   - **Constraint:** No hardcoded content examples. Use semantic extraction: e.g. “one magic wand” → one item with name/material/rarity derived from prompt; “glowing stone block” → one block. Can be rule-based first (e.g. “first noun phrase = item name”, “block” keyword → block), then replaceable by LLM/NLU later.  
   - **Output:** Same `ModSpecV1`; `items` and `blocks` arrays non-empty when the prompt describes content.

2. **Recipe inference (world-integration)**  
   - **Change:** Replace literal ingredient strings with **inferred ingredients**: e.g. from same spec (other items/blocks), or from a small set of **abstract material roles** (e.g. “primary_material”, “catalyst”) that are resolved to spec IDs or vanilla IDs by rule. No “magical_catalyst”, “common_material_1” in the final recipe payload; either real IDs or a single layer of indirection that the materializer can resolve.

3. **Behavior generation (plan-driven composition)**  
   - **Change:** Replace the single “lightning wand” branch with a **primitive/system → template selector**: e.g. (on_use + raycast + spawn_entity) → lightning template; (on_use + status_effect) → potion-effect template; (on_use + cooldown only) → generic use template. One place that decides “which Java to emit” from `ExecutionPlan` (primitives + behaviorPlan), not from item name or prompt keywords.

4. **Capabilities and credits (keep)**  
   - **No change:** Capabilities remain derived from the execution plan only; credits from scope; snap to tiers. No validation or rejection based on capabilities.

---

## 4. Phased Roadmap

### Phase 1 — Prompt → Spec & One Content Slice (Foundation)

- **1.1** Implement **prompt → spec content**: planner produces at least one item or one block (name, id, optional material) from the prompt. No hardcoded names; derive from prompt text (e.g. first meaningful phrase = name, sanitized to id).  
- **1.2** Ensure **expansion and builder** use this: `expandSpecTier1(spec)` gets non-empty items or blocks; builder runs `materializeTier1`/`materializeTier1WithPlans` with real content.  
- **1.3** Verify **end-to-end**: e.g. “a magic wand” → mod that registers one item, one texture path, one lang entry; optional custom behavior if plan has use + lightning.  
- **1.4** **Frontend:** No change; job response already returns executionPlan, capabilitySummary, credits. Ensure capabilitySummary reflects the new content.

**Exit criterion:** A prompt that describes a single item or block produces a mod that contains that item or block (registered, named, with placeholder or generated texture).

---

### Phase 2 — Generic Recipes & Plan-Driven Behavior

- **2.1** **Recipe inference:** Redesign `synthesizeWorldIntegration` so that ingredients are **inferred** from: (a) other items/blocks in the same spec, or (b) abstract roles (e.g. “primary”, “secondary”) mapped to spec IDs. Remove all literal strings like `"magical_catalyst"`, `"common_material_1"`. Emit `ModRecipe`/`RecipeSpec` with valid output and ingredient IDs (or a single indirection layer resolved at materialization).  
- **2.2** **Data gen:** Emit Fabric data-driven recipes (JSON) from `RecipeSpec` in the materializer so that the built mod has real crafting/smelting recipes.  
- **2.3** **Behavior composition:** Introduce a **behavior template selector** from `ExecutionPlan`: e.g. map (on_use + raycast + spawn_entity) → lightning template; (on_use + apply_status_effect) → effect template; (on_use + cooldown) → generic use. Add one or two more templates (no new enforcement files); selection is by primitives/systems only.  
- **2.4** Keep **one behavior family** (e.g. right-click use) working at high quality; defer tools/armor/entities.

**Exit criterion:** Mods with one or two items/blocks have correct recipe JSON and at least one non-placeholder behavior when the plan implies it; no hardcoded ingredient names.

---

### Phase 3 — Broader Content & Polish

- **3.1** Extend **planner** to support multiple items/blocks and optional ores when the prompt implies them; keep semantics rule-based or swap to LLM behind the same interface.  
- **3.2** Add **block state / loot / drops** where needed (e.g. ore drops, block loot table) from plan or spec.  
- **3.3** **Texture/model:** Ensure item vs block rendering (size, UVs) and asset paths are correct; no new hardcoded examples.  
- **3.4** Consider **tool tiers / harvest levels** only after blocks and items are stable; model as plan primitives or spec fields, not new enforcement.

**Exit criterion:** Multiple items/blocks from one prompt, with correct recipes and behaviors, and correct artifact delivery and frontend display.

---

## 5. Principles to Enforce Going Forward

1. **Plans drive behavior, never prompts.** All code generation (Java, JSON) is keyed by execution plan (primitives, systems, behaviorPlan) and spec. No branching on raw prompt text or item name for behavior selection.

2. **No hardcoded content examples.** No “ruby”, “planks”, “sticks”, “magical_catalyst”, “common_material_1” in code or generated data. Materials and ingredients are inferred from spec + semantic tags or from a small set of abstract roles resolved to spec/vanilla IDs.

3. **No per-item or per-block enforcement files.** No wand-enforcement, sword-enforcement, etc. Semantics (intentToSystems, scope-expansion, recipe cause) may use regex or rules; rejection and behavior selection must not.

4. **Prompt → spec is the single source of content.** The planner must produce at least items/blocks when the user describes content. Everything downstream (expansion, plan, scope, behavior, materialization) consumes spec + plan only.

5. **Capabilities and credits are reflective.** Derived from execution plan and scope only; used for UI and tiering only. Never used to block or reject builds.

6. **Recipe and behavior are generic and inferable.** Recipe inference and behavior template selection are based on semantics and plan, not on a fixed list of item types or ingredient names.

7. **Completed = JAR + artifactUrl.** Never return “completed” without a signed download URL. Never expose bucket names or gs:// to the client.

8. **Generator intelligence over validation logic.** Prefer enriching the plan and spec from semantics over adding validators that reject “insufficient” behavior. Fix gaps by improving the planner and behavior selector, not by blocking the user.

---

## 6. Summary Table

| Area | Current gap | Required change |
|------|-------------|-----------------|
| Planner | Never fills items/blocks | Prompt → at least one item or block (name, id, material); no hardcoded names |
| Spec/expansion | Works; fed empty today | No change; will work once planner fills spec |
| Execution plan | Expressive; built from empty spec | No change |
| Recipe synthesis | Hardcoded ingredients | Infer ingredients from spec/tags; emit real IDs or one indirection layer |
| Behavior gen | Single “lightning wand” template | Plan-driven template selector (primitives/systems → template) |
| Frontend | Correct contract | No change; ensure backend fills spec so capabilities/credits are truthful |
| Credits/capabilities | Plan/scope-driven | Keep as-is; reflective only |

**Recommended direction:** Hybrid — Phase 1 (prompt → spec + one content slice), then Phase 2 (generic recipes + plan-driven behavior), then Phase 3 (broader content and polish). Path A only after Phases 1–2 are solid. Path B is implemented as “Phase 1 + Phase 2 on items + blocks + one behavior family” rather than blocks-only.
