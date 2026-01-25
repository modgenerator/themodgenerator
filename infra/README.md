# GCP + CI/CD Setup — Click-by-Click & Scripts

Use **Workload Identity Federation (OIDC)** so GitHub Actions can deploy without storing JSON keys.

---

## 1. Enable APIs

**Console:** [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Library.

Enable:

- **Cloud Run Admin API** (`run.googleapis.com`)
- **Artifact Registry API** (`artifactregistry.googleapis.com`)
- **Cloud Build API** (`cloudbuild.googleapis.com`) — for `gcloud builds submit` if used
- **Storage API** / **Cloud Storage** — already on for most projects
- **Secret Manager API** (`secretmanager.googleapis.com`)
- **IAM Credentials API** (`iamcredentials.googleapis.com`) — for WIF token exchange

**CLI (replace `PROJECT_ID`):**

```bash
export PROJECT_ID=your-gcp-project-id
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com storage.googleapis.com secretmanager.googleapis.com \
  iamcredentials.googleapis.com --project="$PROJECT_ID"
```

---

## 2. Artifact Registry

**Console:** Artifact Registry → Create repository.

- **Name:** `themodgenerator` (or `modgen`)
- **Format:** Docker
- **Mode:** Standard
- **Location type:** Region → e.g. `us-central1`

**CLI:**

```bash
gcloud artifacts repositories create themodgenerator \
  --repository-format=docker --location=us-central1 --project="$PROJECT_ID"
```

Image names will be:

- `us-central1-docker.pkg.dev/PROJECT_ID/themodgenerator/api:latest`
- `us-central1-docker.pkg.dev/PROJECT_ID/themodgenerator/builder:latest`

---

## 3. GCS Bucket

**Console:** Cloud Storage → Create bucket.

- **Name:** e.g. `PROJECT_ID-modgen-artifacts` (globally unique)
- **Location:** same region as Run, e.g. `us-central1`
- **Access:** Uniform

**CLI:**

```bash
export BUCKET="${PROJECT_ID}-modgen-artifacts"
gsutil mb -l us-central1 "gs://${BUCKET}/"
```

Create folders (optional; objects can live at any path):

- `artifacts/` — built `.jar`s
- `logs/` — build logs

---

## 4. Secret Manager

**Console:** Security → Secret Manager → Create secret.

Create these secrets (values from Supabase / env):

1. **`database-url`**  
   - Value: Supabase Postgres connection string (e.g. `postgresql://...`).

2. **`builder-env`** (optional)  
   - If you store Builder env as one secret, use a JSON object; otherwise inject per deployment.

**CLI:**

```bash
echo -n "postgresql://user:pass@host:5432/dbname" | \
  gcloud secrets create database-url --data-file=- --project="$PROJECT_ID"
# Or update:
# gcloud secrets versions add database-url --data-file=- ...
```

**No secrets in git, no `NEXT_PUBLIC_*` secrets.**

---

## 5. Service accounts & IAM

### 5.1 Create service accounts

**Console:** IAM & Admin → Service Accounts → Create.

Create two:

- **`modgen-api@PROJECT_ID.iam.gserviceaccount.com`** — Cloud Run Service (API)
- **`modgen-builder@PROJECT_ID.iam.gserviceaccount.com`** — Cloud Run Job (Builder)

**CLI:**

```bash
gcloud iam service-accounts create modgen-api --display-name="ModGen API" --project="$PROJECT_ID"
gcloud iam service-accounts create modgen-builder --display-name="ModGen Builder" --project="$PROJECT_ID"
```

### 5.2 Roles

**API SA** needs:

- Run (as itself): `roles/run.invoker` not needed for serving; its identity is the Cloud Run service.
- Trigger Builder Job: **Cloud Run Admin** or custom role with `run.jobs.run`.
- DB: use **Secret Manager Secret Accessor** for `database-url`; app reads `DATABASE_URL` from that.
- GCS: **Storage Object Viewer** (or similar) only if you need signed URLs — for signing you need **iam.serviceAccounts.signBlob** or a key. Prefer: give API SA **Storage Object Viewer** on the bucket and use signed URLs (Cloud Run’s default SA can sign if the SA has `roles/iam.serviceAccountTokenCreator` on itself, or use a key in Secret Manager). Easiest: **Storage Admin** on the bucket for the API SA during setup, then narrow.

**Builder SA** needs:

- **Cloud SQL Client** if DB is Cloud SQL; for Supabase use connection string only → no Cloud SQL role.
- **Secret Manager Secret Accessor** for `database-url` (and optionally a “builder-env” secret).
- **Storage Object Creator** (or **Storage Admin**) on the artifact bucket so it can write jars and logs.

**Suggested role script (run from infra/ or project root):**

```bash
# infra/sa-roles.sh — run once, adjust PROJECT_ID and BUCKET
set -e
PROJECT_ID="${GCP_PROJECT_ID:?set GCP_PROJECT_ID}"
BUCKET="${GCS_BUCKET:?set GCS_BUCKET}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

API_SA="modgen-api@${PROJECT_ID}.iam.gserviceaccount.com"
BUILDER_SA="modgen-builder@${PROJECT_ID}.iam.gserviceaccount.com"

# API: allow triggering the Builder Job (Cloud Run Jobs run)
gcloud run jobs add-iam-policy-binding mod-builder \
  --region="$REGION" --member="serviceAccount:${API_SA}" --role="roles/run.invoker" --project="$PROJECT_ID"

# API: Secret Manager for DATABASE_URL
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:${API_SA}" --role="roles/secretmanager.secretAccessor" --project="$PROJECT_ID"

# API: GCS for signed URLs (read artifact + log objects)
gsutil iam ch "serviceAccount:${API_SA}:objectViewer" "gs://${BUCKET}"
# If you use signing with the default SA: grant the API SA token creator on itself (or use a key in SM).

# Builder: Secret Manager for DATABASE_URL
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:${BUILDER_SA}" --role="roles/secretmanager.secretAccessor" --project="$PROJECT_ID"

# Builder: GCS write
gsutil iam ch "serviceAccount:${BUILDER_SA}:objectAdmin" "gs://${BUCKET}"
```

---

## 6. Workload Identity Federation (WIF) for GitHub Actions

**No JSON keys in GitHub.** Use OIDC so GitHub’s IdP issues tokens that GCP accepts.

### 6.1 Create WIF pool and provider (Console)

1. **IAM & Admin** → **Workload identity federation** → **Add pool**.
2. **Pool ID:** `github-actions`.
3. **Provider:** Add provider → **OpenID Connect (OIDC)**.
   - **Provider ID:** `github`
   - **Issuer (URL):** `https://token.actions.githubusercontent.com`
   - **Audience:** default or a custom value, e.g. `https://github.com/YOUR_ORG` (must match what you request in the workflow).
4. **Attribute mapping** (add):
   - `google.subject` = `assertion.sub`
   - `attribute.actor` = `assertion.actor`
   - `attribute.repository` = `assertion.repository`
   - `attribute.repository_owner` = `assertion.repository_owner`
5. Save pool and provider.

### 6.2 WIF via CLI

```bash
# Create pool
gcloud iam workload-identity-pools create "github-actions" \
  --project="$PROJECT_ID" --location="global" --display-name="GitHub Actions"

# Create OIDC provider (use your org/repo in audience if you restrict)
gcloud iam workload-identity-pools providers create-oidc "github" \
  --project="$PROJECT_ID" --location="global" --workload-identity-pool="github-actions" \
  --display-name="GitHub" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

### 6.3 Allow GitHub to act as the deploy SA

Use a single SA that both pushes images and deploys Run (e.g. `modgen-deploy@PROJECT_ID.iam.gserviceaccount.com`), or reuse `modgen-api` for deploy. Example with a dedicated deploy SA:

**Console:** IAM → Grant access → principal  
`principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/attribute.repository/YOUR_ORG/themodgenerator`  
Roles: **Artifact Registry Writer**, **Cloud Run Admin**, **Service Account User** (to act as the Run service account), **Storage Admin** (or narrower) on the bucket, **Secret Manager Secret Accessor** if the workflow needs to read secrets.

**CLI (binding GitHub repo to a deploy SA):**

```bash
export REPO="YOUR_ORG/themodgenerator"   # e.g. mycompany/themodgenerator
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
export WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/providers/github"
export DEPLOY_SA="modgen-deploy@${PROJECT_ID}.iam.gserviceaccount.com"

# Create deploy SA
gcloud iam service-accounts create modgen-deploy --display-name="ModGen Deploy (GitHub)" --project="$PROJECT_ID"

# Grant roles to deploy SA
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role="roles/storage.admin"

# Allow GitHub repo to impersonate the deploy SA
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WIF_PROVIDER}/attribute.repository/${REPO}"
```

(If the WIF member format in your version of gcloud uses `identity-pools` path, use the path shown in the Console after creating the pool.)

---

## 7. Deploy Cloud Run Service (API)

**Console:**

1. Cloud Run → Create service.
2. **Deploy one revision from an existing container image** → select  
   `us-central1-docker.pkg.dev/PROJECT_ID/themodgenerator/api:latest`.
3. **Service name:** `modgen-api`.
4. **Region:** e.g. `us-central1`.
5. **Authentication:** Require authentication if you add IAM later; initially “Allow unauthenticated” is OK for testing.
6. **Container (Variables / Secrets):**
   - `DATABASE_URL` → reference Secret Manager `database-url:latest`.
   - `GCS_BUCKET` → literal: `PROJECT_ID-modgen-artifacts`.
   - `GOOGLE_CLOUD_PROJECT` / `GCP_PROJECT` → literal: `PROJECT_ID`.
   - `CLOUD_RUN_REGION` → `us-central1`.
   - `BUILDER_JOB_NAME` → `mod-builder`.
7. **Service account:** `modgen-api@PROJECT_ID.iam.gserviceaccount.com`.
8. Create.

**CLI (after image exists):**

```bash
# infra/deploy-api.sh
gcloud run deploy modgen-api \
  --image="us-central1-docker.pkg.dev/${PROJECT_ID}/themodgenerator/api:latest" \
  --region=us-central1 \
  --platform=managed \
  --set-env-vars="GCS_BUCKET=${BUCKET},GCP_PROJECT=${PROJECT_ID},CLOUD_RUN_REGION=us-central1,BUILDER_JOB_NAME=mod-builder" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --service-account="modgen-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --allow-unauthenticated \
  --project="$PROJECT_ID"
