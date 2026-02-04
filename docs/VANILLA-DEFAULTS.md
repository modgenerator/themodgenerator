# Vanilla-clone default visuals

This document describes how the generator produces **non-red, usable** assets when the user does not provide custom textures. Default visuals copy appropriate vanilla Minecraft textures and model parents so that every item and block renders correctly without custom texture generation.

## Overview

1. **Classification** — Each entity (item or block) is classified into a **VisualKind** (e.g. INGOT, TOOL_SWORD, LOG, PLANKS) using id/name patterns only. No noun-specific hardcoding (e.g. no "tin", "ruby", "cheese").
2. **Resolution** — For entities without a user-provided texture, `resolveVanillaVisualDefaults()` returns a **vanilla template path** (e.g. `item/iron_ingot`, `block/oak_log`) and a **model parent** (e.g. `minecraft:item/generated`, `minecraft:block/cube_all`).
3. **Materialization** — The materializer attaches `copyFromVanillaPaths` to texture files in the in-memory file tree.
4. **Build-time copy** — The builder reads `VANILLA_ASSETS_SOURCE` and, when writing files, copies the actual PNG bytes from the chosen source instead of generating placeholders.

## Where it lives

- **Generator**
  - `packages/generator/src/materialization/vanilla-visual-defaults.ts` — `classifyEntityVisualKind()`, `resolveVanillaVisualDefaults()`, `VisualKind` enum, vanilla template map.
  - `packages/generator/src/materializer/asset-mapping.ts` — Uses the resolver for items and blocks; sets `copyFromVanillaPaths` and model parent on materialized files.
- **Builder**
  - `apps/builder/src/vanilla-asset-source.ts` — Resolves client jar path, reads from zip (yauzl) or from a bundled pack directory.
  - `apps/builder/src/index.ts` — `writeMaterializedFiles()` checks `VANILLA_ASSETS_SOURCE` when any file has `copyFromVanillaPaths`; copies vanilla texture buffers instead of generating PNGs.

## Sourcing vanilla assets

The builder supports two ways to obtain vanilla textures. You **must** set one when the spec produces entities that use vanilla defaults (e.g. wood family, ingots, tools).

### Config: `VANILLA_ASSETS_SOURCE`

Set to one of:

- **`client_jar`** — Read textures from the Minecraft client jar.
- **`bundled_pack`** — Read textures from an unpacked directory (e.g. a pinned vanilla assets pack).

Fail behaviour: if any materialized file has `copyFromVanillaPaths` and `VANILLA_ASSETS_SOURCE` is unset or not one of these two values, the builder exits with a clear error.

### Option 1: Client jar (`VANILLA_ASSETS_SOURCE=client_jar`)

- **Where:** The client jar is resolved from the standard Minecraft install:
  - **Windows:** `%APPDATA%\.minecraft\versions\<version>\<version>.jar`
  - **macOS/Linux:** `~/.minecraft/versions/<version>/<version>.jar`
- **Version:** Set `MC_VERSION` (e.g. `1.21.1`) to match the jar you want. Default is `1.21.1`.
- **Dependency:** The builder uses the **yauzl** package to read entries from the jar. It is listed in the builder’s dependencies.
- **Failure:** If the jar path does not exist, the builder throws with a message like:  
  `[VANILLA_ASSETS] Minecraft client jar not found. Set MC_VERSION (e.g. 1.21.1) and ensure the client is installed. Expected: <path>`

### Option 2: Bundled pack (`VANILLA_ASSETS_SOURCE=bundled_pack`)

- **Where:** A directory that contains the vanilla asset tree (e.g. `assets/minecraft/textures/...`).
- **Config:** Set **`VANILLA_ASSETS_PACK`** to the absolute or relative path of that directory. The builder then resolves paths like `<VANILLA_ASSETS_PACK>/assets/minecraft/textures/item/iron_ingot.png`.
- **Failure:** If `VANILLA_ASSETS_SOURCE=bundled_pack` and `VANILLA_ASSETS_PACK` is unset or empty, the builder throws. If a required file is missing under that directory, it throws when copying that file.

## VisualKind mapping (summary)

Classification uses entity id/name (and for blocks, `type: "block"`). Examples of vanilla template paths:

- **Items:** INGOT → `item/iron_ingot`, NUGGET → `item/iron_nugget`, GEM → `item/diamond`, TOOL_SWORD → `item/iron_sword`, ARMOR_HELMET → `item/iron_helmet`, BOAT → `item/oak_boat`, etc.
- **Blocks:** LOG → `block/oak_log`, PLANKS → `block/oak_planks`, STAIRS → `block/oak_stairs`, SLAB → `block/oak_slab`, FENCE → `block/oak_fence`, and so on.

Model parents: flat items use `minecraft:item/generated`, tools use `minecraft:item/handheld`; blocks use `minecraft:block/cube_all` (or other block parents as implemented). No noun-specific branches are used.

## Wood family expansion

When the spec includes `woodTypes` (e.g. `{ id: "maple", displayName: "Maple" }`), the **spec** package expands them into the full vanilla wood set (log, stripped_log, wood, stripped_wood, planks, stairs, slab, fence, fence_gate, door, trapdoor, button, pressure_plate, sign, hanging_sign, boat, chest_boat). Those entities get vanilla-clone defaults (oak-based template paths). Wood **recipes** (log→planks, planks→stairs/slab/…/boat/chest_boat) are also added to the spec and emitted as recipe JSON. Default visuals and recipes keep everything non-red and craftable without custom textures.

## Tests

- **Default visuals:** `packages/generator/src/materialization/vanilla-visual-defaults.test.ts` — ingot → `copyFromVanillaPaths` includes `iron_ingot` and model parent `minecraft:item/generated`; sword → handheld + `iron_sword`; armor helmet → `iron_helmet`; block log → `oak_log` and cube_all.
- **Wood expansion:** `packages/spec/src/expansion.test.ts` — woodTypes expand to full item/block set and to vanilla-style recipes; `packages/generator/src/materializer/materializer.test.ts` — wood type Maple yields all expected maple_* ids and each texture file has `copyFromVanillaPaths` (non-red).

## Summary

- **No texture generation in this step** — only copying vanilla assets.
- **VANILLA_ASSETS_SOURCE** must be `client_jar` or `bundled_pack` when any output uses vanilla defaults; the builder fails loudly otherwise.
- **Client jar:** requires a local Minecraft install and `MC_VERSION`; uses yauzl to read from the jar.
- **Bundled pack:** requires `VANILLA_ASSETS_PACK` pointing at an unpacked vanilla asset tree.
