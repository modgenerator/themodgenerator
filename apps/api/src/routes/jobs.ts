import type { FastifyPluginAsync } from "fastify";
import { getPool, insertJob, getJobById, updateJob } from "@themodgenerator/db";
import { getArtifactDownloadUrl, getLogDownloadUrl } from "@themodgenerator/gcp";
import { validateSpec } from "@themodgenerator/validator";
import { planSpec } from "../services/planner.js";
import { triggerBuilderJob } from "../services/job-trigger.js";

const pool = getPool();
const gcsBucket = process.env.GCS_BUCKET ?? "";

function parseGsUrl(gs: string): { bucket: string; path: string } | null {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(gs);
  if (!m) return null;
  return { bucket: m[1], path: m[2] };
}

export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { prompt: string } }>("/", async (req, reply) => {
    const prompt = req.body?.prompt;
    if (typeof prompt !== "string" || !prompt.trim()) {
      return reply.status(400).send({ error: "prompt is required and must be a non-empty string" });
    }
    const spec = planSpec(prompt);
    const validation = validateSpec(spec, { prompt });
    if (!validation.valid) {
      const job = await insertJob(pool, {
        prompt,
        status: "rejected",
        rejection_reason: validation.reason ?? "Validation failed",
      });
      return reply.status(200).send({ id: job.id });
    }
    const job = await insertJob(pool, {
      prompt,
      status: "queued",
      spec_json: spec,
    });
    try {
      await triggerBuilderJob(job.id);
    } catch (err) {
      await updateJob(pool, job.id, {
        status: "failed",
        rejection_reason: err instanceof Error ? err.message : "Failed to start builder",
      });
      return reply.status(502).send({
        error: "Builder could not be started",
        id: job.id,
      });
    }
    return reply.status(200).send({ id: job.id });
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const job = await getJobById(pool, req.params.id);
    if (!job) {
      return reply.status(404).send({ error: "Job not found" });
    }
    const out: {
      id: string;
      status: string;
      rejection_reason?: string;
      downloadUrl?: string;
      logUrl?: string;
    } = {
      id: job.id,
      status: job.status,
    };
    if (job.rejection_reason) out.rejection_reason = job.rejection_reason;
    if (job.status === "succeeded" && job.artifact_path) {
      const parsed = parseGsUrl(job.artifact_path);
      const bucket = parsed?.bucket ?? gcsBucket;
      const path = parsed?.path ?? job.artifact_path;
      if (bucket) {
        out.downloadUrl = await getArtifactDownloadUrl(bucket, path, 300);
      }
    }
    if (job.log_path) {
      const parsed = parseGsUrl(job.log_path);
      const bucket = parsed?.bucket ?? gcsBucket;
      const path = parsed?.path ?? job.log_path;
      if (bucket) {
        out.logUrl = await getLogDownloadUrl(bucket, path, 3600);
      }
    }
    return reply.status(200).send(out);
  });
};