```

---

## 8. Deploy Cloud Run Job (Builder)

**Console:**

1. Cloud Run → Jobs → Create job.
2. **Name:** `mod-builder`.
3. **Region:** same as API.
4. **Container image:** `us-central1-docker.pkg.dev/PROJECT_ID/themodgenerator/builder:latest`.
5. **Task timeout:** e.g. 30 minutes.
6. **Environment variables:**  
   - `JOB_ID` — provided at run time by the API (overrides).  
   - `DATABASE_URL` — from Secret Manager `database-url:latest`.  
   - `GCS_BUCKET` — literal.
7. **Service account:** `modgen-builder@PROJECT_ID.iam.gserviceaccount.com`.
8. Create job.

**CLI:**

```bash
gcloud run jobs create mod-builder \
  --image="us-central1-docker.pkg.dev/${PROJECT_ID}/themodgenerator/builder:latest" \
  --region=us-central1 \
  --set-env-vars="GCS_BUCKET=${BUCKET}" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --service-account="modgen-builder@${PROJECT_ID}.iam.gserviceaccount.com" \
  --task-timeout=30m \
  --max-retries=0 \
  --project="$PROJECT_ID"
```

Update after image changes:

```bash
gcloud run jobs update mod-builder \
  --image="us-central1-docker.pkg.dev/${PROJECT_ID}/themodgenerator/builder:latest" \
  --region=us-central1 --project="$PROJECT_ID"
