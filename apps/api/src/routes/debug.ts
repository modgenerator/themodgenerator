import type { FastifyPluginAsync } from "fastify";
import { getPool, getJobById } from "@themodgenerator/db";

function getDbPool() {
  return getPool();
}

/** Map internal job status to debug status. */
function toDebugStatus(
  status: string
): "running" | "completed" | "failed" {
  if (status === "building" || status === "queued" || status === "created" || status === "planned") {
    return "running";
  }
  if (status === "succeeded") return "completed";
  return "failed";
}

/**
 * GET /debug/build/:buildId
 * Read-only observability: current phase and status for a build (buildId = job id).
 */
export const debugRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { buildId: string } }>("/build/:buildId", async (req, reply) => {
    const buildId = req.params.buildId;
    const pool = getDbPool();
    const job = await getJobById(pool, buildId);
    if (!job) {
      return reply.status(404).send({ error: "Build not found", buildId });
    }
    const lastUpdated = job.phase_updated_at ?? job.updated_at;
    const lastUpdatedStr =
      lastUpdated instanceof Date ? lastUpdated.toISOString() : (lastUpdated ? String(lastUpdated) : new Date().toISOString());
    return reply.status(200).send({
      buildId: job.id,
      currentPhase: job.current_phase ?? null,
      lastUpdated: lastUpdatedStr,
      status: toDebugStatus(job.status),
    });
  });
};
