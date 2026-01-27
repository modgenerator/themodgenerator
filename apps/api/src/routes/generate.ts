import type { FastifyPluginAsync } from "fastify";
import { getPool, insertJob, updateJob } from "@themodgenerator/db";
import { validateSpec } from "@themodgenerator/validator";
import { planSpec } from "../services/planner.js";
import { triggerBuilderJob } from "../services/job-trigger.js";

function getDbPool() {
  return getPool();
}

export const generateRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { prompt: string; mode?: "test" | "real" } }>("/", async (req, reply) => {
    const prompt = req.body?.prompt;
    const mode = req.body?.mode ?? "test";
    
    if (typeof prompt !== "string" || !prompt.trim()) {
      return reply.status(400).send({ error: "prompt is required and must be a non-empty string" });
    }
    
    if (mode !== "test" && mode !== "real") {
      return reply.status(400).send({ error: "mode must be 'test' or 'real'" });
    }
    
    const pool = getDbPool();
    
    // Plan the spec
    const spec = planSpec(prompt);
    
    // Validate the spec
    const validation = validateSpec(spec, { prompt });
    if (!validation.valid) {
      const job = await insertJob(pool, {
        prompt,
        mode,
        status: "rejected",
        rejection_reason: validation.reason ?? "Validation failed",
      });
      return reply.status(200).send({ jobId: job.id, status: "rejected", error: validation.reason });
    }
    
    // Create job and trigger builder
    const job = await insertJob(pool, {
      prompt,
      mode,
      status: "queued",
      spec_json: spec,
    });
    
    try {
      console.log(`[GENERATE] Triggering builder job for jobId=${job.id}, mode=${mode}`);
      await triggerBuilderJob(job.id, mode);
      console.log(`[GENERATE] Builder job triggered successfully for jobId=${job.id}`);
      await updateJob(pool, job.id, { status: "building" });
      return reply.status(200).send({ jobId: job.id, status: "queued" });
    } catch (err) {
      console.error(`[GENERATE] Failed to trigger builder job for jobId=${job.id}:`, err);
      if (err instanceof Error) {
        console.error(`[GENERATE] Error stack:`, err.stack);
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
