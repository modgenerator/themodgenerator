# The Mod Generator — Production Architecture

## Proposed File Tree

```
themodgenerator/
├── package.json                 # monorepo root, workspaces
├── tsconfig.base.json
├── ARCHITECTURE.md              # this file
├── .gitignore
│
├── apps/
│   ├── api/                     # Cloud Run Service (HTTP)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── health.ts
│   │   │   │   └── jobs.ts
│   │   │   ├── services/
│   │   │   │   ├── planner.ts
│   │   │   │   └── job-trigger.ts
│   │   │   └── lib/
│   │   └── ...
│   │
│   └── builder/                 # Cloud Run Job (run-to-completion)
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       ├── src/
│       │   ├── index.ts         # CLI entry: load job, generate, build, upload
│       │   ├── load-job.ts
│       │   ├── generate.ts
│       │   ├── build.ts
│       │   └── upload.ts
│       └── templates/           # Fabric project templates
│           └── hello-world/
│
├── packages/
│   ├── spec/                    # ModSpecV1 types + JSON Schema
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── schema.json
│   │   └── ...
│   │
│   ├── validator/               # Validation gates
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── forbidden-mechanics.ts
│   │   │   ├── survival-integration.ts
│   │   │   ├── fabric-version.ts
│   │   │   ├── texture-gate.ts
│   │   │   └── spec-consistency.ts
│   │   └── ...
│   │
│   ├── generator/               # Deterministic generation from spec
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── from-spec.ts
│   │   │   └── templates/
│   │   │       └── hello-world.ts
│   │   └── ...
│   │
│   ├── db/                      # Supabase/Postgres client + migrations
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts
│   │   │   └── jobs.ts
│   │   ├── migrations/
│   │   │   └── 001_jobs.sql
│   │   └── scripts/
│   │       └── migrate.js
│   │   └── ...
│   │
│   └── gcp/                     # Storage + signed URLs
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── storage.ts
│       │   └── signing.ts
│       └── ...
│
├── infra/
│   ├── README.md                # Click-by-click GCP + WIF + deploy
│   ├── gcp-apis.sh
│   ├── sa-roles.sh
│   └── deploy-api.sh
│
└── .github/
    └── workflows/
        ├── api.yml              # Build/push API image, deploy Cloud Run Service
        └── builder.yml          # Build/push Builder image, update Cloud Run Job
```

## Hello-World Mod Template Strategy

- **Single source of truth**: `ModSpecV1` with `features` array. For milestone 1, a single feature `"hello-world"` produces a minimal Fabric mod.
- **Generator**: `packages/generator` has a `fromSpec(spec, outDir)` that:
  - Dispatches on `spec.features` (e.g. `hello-world` → `hello-world` template).
  - Hello-world template writes: `build.gradle`, `gradle.properties`, `fabric.mod.json`, `ExampleMod.java`, `modid.mixins.json`, plus `assets/modid/lang/en_us.json` and one item/block if desired. All paths and ids come from `spec.modId` / `spec.modName`.
- **No free-form LLM code**: only variable substitution and controlled file emission from templates. Swapping to ore/ingot/tools later = adding a new feature branch in the generator + new template files.
- **Texture gate**: hello-world uses Fabric’s default or embedded placeholder; “required textures” in spec can be empty. When we add custom items/blocks, the spec’s `assets.required` list drives the gate; missing or wrong resolution → fail the build.

## Pipeline (Canonical)

1. **Intent extraction** → structured feature request (later: LLM).
2. **Capability mapping** → supported primitives (for now: hello-world only).
3. **Generate Canonical Mod Spec** (ModSpecV1).
4. **Validation gates** (forbidden mechanics, survival, Fabric version, textures, spec consistency).
5. **Deterministic generation** from spec → project files.
6. **Compile** (Gradle) → **Package** → **Deliver** (GCS + signed URL).

## Expansion (User Happiness)

- Status transparency, iteration via `parent_id`, templates library, better logs (signed log URL), optional follow-up questions, rate limits and max build time/concurrency.
- Model routing: one planner model → ModSpecV1 now; later Planner / Texture-helper / Explainer without refactoring core pipeline.
