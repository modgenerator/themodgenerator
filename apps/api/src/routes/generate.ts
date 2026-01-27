import type { FastifyPluginAsync } from "fastify";
import { getPool, insertJob, updateJob } from "@themodgenerator/db";
import { validateSpec } from "@themodgenerator/validator";
import { planSpec } from "../services/planner.js";
import { triggerBuilderJob } from "../services/job-trigger.js";

const pool = getPool();

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
      await triggerBuilderJob(job.id, mode);
      await updateJob(pool, job.id, { status: "building" });
    } catch (err) {
      await updateJob(pool, job.id, {
        status: "failed",
        rejection_reason: err instanceof Error ? err.message : "Failed to start builder",
      });
      return reply.status(502).send({
        error: "Builder could not be started",
        jobId: job.id,
      });
    }
    
    return reply.status(200).send({ jobId: job.id, status: "queued" });
  });
};
