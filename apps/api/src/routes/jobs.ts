import type { FastifyPluginAsync } from "fastify";
import { getPool, insertJob, getJobById, updateJob } from "@themodgenerator/db";
import { getArtifactDownloadUrl } from "@themodgenerator/gcp";
import {
  expandIntentToScope,
  expandPromptToScope,
  getScopeBudgetResult,
  planFromIntent,
  aggregateExecutionPlans,
  buildAggregatedExpectationContract,
  buildSafetyDisclosure,
  type CreditBudget,
} from "@themodgenerator/generator";
import { expandSpecTier1 } from "@themodgenerator/spec";
import { validateSpec } from "@themodgenerator/validator";
import { planSpec } from "../services/planner.js";
import { triggerBuilderJob } from "../services/job-trigger.js";

const DEFAULT_BUDGET: CreditBudget = 30;

const gcsBucket = process.env.GCS_BUCKET ?? "";

function getDbPool() {
  return getPool();
}

function parseGsUrl(gs: string): { bucket: string; path: string } | null {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(gs);
  if (!m) return null;
  return { bucket: m[1], path: m[2] };
}

export const jobRoutes: FastifyPluginAsync = async (app) => {
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
    const spec = planSpec(prompt);
    const validation = validateSpec(spec, { prompt });
    if (!validation.valid) {
      const job = await insertJob(pool, {
        prompt,
        mode,
        status: "rejected",
        rejection_reason: validation.reason ?? "Validation failed",
      });
      return reply.status(200).send({ jobId: job.id });
    }
    const job = await insertJob(pool, {
      prompt,
      mode,
      status: "queued",
      spec_json: spec,
    });
    const expanded = expandSpecTier1(spec);
    const scopeFromPrompt = expandPromptToScope(prompt);
    const scopeFromItems = expanded.items.flatMap((item, i) =>
      expandIntentToScope({
        name: item.name,
        description: i === 0 && prompt ? prompt : undefined,
        category: "item",
        material: item.material ?? "generic",
      })
    );
    const scopeFromBlocks = expanded.blocks.flatMap((b) =>
      expandIntentToScope({
        name: b.name,
        description: undefined,
        category: "block",
        material: b.material ?? "generic",
      })
    );
    const fullScope = [...scopeFromPrompt, ...scopeFromItems, ...scopeFromBlocks];
    const scopeResult = getScopeBudgetResult(fullScope, DEFAULT_BUDGET);
    try {
      await triggerBuilderJob(job.id, mode);
      await updateJob(pool, job.id, { status: "building" }); // Maps to "running" in API
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
    const itemPlans = expanded.items.map((item, i) =>
      planFromIntent({
        name: item.name,
        description: i === 0 && prompt ? prompt : undefined,
        category: "item",
        material: item.material ?? "generic",
      })
    );
    const blockPlans = expanded.blocks.map((b) =>
      planFromIntent({
        name: b.name,
        description: undefined,
        category: "block",
        material: b.material ?? "generic",
      })
    );
    const allPlans = [...itemPlans, ...blockPlans];
    const aggregatedPlan = aggregateExecutionPlans(allPlans);
    const expectationContract = buildAggregatedExpectationContract(aggregatedPlan);
    const safetyDisclosure = buildSafetyDisclosure(aggregatedPlan.primitives);
    return reply.status(200).send({
      jobId: job.id,
      executionPlan: {
        systems: aggregatedPlan.systems,
        explanation: aggregatedPlan.explanation,
        upgradePath: aggregatedPlan.upgradePath,
        futureExpansion: aggregatedPlan.futureExpansion,
      },
      expectationContract,
      safetyDisclosure,
      scopeSummary: scopeResult.scopeSummary,
      totalCredits: scopeResult.totalCredits,
      fitsBudget: scopeResult.fitsBudget,
      explanation: scopeResult.explanation,
    });
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const pool = getDbPool();
    const job = await getJobById(pool, req.params.id);
    if (!job) {
      return reply.status(404).send({ error: "Job not found" });
    }
    // Map internal status to API status
    const statusMap: Record<string, "queued" | "running" | "completed" | "failed"> = {
      queued: "queued",
      building: "running",
      succeeded: "completed",
      failed: "failed",
      rejected: "failed",
      created: "queued",
      planned: "queued",
    };
    const apiStatus = statusMap[job.status] ?? "queued";
    const out: {
      id: string;
      status: "queued" | "running" | "completed" | "failed";
      error?: string;
      artifactPath?: string;
      downloadUrl?: string | null;
      executionPlan?: { systems: string[]; explanation: string[]; upgradePath?: string[]; futureExpansion?: string[] };
      expectationContract?: { whatItDoes: string[]; howYouUseIt: string[]; limits: string[]; scalesWithCredits: string[] };
      safetyDisclosure?: { statements: string[] };
      scopeSummary?: string[];
      totalCredits?: number;
      budget?: number;
      fitsBudget?: boolean;
      explanation?: string;
    } = {
      id: job.id,
      status: apiStatus,
    };
    if (job.rejection_reason) {
      out.error = job.rejection_reason;
    }
    if (job.spec_json && job.prompt) {
      const expanded = expandSpecTier1(job.spec_json);
      const scopeFromPrompt = expandPromptToScope(job.prompt);
      const scopeFromItems = expanded.items.flatMap((item, i) =>
        expandIntentToScope({
          name: item.name,
          description: i === 0 ? job.prompt : undefined,
          category: "item",
          material: item.material ?? "generic",
        })
      );
      const scopeFromBlocks = expanded.blocks.flatMap((b) =>
        expandIntentToScope({
          name: b.name,
          description: undefined,
          category: "block",
          material: b.material ?? "generic",
        })
      );
      const fullScope = [...scopeFromPrompt, ...scopeFromItems, ...scopeFromBlocks];
      const scopeResult = getScopeBudgetResult(fullScope, DEFAULT_BUDGET);
      out.scopeSummary = scopeResult.scopeSummary;
      out.totalCredits = scopeResult.totalCredits;
      out.budget = scopeResult.budget;
      out.fitsBudget = scopeResult.fitsBudget;
      out.explanation = scopeResult.explanation;
      const itemPlans = expanded.items.map((item, i) =>
        planFromIntent({
          name: item.name,
          description: i === 0 ? job.prompt : undefined,
          category: "item",
          material: item.material ?? "generic",
        })
      );
      const blockPlans = expanded.blocks.map((b) =>
        planFromIntent({
          name: b.name,
          description: undefined,
          category: "block",
          material: b.material ?? "generic",
        })
      );
      const allPlans = [...itemPlans, ...blockPlans];
      const aggregatedPlan = aggregateExecutionPlans(allPlans);
      out.executionPlan = {
        systems: aggregatedPlan.systems,
        explanation: aggregatedPlan.explanation,
        upgradePath: aggregatedPlan.upgradePath,
        futureExpansion: aggregatedPlan.futureExpansion,
      };
      out.expectationContract = buildAggregatedExpectationContract(aggregatedPlan);
      out.safetyDisclosure = buildSafetyDisclosure(aggregatedPlan.primitives);
    }
    // Extract artifactPath from gs:// URL or use as-is
    if (job.artifact_path) {
      const parsed = parseGsUrl(job.artifact_path);
      out.artifactPath = parsed?.path ?? job.artifact_path;
    }
    // Only generate downloadUrl if status is completed and artifact exists
    if (apiStatus === "completed" && job.artifact_path) {
      const parsed = parseGsUrl(job.artifact_path);
      const bucket = parsed?.bucket ?? gcsBucket;
      const path = parsed?.path ?? job.artifact_path;
      if (bucket && path) {
        try {
          out.downloadUrl = await getArtifactDownloadUrl(bucket, path, 900); // 15 minutes
        } catch (err) {
          console.error("Failed to generate signed URL:", err);
          out.downloadUrl = null;
        }
      } else {
        out.downloadUrl = null;
      }
    } else {
      out.downloadUrl = null;
    }
    return reply.status(200).send(out);
  });
};
