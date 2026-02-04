# One repro job verification (no material hardcoding)

Use this prompt to verify the full pipeline: crafting, smelting, blocks, items, 3D rod, textures.

## Test prompt (copy-paste)

```
Add a mod with: a block called Stone Brick, craftable from 4 stone items in a 2x2 (shapeless),
and also craftable in a 3x3 (shaped) from 9 stone. Add a Metal Rod item (3D rod shape).
Add smelting: stone -> smooth stone item. Return blocks, items, shaped + shapeless + furnace recipes.
```

(Adjust if your interpreter expects different phrasing; the intent is: 1 block, multiple items including a rod, shapeless recipe, shaped recipe, smelting recipe.)

## Checklist after build

1. **MC can craft and smelt in-game**
   - Place recipe JSONs under `data/<modid>/recipes/`.
   - Crafting: result is `{ "item": "modid:id", "count": N }` (no `result.id`).
   - Cooking: result is string `"modid:id"`, count top-level.
   - Run the mod in Minecraft 1.21.1; open crafting table and furnace and confirm recipes appear and work.

2. **API GET /jobs/:id returns blocks + recipes**
   - After build succeeds, `job.spec_json` is persisted (builder).
   - GET `/jobs/:id` returns `instructions.blocks`, `instructions.recipes`, `counts.blocks`, `counts.recipes`.
   - Assert `counts.blocks > 0` and `counts.recipes > 0` for this job.

3. **3D-intent item has `elements`**
   - An item with `itemRender: "rod"` (e.g. Metal Rod) must have `models/item/<id>.json` containing an `"elements"` array.
   - Run materializer test: "item with itemRender rod produces item model JSON containing elements".

4. **Textures differ and show requested motif/materialClass**
   - `texture-manifest.json` in workDir includes `materialClassApplied` and `motifsApplied` per texture.
   - When a texture has `visualMotifs: ["holes"]`, manifest entry has `motifsApplied` including `"holes"`.
   - Processed (smelted) texture uses a different seed than source, so textures are not identical.

## Script

To assert API response after a successful job:

```bash
API_URL=http://localhost:3000 JOB_ID=<your-job-uuid> node scripts/assert-job-has-blocks-and-recipes.mjs
```

## Goals summary

| Goal | How verified |
|------|----------------|
| Crafting works (MC 1.21.1) | result.item in JSON; in-game crafting table |
| Smelting/cooking works | result string + count; furnace/smoker/campfire |
| UI has blocks + recipes | spec_json persisted; API returns instructions + counts |
| 3D items when required | itemRender rod/chunky/plate → model has elements |
| Texture motifs honored | manifest motifsApplied; materialClassApplied |