```

---

## 9. Observability

- **Cloud Logging:** Default for Cloud Run; ensure Run’s service account has **Logs Writer** (usually automatic).
- **Error Reporting:** Enabled when logs use the right severity and format; no extra console steps.
- **Metrics:** Cloud Run metrics (request count, latency) are in the Run UI and in Monitoring.

---

## 10. GitHub Actions — Variables (no JSON keys)

In the GitHub repo (or org): **Settings → Secrets and variables → Actions**:

- **Variables** (repository or organization):
  - `GCP_PROJECT_ID` = your GCP project ID
  - `GCS_BUCKET` = artifact bucket name (e.g. `myproject-modgen-artifacts`)
  - `WIF_PROVIDER` = full WIF provider resource name, e.g.  
    `projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github`
  - `WIF_SERVICE_ACCOUNT` = SA that deploys (e.g. `modgen-deploy@PROJECT_ID.iam.gserviceaccount.com`)

Get the provider name:

```bash
gcloud iam workload-identity-pools providers describe github \
  --workload-identity-pool=github-actions --location=global --project="$PROJECT_ID" --format='value(name)'
```

Use **Variables** for non-secret values; keep DB URL and any keys only in GCP Secret Manager. No `NEXT_PUBLIC_*` secrets.

---

## 11. Summary checklist

- [ ] APIs enabled (Run, Artifact Registry, Build, Storage, Secret Manager, IAM Credentials)
- [ ] Artifact Registry repo `themodgenerator` (Docker) in chosen region
- [ ] GCS bucket for jars + logs
- [ ] Secrets: `database-url` (and optional builder-env)
- [ ] Service accounts: `modgen-api`, `modgen-builder`, (optional) `modgen-deploy`
- [ ] IAM: API can invoke Builder Job + read DB secret + sign/read GCS; Builder can read DB secret + write GCS
- [ ] WIF pool + OIDC provider for GitHub; GitHub repo bound to deploy SA
- [ ] Cloud Run Service `modgen-api` and Job `mod-builder` created/updated with correct env and secrets
- [ ] GitHub Actions variables set: `GCP_PROJECT_ID`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`
