# Backend deployment order

The backend is the single source of truth for prompt understanding, texture intelligence, behavior, world/crafting logic, and execution plan assembly. The frontend must never infer or invent any of this.

## Deployment order

1. **Build generator**
   ```bash
   cd packages/generator
   npm run build
   ```
   Ensure `dist/` contains: `interpretation/`, `texture/` (including rasterize, preview), `behavior/`, `world/`.

2. **Deploy API (e.g. GCP)**
   Build and deploy the API so it uses the built generator:
   ```bash
   cd apps/api
   npm run build
   # then deploy (e.g. gcloud run deploy, Docker, etc.)
   ```

3. **Verify route is live**
   ```bash
   curl -X POST http://localhost:PORT/interpretWithClarification \
     -H "Content-Type: application/json" \
     -d '{"prompt":"magic wand"}'
   ```
   Expected: either `{ type: "request_clarification", message, examples? }` or `{ type: "proceed", prompt }`. No transformation; result is verbatim from the generator.

## Generator invariants

- **interpretWithClarification**: Returns either `request_clarification` or `proceed`; never throws on user input.
- **Rasterization**: Deterministic for (plan + seed + size); never blocks generation (log + scaffold on failure).
- **Behavior + world**: Every item/block has at least one behavior and at least one acquisition path (recipe or loot).

## API route contract

- **POST /interpretWithClarification**
- Body: `{ prompt: string, seed?: string | number }`
- Returns: `ClarificationResponse` verbatim. No transformation, no swallowing errors.
