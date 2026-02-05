/**
 * OpenAI-backed planner: userPrompt → PlanSpec (strict JSON, schema-validated).
 * Backend only. Uses OPENAI_API_KEY from env; never log the key.
 * Logs: model, token usage, jobId. Timeout + 1 retry.
 */

import type { PlanSpec } from "@themodgenerator/spec";

const MODEL = "gpt-5-mini";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

const PLANSPEC_SYSTEM = `You are a mod-design planner. Output ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "intent": "add_wood_type" | "add_ores" | "add_items" | "add_blocks" | string,
  "entities": {
    "ores": string[] (e.g. ["Tin","Silver"]),
    "woodTypes": string[] (e.g. ["Maple"]),
    "items": string[] (e.g. ["Ruby","Sapphire"]),
    "blocks": string[] (e.g. ["Marble Block"])
  },
  "impliedSystems": string[] (e.g. ["worldgen","smelting","recipes","tags"]),
  "constraints": { "noBlocks": boolean?, "noRecipes": boolean?, "mcVersion": string? },
  "defaultsApplied": string[],
  "followupQuestions": string[] (optional)
}
Rules: Infer intent and entities from the user prompt. If they say "wood type called Maple" set intent add_wood_type and entities.woodTypes ["Maple"]. If they say "no blocks" set constraints.noBlocks true. If they say "loads of ores like Tin and Silver" set intent add_ores, entities.ores ["Tin","Silver"], impliedSystems include "smelting" and "worldgen".`;

/** Exported for unit tests (planner output parsing). */
export function validatePlanSpec(raw: unknown): PlanSpec {
  if (raw == null || typeof raw !== "object") {
    throw new Error("PlanSpec must be an object");
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.intent !== "string") throw new Error("PlanSpec.intent must be a string");
  if (o.entities != null && typeof o.entities !== "object") throw new Error("PlanSpec.entities must be an object");
  if (!Array.isArray(o.impliedSystems)) throw new Error("PlanSpec.impliedSystems must be an array");
  if (o.constraints != null && typeof o.constraints !== "object") throw new Error("PlanSpec.constraints must be an object");
  if (o.defaultsApplied != null && !Array.isArray(o.defaultsApplied)) {
    throw new Error("PlanSpec.defaultsApplied must be an array");
  }

  const entities = (o.entities as Record<string, unknown>) ?? {};
  const constraints = (o.constraints as Record<string, unknown>) ?? {};
  return {
    intent: o.intent as string,
    entities: {
      ores: Array.isArray(entities.ores) ? (entities.ores as string[]) : undefined,
      woodTypes: Array.isArray(entities.woodTypes) ? (entities.woodTypes as string[]) : undefined,
      items: Array.isArray(entities.items) ? (entities.items as string[]) : undefined,
      blocks: Array.isArray(entities.blocks) ? (entities.blocks as string[]) : undefined,
    },
    impliedSystems: Array.isArray(o.impliedSystems) ? (o.impliedSystems as string[]) : [],
    constraints: {
      noBlocks: constraints.noBlocks === true,
      noRecipes: constraints.noRecipes === true,
      mcVersion: typeof constraints.mcVersion === "string" ? constraints.mcVersion : undefined,
    },
    defaultsApplied: Array.isArray(o.defaultsApplied) ? (o.defaultsApplied as string[]) : [],
    followupQuestions: Array.isArray(o.followupQuestions) ? (o.followupQuestions as string[]) : undefined,
  };
}

export interface PlanFromPromptResult {
  plan: PlanSpec;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/**
 * Call OpenAI to get PlanSpec from user prompt. One retry on failure. Timeout 30s.
 * Do NOT log OPENAI_API_KEY. Log model, usage, and jobId (caller passes jobId for logging).
 */
export async function planFromPrompt(
  userPrompt: string,
  options?: { jobId?: string }
): Promise<PlanFromPromptResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const jobId = options?.jobId ?? "unknown";
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await client.chat.completions.create(
        {
          model: MODEL,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: PLANSPEC_SYSTEM },
            { role: "user", content: userPrompt.trim().slice(0, 4000) },
          ],
          max_tokens: 1024,
        },
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      const content = response.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("OpenAI returned no content");
      }
      const raw = JSON.parse(content) as unknown;
      const plan = validatePlanSpec(raw);
      const usage = response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          }
        : undefined;
      console.log(
        `[PLANNER] jobId=${jobId} model=${MODEL} attempt=${attempt + 1} tokens=${usage?.total_tokens ?? "n/a"}`
      );
      return { plan, usage };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        console.warn(`[PLANNER] jobId=${jobId} attempt=${attempt + 1} failed, retrying:`, lastError.message);
      }
    }
  }
  console.error(`[PLANNER] jobId=${jobId} failed after ${MAX_RETRIES + 1} attempts:`, lastError?.message);
  throw lastError ?? new Error("Planner failed");
}
