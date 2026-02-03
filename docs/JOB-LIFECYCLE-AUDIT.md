# Job Lifecycle Audit — No JAR URL, No Progress Updates

## 1. Full lifecycle trace

| Step | Where | What happens |
|------|--------|--------------|
| **1. Prompt submission** | Frontend → `POST /jobs` or `POST /generate` | Body: `{ prompt }`. API calls `planSpec(prompt)`, `insertJob(..., status: "queued", spec_json)`, then `triggerBuilderJob(job.id, mode)`, then `updateJob(..., status: "building")`. Returns 200 with `jobId` and plan/scope (jobs) or `{ jobId, status: "queued" }` (generate). |
| **2. Job creation** | `apps/api/src/routes/jobs.ts` L54–59, `packages/db/src/jobs.ts` | `insertJob` creates row with `status: "queued"`, `spec_json`, no `artifact_path`. |
| **3. Worker invocation** | `apps/api/src/services/job-trigger.ts` L11–75 | `triggerBuilderJob(jobId, mode)` calls Cloud Run Jobs API with `JOB_ID` and `MODE` in container env. If GCP/project missing or API fails → throws → API catches, sets job `status: "failed"`, returns 502. |
| **4. Builder execution** | `apps/builder/src/index.ts` | Cloud Run runs builder container. Builder reads `JOB_ID`, `DATABASE_URL`, `GCS_BUCKET`; **mode** comes from `getExecutionMode()` which reads **`FORCE_TEST_MODE`** (L73–76), **not** the `MODE` env passed by the trigger. So the API’s `mode` is **ignored**. |
| **5. Progress updates** | `apps/builder/src/index.ts` L89–98, L296, L337 | `logPhase(pool, buildId, phase)` calls `updateJob(pool, buildId, { current_phase, phase_updated_at })`. Phases: `"world_interactions"`, `"behaviors"`, `"building_mod"`, `"completed"` / `"failed"`. |
| **6. Progress exposed to frontend** | `apps/api/src/routes/jobs.ts` GET `/:id` | Response shape (L152–166) **does not include** `current_phase` or `phase_updated_at`. So **progress is never returned** on the main job endpoint. Only `GET /debug/build/:buildId` (debug route) returns `currentPhase`. |
| **7. JAR creation** | `apps/builder/src/index.ts` L409–467 | **Only in build mode.** In **test mode** (L379–407) Gradle is skipped, no JAR is built, and L401–405 call `updateJob(..., { status: "succeeded", finished_at, log_path })` **without `artifact_path`**. So DB ends up with `status: "succeeded"`, `artifact_path: null`. |
| **8. Artifact upload** | `apps/builder/src/index.ts` L468–476 | In build mode, after Gradle: upload JAR to GCS, then `updateJob(..., { status: "succeeded", artifact_path: "gs://...", log_path })`. So artifact is only set when **not** in test mode. |
| **9. Artifact URL to frontend** | `apps/api/src/routes/jobs.ts` GET `/:id` L226–262 | If `job.status === "succeeded"`: if `!job.artifact_path` → override to `status: "failed"`, `error: "Artifact missing..."`, `artifactUrl: null`. Else parse gs path, call `getArtifactDownloadUrl(bucket, path, 900)`, set `out.artifactUrl` and keep `status: "completed"`. So **API never returns "completed" without an artifact URL** when it has artifact_path; it **does** return failed when artifact_path is null (e.g. test mode). |

---

## 2. Root cause (single sentence)

**The builder runs in test mode (because it uses `FORCE_TEST_MODE` and ignores the API’s `MODE`), so it never builds or uploads a JAR and marks the job `succeeded` without `artifact_path`; the API then correctly returns `failed` and no `artifactUrl`, while the main job endpoint never returns `current_phase`, so the frontend has no progress data.**

---

## 3. Why the UI says “success” without a JAR

- **If the UI shows “success”** while the backend returns no JAR, it is not because GET `/jobs/:id` returns `status: "completed"` with no URL: when `artifact_path` is null the API forces `status: "failed"` and sets an error (L229–234).
- So “success” in the UI is likely one of:
  1. **Treating job creation as success** — e.g. showing success on POST 200 (“job created” / “build started”) and not polling GET `/jobs/:id` for final status/artifactUrl.
  2. **Using a different API** — e.g. a Next.js route or another service that returns success when the job row exists, without checking `artifact_path` or GET response.
  3. **Stale or wrong status** — e.g. displaying a cached “completed” or a status from another job.

So the **backend** (this repo) does not report “completed” without a JAR when the job is polled via GET `/jobs/:id`; the mismatch is between that contract and what the frontend (or another service) shows.

---

## 4. Why progress % does not update

- **GET `/jobs/:id`** (`apps/api/src/routes/jobs.ts` L134–275) builds the response from `job` but **never adds `current_phase` or `phase_updated_at`** (or any progress field) to the response object.
- The builder **does** write progress: `logPhase()` → `updateJob(..., { current_phase, phase_updated_at })` (builder L89–98). So progress exists in the DB.
- **GET /debug/build/:buildId** (`apps/api/src/routes/debug.ts` L23–37) does return `currentPhase` and `lastUpdated`, but the main job endpoint does not.
- So if the frontend only polls GET `/jobs/:id`, it **never receives progress**; progress % cannot update without that data (or without polling the debug route and mapping phase to a percentage).

**Exact place:** `apps/api/src/routes/jobs.ts` — the `out` object (L152–166) and the rest of the handler do not include `current_phase` or any progress field.

