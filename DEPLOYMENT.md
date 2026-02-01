# API deployment (single path)

There is **exactly one** way the API is built and **exactly one** way it is deployed: Cloud Build using `cloudbuild.yaml` at the repo root. No Cloud Run “magic rebuilds”, no alternate triggers for production.

---

## How deployment works

1. **Build context** is always the **repo root** (the directory that contains `package.json`, `packages/`, and `apps/`).
2. **Build command** (inside Cloud Build):  
   `docker build -f apps/api/Dockerfile .`  
   The Dockerfile builds `@themodgenerator/spec`, then `@themodgenerator/db` / `validator` / `gcp`, then `@themodgenerator/generator`, then `@themodgenerator/api`.
3. **Image** is tagged with `$COMMIT_SHA` and pushed to `gcr.io/$PROJECT_ID/modgen-api:$COMMIT_SHA`.
4. **Deploy** is done by the same Cloud Build config: `gcloud run deploy` with explicit service name and region (see `cloudbuild.yaml`).

All of this is defined in **`cloudbuild.yaml`** at the repo root. Cloud Run is updated **only** via that file: `cloudbuild.yaml` → docker build → push → `gcloud run deploy`.

---

## How to redeploy safely

- **From GCP:** Use a **single** Cloud Build trigger that:
  - Uses **repo root** as source (do **not** set “Directory” to `apps/api`).
  - Uses config file: `cloudbuild.yaml` at repo root.
  - Sets substitution variables if needed: `_REGION`, `_GCS_BUCKET` (see `cloudbuild.yaml`).

- **From your machine (one-off):**
  ```bash
  # From repo root. Set _GCS_BUCKET and _REGION if you override defaults.
  gcloud builds submit --config=cloudbuild.yaml --substitutions=_GCS_BUCKET=YOUR_BUCKET .
  ```

Do **not** use the GitHub Actions API workflow (`.github/workflows/api.yml`) or `infra/deploy-api.sh` for normal production deploys; they are deprecated in favor of this single path.

---

## How to verify a new revision is live

1. **Revision and image digest**
   ```bash
   gcloud run revisions list --service=modgen-api --region=YOUR_REGION --format="table(name,status.conditions[0].status,spec.containers[0].image)"
   ```
   The top revision should show the new image with tag `$COMMIT_SHA` (or the digest that matches your last build).

2. **Traffic**
   ```bash
   gcloud run services describe modgen-api --region=YOUR_REGION --format="yaml(status.traffic)"
   ```
   Confirm 100% traffic is on the revision you expect.

3. **Health**
   ```bash
   curl -s https://YOUR_SERVICE_URL/healthz
   ```
   Expect `{"ok":true}` or similar.

---

## How to confirm a route exists (POST /interpretWithClarification)

```bash
curl -s -X POST https://YOUR_SERVICE_URL/interpretWithClarification \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a blue block"}' 
```

- **If the route exists:** You get a JSON body (e.g. `{"type":"proceed","prompt":"a blue block"}` or `{"type":"request_clarification",...}`).
- **If you get 404:** The running container does not have this route (stale image or wrong service).

---

## Verification checklist

Use this after a deploy to confirm the correct container is serving traffic.

| Check | How |
|-------|-----|
| **Container revision / image** | `gcloud run revisions list --service=modgen-api --region=YOUR_REGION --limit=1` — note `spec.containers[0].image`; the tag or digest should match the image you just built (e.g. `gcr.io/PROJECT_ID/modgen-api:COMMIT_SHA`). |
| **POST /interpretWithClarification exists** | `curl -s -X POST https://YOUR_SERVICE_URL/interpretWithClarification -H "Content-Type: application/json" -d '{"prompt":"test"}'` — must return 200 and JSON, not 404. |
| **Detect stale container** | If `/interpretWithClarification` returns 404 but `/healthz` returns 200, the live revision is running an image that was built before this route was added. Redeploy using **only** `cloudbuild.yaml` (trigger or `gcloud builds submit` from repo root) and ensure the trigger does **not** use a subdirectory (e.g. `apps/api`) as build context. |

---

## Why 404 kept happening (stale container)

- The Dockerfile expects **build context = repo root**. If the trigger (or any other build) used a **subdirectory** (e.g. `apps/api`) as context, `COPY packages packages` failed, so either the build failed or an older, previously working image was used.
- If a different path (e.g. GitHub Actions or a second trigger) built with a different context or an older commit, Cloud Run could have been updated to an image that did not include the latest code (e.g. no `POST /interpretWithClarification`).
- **Fix:** One build path (repo root + `docker build -f apps/api/Dockerfile .`) and one deploy path (`cloudbuild.yaml` → build → push → `gcloud run deploy`). No alternate triggers or workflows for production API deploy.

---

## Redundant / deprecated

- **`.github/workflows/api.yml`** — Second build/deploy path; deprecated. Use Cloud Build + `cloudbuild.yaml` only.
- **`infra/deploy-api.sh`** — Deploy-only script (no build). Deprecated for normal deploys; use only for one-off rollbacks when the image is already built and pushed.
- **Cloud Run “Build and deploy from source”** (or any UI “Connect repository” that builds from a subdirectory) — Do not use. Use a single Cloud Build trigger with `cloudbuild.yaml` at repo root.

All deployment behavior is defined in version-controlled files; the only place that builds and deploys the API is `cloudbuild.yaml`.
