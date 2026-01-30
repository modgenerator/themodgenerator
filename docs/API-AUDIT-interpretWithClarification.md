# API Audit — POST /interpretWithClarification (404)

## A. Route existence

| Check | Result |
|-------|--------|
| Search for `/interpretWithClarification` | **No HTTP route** existed in the backend. |
| Search for `interpretWithClarification` | **Function only** in `packages/generator/src/interpretation/index.ts` (exported from `packages/generator/src/index.ts`). |
| Actual route path (before fix) | **None** — route was never implemented. |
| HTTP method | **POST** (as expected by frontend). |
| Router/handler file (before fix) | **None**. |

**Conclusion:** `interpretWithClarification` was a **library function** in the generator package, not an HTTP endpoint. The API app (`apps/api`) did not expose it.

---

## B. Server wiring

| Check | Result |
|-------|--------|
| Backend stack | **Fastify** (`apps/api/src/index.ts`). |
| Registered routes (before fix) | `healthRoutes` at `/`, `jobRoutes` at `/jobs`, `generateRoutes` at `/generate`. |
| Missing | **No route** for clarification; no `app.use(router)` or `app.register(..., { prefix: "..." })` for interpret/clarification. |
| Base path | No `/api` or `/v1` prefix; health at `/`, jobs at `/jobs`, generate at `/generate`. |

---

## C. Deployment parity

- Route was **absent in code**; not a deployment-only issue.
- Build: generator package exports `interpretWithClarification` in `dist/index.js` after `npm run build` in `packages/generator`.

---

## D. Path mismatch

| Backend (before fix) | Frontend call |
|----------------------|---------------|
| No route | `POST /interpretWithClarification` |

**Correct path the frontend should call (after fix):**

- **`POST /interpretWithClarification`**  
  No prefix. Same host/port as other API routes (e.g. `POST /generate`, `POST /jobs`).

**Body:** `{ "prompt": "string" }`  
**Response:** `ClarificationResponse` — either `{ type: "request_clarification", message, examples? }` or `{ type: "proceed", prompt }`.

---

## E. Runtime

- **Framework:** Fastify.
- **Entry:** `apps/api/src/index.ts` → `start()` → `app.register(healthRoutes, ...)`, `app.register(interpretRoutes, ...)`, `app.register(jobRoutes, ...)`, `app.register(generateRoutes, ...)`.
- **Port:** `process.env.PORT ?? 8080`.

---

## F. Output

| Item | Answer |
|------|--------|
| **Exact reason for 404** | The backend **never defined** an HTTP route for `interpretWithClarification`. Only the generator library exported the function; the API app did not expose it. |
| **Exact file + line to change** | **Added** (not changed): `apps/api/src/routes/interpret.ts` (new file) defining `POST "/interpretWithClarification"`. **Changed:** `apps/api/src/index.ts` — import `interpretRoutes` and add `await app.register(interpretRoutes, { prefix: "/" });`. |
| **Correct route path for frontend** | **`POST /interpretWithClarification`** (no prefix). |
| **Code vs deployment** | **Code issue** — the route did not exist; it was not a deployment or build exclusion. |

---

## Fix applied

1. **Created** `apps/api/src/routes/interpret.ts`:  
   - Registers `POST "/interpretWithClarification"`.  
   - Body: `{ prompt?: string }`.  
   - Calls `interpretWithClarification(input)` from `@themodgenerator/generator` and returns the result with status 200.

2. **Updated** `apps/api/src/index.ts`:  
   - Import `interpretRoutes` from `./routes/interpret.js`.  
   - Register with `await app.register(interpretRoutes, { prefix: "/" });`.

After rebuilding the generator (so `dist` exports the function) and the API, **POST /interpretWithClarification** is available and the frontend should call that path.