---

## 5. Exact code changes

### a) Emit progress updates (expose phase on main job endpoint)

**File:** `apps/api/src/routes/jobs.ts`

- Add to the response type and to the object sent to the client:
  - `currentPhase?: string | null` (from `job.current_phase`)
  - `phaseUpdatedAt?: string | null` (from `job.phase_updated_at`, e.g. ISO string)

Example: after building `out` and before the artifact block (e.g. after L169), set:

```ts
out.currentPhase = job.current_phase ?? null;
out.phaseUpdatedAt = job.phase_updated_at != null
  ? (typeof job.phase_updated_at === 'string' ? job.phase_updated_at : (job.phase_updated_at as Date).toISOString())
  : null;
```

And add `currentPhase?: string | null; phaseUpdatedAt?: string | null;` to the `out` type (L152–166).

---

### b) Require artifact existence before marking success (builder)

**File:** `apps/builder/src/index.ts`

- **L401–405 (test mode):** Today test mode does `updateJob(..., { status: "succeeded", finished_at, log_path })` and does **not** set `artifact_path`. So the DB can have `status: "succeeded"` with no artifact. The API already turns that into `failed` + “Artifact missing” when returning the job, but the **source of truth** should not be “succeeded” without an artifact.
- **Change:** In test mode, either:
  - set `status: "failed"` and e.g. `rejection_reason: "Test mode: no artifact produced"`, and **do not** set `artifact_path`, or
  - leave status as a distinct value (e.g. keep “succeeded” only when artifact_path is set) and never set `status: "succeeded"` in test mode.

Recommended: in the test-mode block (L379–407), replace the `updateJob` that sets `status: "succeeded"` with one that sets `status: "failed"` and `rejection_reason: "Test mode: no JAR produced; run in build mode for download."` (and do not set `artifact_path`). That way the job is never “succeeded” in the DB without an artifact.

---

### c) Persist and return the JAR URL

- **Persist:** The builder **already** persists the JAR path when it runs in **build** mode: L474–481 set `artifact_path: \`gs://${GCS_BUCKET}/${artifactKey}\``. So persistence is correct when a JAR is actually built and uploaded.
- **Return:** The API **already** returns it as a signed URL when `job.artifact_path` is set: L247, `out.artifactUrl = await getArtifactDownloadUrl(...)`. So no change is needed for “persist and return” **provided** the builder runs in build mode and sets `artifact_path`.

To **guarantee** the API never reports “completed” without an artifact:

- Keep the existing GET `/jobs/:id` logic (L227–262) that treats “succeeded” with null `artifact_path` as failed and returns an error and no `artifactUrl`.
- Apply the builder change in (b) so the DB is never marked `succeeded` when there is no artifact.

---

## 6. Builder mode: use API’s MODE (optional but recommended)

**File:** `apps/builder/src/index.ts` L72–76

- Currently: `getExecutionMode()` uses only `process.env.FORCE_TEST_MODE`. The Cloud Run Job receives `MODE` from the API (job-trigger L42) but the builder ignores it.
- So if the builder image or Cloud Run job has `FORCE_TEST_MODE=1`, every run is test mode and no JAR is ever produced.
- **Change:** Prefer the env passed by the trigger, then fall back to FORCE_TEST_MODE, e.g.:

```ts
function getExecutionMode(): "build" | "test" {
  const fromApi = process.env.MODE;
  if (fromApi === "build" || fromApi === "test") return fromApi;
  const v = process.env.FORCE_TEST_MODE;
  return v === "1" || v === "true" ? "test" : "build";
}
```

That way the API’s choice of mode is respected unless overridden locally by FORCE_TEST_MODE.

---

## 7. Summary table

| Issue | Cause | File(s) and lines | Fix |
|-------|--------|-------------------|-----|
| No JAR URL | Builder in test mode sets `succeeded` without `artifact_path`; or builder never runs (trigger fails). | Builder L379–405 (test path); builder L73–76 (mode from FORCE_TEST_MODE only) | (b) Do not set `succeeded` in test mode; (optional) use MODE from API. |
| Progress % does not update | GET `/jobs/:id` does not return `current_phase` / `phase_updated_at`. | `apps/api/src/routes/jobs.ts` (response object, no current_phase) | (a) Add `currentPhase` and `phaseUpdatedAt` to GET `/jobs/:id` response. |
| “Success” without JAR in UI | Backend can return failed when artifact_path is null; UI may be showing success from POST or another API. | N/A backend; frontend or proxy | Ensure frontend polls GET `/jobs/:id` and treats only `status === "completed"` and presence of `artifactUrl` as success. |
| Artifact not persisted/returned | Only happens when builder runs in build mode and uploads; test mode never sets artifact_path. | Builder L474–481 (already correct in build path) | No change for persist/return; ensure builder runs in build mode and (b) so DB never has succeeded without artifact. |

---

## 8. Verification

- **Progress:** After (a), poll GET `/jobs/:id` and confirm `currentPhase` and `phaseUpdatedAt` change as the build runs.
- **Artifact required for success:** After (b), in test mode the job should end with `status: "failed"` and no `artifact_path`; GET `/jobs/:id` should return `status: "failed"` and no `artifactUrl`. In build mode, after a successful build, GET `/jobs/:id` should return `status: "completed"` and a non-null `artifactUrl`.
- **Mode from API:** After using MODE from the trigger, run a job without FORCE_TEST_MODE; builder should run in build mode, produce a JAR, and set `artifact_path`.
