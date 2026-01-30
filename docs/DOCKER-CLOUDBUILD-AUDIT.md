# Docker & Cloud Build audit (facts from codebase)

## 1. Dockerfile locations

- **apps/api/Dockerfile**
- **apps/builder/Dockerfile**

No other Dockerfiles exist in the repo.

---

## 2. Why "COPY packages packages: file does not exist"

Both Dockerfiles contain:

- `COPY packages packages`
- `COPY apps apps`

These paths are **relative to the Docker build context**. The Dockerfiles assume the context is the **repo root** (see comments: "Build from repo root: docker build -f apps/api/Dockerfile ." and "Build from repo root: docker build -f apps/builder/Dockerfile .").

If the build context is **not** the repo root (e.g. Cloud Build trigger "Directory" or "Source" set to `apps/api`), then from that directory there is no `packages` folder (it lives at repo root). So Docker fails with: **COPY packages packages: file does not exist**.

**Conclusion:** Cloud Build is using a build context that does not include the repo root (e.g. `apps/api` or another subdirectory). The Dockerfile requires context = repo root.

---

## 3. Correct Docker build context for the API

- **Build context must be: repo root** (the directory that contains `package.json`, `packages/`, and `apps/`).

**What must be inside the context (from repo root):**

- `package.json`
- `package-lock.json`
- `packages/` (entire directory)
- `apps/` (entire directory)
- `tsconfig.base.json`

`certs/` is created in the Dockerfile with `RUN mkdir -p ./certs`; it does not need to exist in the context.

**Context must not be:** `apps/api` or any other subdirectory, because then `packages` and `apps` are not direct children of the context.

---

## 4. Changes made

**API Dockerfile**

- **apps/api/Dockerfile** was missing a build step for the generator workspace. The API depends on `@themodgenerator/generator` (see `apps/api/package.json`). The builder Dockerfile already runs `npm run build -w @themodgenerator/generator`; the API Dockerfile did not.
- **Change:** Added `npm run build -w @themodgenerator/generator` before `npm run build -w @themodgenerator/api` so the generator is built and the API image has a built generator.

**cloudbuild.yaml**

- There was no `cloudbuild.yaml` in the repo.
- **Added:** **cloudbuild.yaml** at **repo root** so Cloud Build has an explicit config. It runs `docker build -f apps/api/Dockerfile .` so the context is the repo root (`.`). This avoids "COPY packages packages: file does not exist" when Cloud Build runs from repo root.

---

## 5. Exact Cloud Build settings to use

| Setting | Value |
|--------|--------|
| **Dockerfile path** | `apps/api/Dockerfile` (relative to repo root) |
| **Build context path** | `.` (repo root) |
| **Correct docker build command** | `docker build -f apps/api/Dockerfile .` |

**From repo root:**

```bash
docker build -f apps/api/Dockerfile -t <image> .
```

**With gcloud (context = repo root):**

```bash
gcloud builds submit --config=cloudbuild.yaml .
```

If using a Cloud Build **trigger** in the GCP console:

- **Source:** repo (or branch) that contains the full monorepo.
- **Build configuration:** Cloud Build configuration file (e.g. `cloudbuild.yaml`).
- **Configuration file location:** `cloudbuild.yaml` at repo root.
- Do **not** set "Directory" to `apps/api`; leave it empty or `.` so the context is repo root. If "Directory" is set to `apps/api`, the build context becomes `apps/api` and `COPY packages packages` will fail.

---

## 6. Summary

| Item | Fact |
|------|------|
| Dockerfiles | `apps/api/Dockerfile`, `apps/builder/Dockerfile` |
| Cause of COPY failure | Build context is not repo root (e.g. context = `apps/api`) |
| Correct context | Repo root (`.`), so `packages/` and `apps/` exist in context |
| API Dockerfile fix | Add `npm run build -w @themodgenerator/generator` before building API |
| Cloud Build config | `cloudbuild.yaml` at repo root; context `.`; Dockerfile `apps/api/Dockerfile` |
