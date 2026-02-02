import type { FastifyPluginAsync } from "fastify";
import { getPool, insertJob, updateJob } from "@themodgenerator/db";
import { validateSpec } from "@themodgenerator/validator";
import { planSpec } from "../services/planner.js";
import { triggerBuilderJob } from "../services/job-trigger.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getDbPool() {
  return getPool();
}

function parseBuildIdHeader(header: string | undefined): string | undefined {
  if (typeof header !== "string" || !header.trim()) return undefined;
  const s = header.trim();
  return UUID_REGEX.test(s) ? s : undefined;
}

export const generateRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { prompt: string; mode?: "test" | "real" } }>("/", async (req, reply) => {
    const prompt = req.body?.prompt;
    const mode = req.body?.mode ?? "test";
    const rawBuildId = req.headers["x-build-id"];
    const buildIdFromHeader = parseBuildIdHeader(Array.isArray(rawBuildId) ? rawBuildId[0] : rawBuildId);
    
    if (typeof prompt !== "string" || !prompt.trim()) {
      return reply.status(400).send({ error: "prompt is required and must be a non-empty string" });
    }
    
    if (mode !== "test" && mode !== "real") {
      return reply.status(400).send({ error: "mode must be 'test' or 'real'" });
    }
    
    const pool = getDbPool();
    
    const spec = planSpec(prompt);
    // Validation may annotate metadata but must not block job creation (no Tier 1 gating)
    try {
      validateSpec(spec, { prompt });
    } catch {
      // If Tier 1 or any gate fails/throws, proceed with spec; do not reject
    }
    
    const job = await insertJob(pool, {
      id: buildIdFromHeader,
      prompt,
      mode,
      status: "queued",
      spec_json: spec,
    });
    const buildId = job.id;
    
    try {
      console.log(`[GENERATE] buildId=${buildId} triggering builder mode=${mode}`);
      await triggerBuilderJob(job.id, mode);
      console.log(`[GENERATE] buildId=${buildId} builder triggered`);
      await updateJob(pool, job.id, { status: "building" });
      return reply.status(200).send({ jobId: job.id, status: "queued" });
    } catch (err) {
      console.error(`[GENERATE] buildId=${buildId} builder trigger failed:`, err);
      if (err instanceof Error) {
        console.error(`[GENERATE] buildId=${buildId} Error stack:`, err.stack);
      }
      await updateJob(pool, job.id, {
        status: "failed",
        rejection_reason: err instanceof Error ? err.message : "Failed to start builder",
      });
      return reply.status(502).send({
        error: "Builder could not be started",
        jobId: job.id,
      });
    }
  });
};
