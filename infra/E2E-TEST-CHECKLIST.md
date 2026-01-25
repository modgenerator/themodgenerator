# End-to-End Test Checklist

## Local

### Prerequisites

- Node 20+, npm (or pnpm)
- Supabase Postgres (or local Postgres) with migrations applied
- GCS bucket + creds (or emulator) if you run the full builder
- Java 21 + Gradle (for builder) or use Docker for builder

### 1. DB migrations

```bash
cd /path/to/themodgenerator
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
npm run db:migrate
```

### 2. Run API locally

```bash
export DATABASE_URL="postgresql://..."
export GCS_BUCKET="your-bucket"   # optional for GET /jobs/:id signed URLs
export GCP_PROJECT="your-project" # optional if not triggering Builder
npm run api:dev
```

- `GET http://localhost:8080/healthz` → `{ "ok": true }`
- `POST http://localhost:8080/jobs` with `{ "prompt": "hello world mod" }` → `{ "id": "..." }`.  
  If Cloud Run is not configured, trigger will fail; job is still created and may be `queued` or `failed`.

### 3. Run builder locally against a job

Create a job first (via API or DB). Then:

```bash
export JOB_ID="<uuid-from-post-jobs>"
export DATABASE_URL="postgresql://..."
export GCS_BUCKET="your-bucket"
npm run builder:dev
# or: npm run dev -w apps/builder
```

- Builder loads the job, generates the Fabric project, runs `gradle wrapper` + `./gradlew build`, uploads jar and log to GCS, updates the job to `succeeded` (or `failed` with reason).

### 4. Local full flow (create job → run builder → jar in bucket)

1. Apply migrations, start API, create job:  
   `POST /jobs` body `{ "prompt": "my mod" }` → note `id`.
2. Run builder with that `JOB_ID`, same `DATABASE_URL` and `GCS_BUCKET`.
3. Poll `GET /jobs/:id` until `status === "succeeded"`.
4. Check response has `downloadUrl` (signed URL for the jar).
5. Open `downloadUrl` in browser or `curl -O` → confirm a `.jar` is downloaded.
6. In GCS: `gsutil ls gs://BUCKET/artifacts/JOB_ID/` and `gsutil ls gs://BUCKET/logs/JOB_ID/` should show the jar and `build.log`.

---

## Cloud

### 5. POST /jobs → job status → download URL

1. Deploy API and Builder (via GitHub Actions or `infra/deploy-api.sh` + job update). Ensure env and secrets are set (e.g. `DATABASE_URL` from Secret Manager, `GCS_BUCKET`, `GCP_PROJECT`, `BUILDER_JOB_NAME=mod-builder`).
2. Call the production API (no auth if you used `--allow-unauthenticated`):
   - `POST https://SERVICE_URL/jobs` with `{ "prompt": "hello fabric mod" }` → `{ "id": "..." }`.
3. Poll `GET https://SERVICE_URL/jobs/:id` until `status` is `succeeded` or `failed`.
4. If `succeeded`: copy `downloadUrl`, open in browser or `curl -L -o mod.jar "URL"` → verify the file is a valid jar (e.g. `unzip -l mod.jar`).
5. If `failed`: confirm `rejection_reason` and (when present) `logUrl` work and show useful output.

### 6. Rejection path

- `POST /jobs` with a prompt that triggers forbidden mechanics (e.g. “add flight” or “double jump”) → job should be created with `status: "rejected"` and `rejection_reason` set.  
  (Requires planner/validator to map that prompt to a rejected spec or to reject on prompt text.)

### 7. Health

- `GET https://SERVICE_URL/healthz` → `{ "ok": true }` (for Cloud Run health checks).

---

## Checklist summary

| # | Item |
|---|------|
| L1 | Migrations apply cleanly |
| L2 | API healthz returns 200 + `{ "ok": true }` |
| L3 | POST /jobs returns `{ "id }` and job exists in DB |
| L4 | Builder runs locally with JOB_ID, DATABASE_URL, GCS_BUCKET |
| L5 | After builder, job is succeeded, jar appears in GCS under `artifacts/JOB_ID/` |
| L6 | GET /jobs/:id returns downloadUrl when succeeded; URL delivers jar |
| C1 | Cloud POST /jobs → job created and Builder Job runs (status moves to building then succeeded/failed) |
| C2 | Cloud GET /jobs/:id returns downloadUrl when succeeded; download works |
| C3 | Cloud GET /healthz returns 200 |
