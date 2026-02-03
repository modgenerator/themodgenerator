# Clarification state machine (no infinite loop)

## Requirement

- Clarification answer MUST be persisted in the DB tied to the same jobId.
- Resolved prompt = `originalPrompt + "\n\nClarification Answer: " + clarification_answer` is used when re-running interpret.
- Each job may ask clarification **at most once**. After that: proceed with safe defaults or fail with a clear error (no re-asking).

## DB state

- `clarification_status`: `'none' | 'asked' | 'answered' | 'skipped'`
- `clarification_question`: string | null (set when we ask)
- `clarification_answer`: string | null (set when user submits)
- `clarification_answered_at`: timestamp | null

## Transitions

| When | From | To | Action |
|------|------|----|--------|
| POST /jobs, no conflict | none | skipped | Proceed; set spec_json, trigger builder |
| POST /jobs, conflict (and status none/skipped) | none | asked | Persist clarification_question; return needsClarification; **do not** trigger builder |
| POST /jobs/:id/clarification (user submits answer) | asked | answered | Persist clarification_answer, clarification_answered_at; run interpret(resolvedPrompt); if still conflict → fail job; else set spec_json, trigger builder |

## Why the same jobId cannot ask twice

1. **Only POST /jobs** can return `needsClarification: true`. It does so only when the job was **just created** and interpret returns request_clarification. It then sets `clarification_status = 'asked'`.
2. **POST /jobs** does not accept an existing jobId; it always creates a new job. So for a given job, the only time we could return needsClarification is on the first request that created it.
3. **POST /jobs/:id/clarification** is the only way to continue after "asked". It **never** returns `needsClarification`. It either:
   - fails the job with `"Clarification did not resolve ambiguity. Please rephrase."`, or
   - proceeds (sets spec_json, triggers builder).
4. Once status is `answered` or `skipped`, there is no endpoint that will "ask again" for that job. GET /jobs/:id only returns state; the frontend uses clarificationStatus/clarificationQuestion to show the question and a form to submit the answer to POST /:id/clarification.

## Gating (fewer unnecessary asks)

- For **block-only** mods (prompt contains "block", "blocks", "ore"), **cosmetic** contradictions (hot vs cold, icy look, vibe, aesthetic) do **not** trigger a clarification ask: we proceed with the normalized prompt and prioritize functional instructions.

## Verification

1. **Repro**: Submit a prompt that used to loop (e.g. "hot frozen cheese"). First response must be `needsClarification: true` with one question. Submit answer via POST /jobs/:id/clarification. Response must be either success (builder triggered) or `success: false, error: "Clarification did not resolve ambiguity..."` — never a second identical clarification.
2. **Regression**: For a job with `clarification_status = 'answered'`, calling interpret again (e.g. from a different flow) must not change the fact that the API never returns needsClarification for that job — the API simply does not have an endpoint that returns needsClarification for an existing job; only POST /jobs (create) can, and only when status is still none.
3. **DB**: After submitting an answer, the job row must have `clarification_answer` and `clarification_answered_at` set, and `resolvedPrompt` (prompt + "\n\nClarification Answer: " + answer) is what is passed to interpret and planSpec.
