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
  deriveCapabilitiesFromPlan,
  type CreditBudget,
} from "@themodgenerator/generator";
import { expandSpecTier1 } from "@themodgenerator/spec";
import { validateSpec } from "@themodgenerator/validator";
import { interpretToSpec } from "@themodgenerator/generator";
import { sanitizeSpec, isBlockPrompt } from "../services/planner.js";
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

/** Contract: progress 0–100 from phase/status. Frontend uses this for progress bar. */
function phaseToProgress(phase: string | null, status: string): number {
  if (status === "completed" || status === "failed") return 100;
  if (status === "queued") return 0;
  const map: Record<string, number> = {
    prompt_parsed: 5,
    spec_generated: 10,
    rules_expanded: 20,
    validated: 25,
    world_interactions: 30,
    behaviors: 40,
    compiled: 50,
    building_mod: 75,
    uploaded: 95,
  };
  return phase ? (map[phase] ?? 10) : 5;
}

export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { prompt: string } }>("/", async (req, reply) => {
    const prompt = req.body?.prompt;
    if (typeof prompt !== "string" || !prompt.trim()) {
      return reply.status(400).send({ error: "prompt is required and must be a non-empty string" });
    }
    const pool = getDbPool();
    const job = await insertJob(pool, {
      prompt,
      mode: "build",
      status: "queued",
    });
    const buildId = job.id;
    const blockOnly = isBlockPrompt(prompt);
    const interpretResult = interpretToSpec(prompt, { blockOnly });
    if (interpretResult.type === "request_clarification") {
      await updateJob(pool, job.id, {
        clarification_status: "asked",
        clarification_question: interpretResult.message,
      });
      console.log(`[JOBS] jobId=${buildId} clarification_status=none->asked (conflict; blockOnly=${blockOnly})`);
      return reply.status(200).send({
        jobId: job.id,
        needsClarification: true,
        message: interpretResult.message,
        examples: interpretResult.examples,
      });
    }
    if (!("spec" in interpretResult)) {
      return reply.status(500).send({ error: "Interpreter did not return a spec" });
    }
    const spec = sanitizeSpec(interpretResult.spec);
    try {
      validateSpec(spec, { prompt });
    } catch {
      // non-blocking
    }
    await updateJob(pool, job.id, { spec_json: spec, clarification_status: "skipped" });
    console.log(`[JOBS] jobId=${buildId} clarification_status=skipped spec from interpreter`);
    const expanded = expandSpecTier1(spec);
    const scopeFromPrompt = expandPromptToScope(prompt);
    const scopeFromItems = expanded.items.flatMap((item, i) =>
      expandIntentToScope({
        name: item.name,
        description: i === 0 ? prompt : undefined,
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
    const itemPlans = expanded.items.map((item, i) =>
      planFromIntent({
        name: item.name,
        description: i === 0 ? prompt : undefined,
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
    try {
      console.log(`[JOBS] buildId=${buildId} triggering builder`);
      await triggerBuilderJob(job.id, "build");
      await updateJob(pool, job.id, { status: "building" }); // Maps to "running" in API
      console.log(`[JOBS] buildId=${buildId} builder triggered status=building`);
    } catch (err) {
      console.error(`[JOBS] buildId=${buildId} builder trigger failed:`, err);
      await updateJob(pool, job.id, {
        status: "failed",
        rejection_reason: err instanceof Error ? err.message : "Failed to start builder",
      });
      return reply.status(502).send({
        error: "Builder could not be started",
        jobId: job.id,
      });
    }
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
    // Contract: GET /jobs/:id returns status only as "queued"|"running"|"completed"|"failed" (never "succeeded").
    const statusMap: Record<string, "queued" | "running" | "completed" | "failed"> = {
      queued: "queued",
      building: "running",
      succeeded: "completed",
      failed: "failed",
      rejected: "failed",
      created: "queued",
      planned: "queued",
    };
    let apiStatus: "queued" | "running" | "completed" | "failed" = statusMap[job.status] ?? "queued";
    const out: {
      id: string;
      status: "queued" | "running" | "completed" | "failed";
      progress: number;
      error?: string;
      artifactUrl?: string | null;
      currentPhase?: string | null;
      phaseUpdatedAt?: string | null;
      executionPlan?: { systems: string[]; explanation: string[]; upgradePath?: string[]; futureExpansion?: string[] };
      capabilitySummary?: { hasUseAction: boolean; dealsDamage: boolean; appliesEffects: boolean };
      expectationContract?: { whatItDoes: string[]; howYouUseIt: string[]; limits: string[]; scalesWithCredits: string[] };
      safetyDisclosure?: { statements: string[] };
      scopeSummary?: string[];
      totalCredits?: number;
      budget?: number;
      fitsBudget?: boolean;
      explanation?: string;
      clarificationStatus?: string | null;
      clarificationQuestion?: string | null;
    } = {
      id: job.id,
      status: apiStatus,
      progress: 0,
      currentPhase: job.current_phase ?? null,
      phaseUpdatedAt:
        job.phase_updated_at != null
          ? (typeof job.phase_updated_at === "string"
              ? job.phase_updated_at
              : (job.phase_updated_at as Date).toISOString())
          : null,
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
      out.capabilitySummary = deriveCapabilitiesFromPlan(allPlans, aggregatedPlan);
      out.expectationContract = buildAggregatedExpectationContract(aggregatedPlan);
      out.safetyDisclosure = buildSafetyDisclosure(aggregatedPlan.primitives);
    }
    // Contract: when status is "completed", artifactUrl is always set (artifact_path exists and signing succeeded).
    if (apiStatus === "completed") {
      if (!job.artifact_path) {
        console.error(`[JOBS] buildId=${job.id} status=succeeded but artifact_path missing; returning failed`);
        apiStatus = "failed";
        out.status = "failed";
        out.error = "Artifact missing; build may have completed without uploading the JAR.";
        out.artifactUrl = null;
      } else {
        const parsed = parseGsUrl(job.artifact_path);
        const bucket = parsed?.bucket ?? gcsBucket;
        const path = parsed?.path ?? job.artifact_path;
        if (!bucket || !path) {
          console.error(`[JOBS] buildId=${job.id} invalid artifact_path (no bucket/path)`);
          apiStatus = "failed";
          out.status = "failed";
          out.error = "Invalid artifact path; cannot generate download URL.";
          out.artifactUrl = null;
        } else {
          try {
            out.artifactUrl = await getArtifactDownloadUrl(bucket, path, 900); // 15 minutes
            out.status = "completed";
            console.log(`[JOBS] buildId=${job.id} artifact signed URL generated successfully`);
          } catch (err) {
            console.error(`[JOBS] buildId=${job.id} signed URL failed path=${path}`, err);
            apiStatus = "failed";
            out.status = "failed";
            out.error = "Signed download URL could not be generated; try again later.";
            out.artifactUrl = null;
          }
        }
      }
    } else {
      out.artifactUrl = null;
    }
    // Contract: progress 0–100 for progress bar; derived from currentPhase and final status.
    out.progress = phaseToProgress(out.currentPhase ?? null, out.status);
    const payloadSummary = {
      buildId: job.id,
      status: out.status,
      capabilities: out.capabilitySummary ?? null,
      creditTier: out.totalCredits ?? null,
      hasArtifactUrl: !!out.artifactUrl,
    };
    out.clarificationStatus = job.clarification_status ?? null;
    out.clarificationQuestion = job.clarification_question ?? null;
    console.log(`[JOBS] buildId=${job.id} final payload to frontend:`, JSON.stringify(payloadSummary));
    return reply.status(200).send(out);
  });

  app.post<{ Params: { id: string }; Body: { answer: string } }>("/:id/clarification", async (req, reply) => {
    const jobId = req.params.id;
    const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
    if (!answer) {
      return reply.status(400).send({ error: "clarification answer is required and must be a non-empty string" });
    }
    const pool = getDbPool();
    const job = await getJobById(pool, jobId);
    if (!job) {
      return reply.status(404).send({ error: "Job not found" });
    }
    const status = job.clarification_status ?? "none";
    if (status !== "asked") {
      return reply.status(400).send({
        error: `Job is not awaiting clarification (clarification_status=${status}). Cannot submit answer.`,
      });
    }
    const now = new Date();
    const resolvedPrompt = `${job.prompt}\n\nClarification Answer: ${answer}`;
    await updateJob(pool, jobId, {
      clarification_answer: answer,
      clarification_answered_at: now,
      clarification_status: "answered",
    });
    console.log(`[JOBS] jobId=${jobId} clarification_status=asked->answered resolvedPrompt length=${resolvedPrompt.length}`);

    const reInterpret = interpretToSpec(resolvedPrompt, { blockOnly: isBlockPrompt(job.prompt) });
    const conflictAfterAnswer = reInterpret.type === "request_clarification";
    console.log(`[JOBS] jobId=${jobId} after clarification: conflictAfterAnswer=${conflictAfterAnswer} resolvedPromptUsed=true`);

    if (conflictAfterAnswer) {
      await updateJob(pool, jobId, {
        status: "failed",
        rejection_reason: "Clarification did not resolve ambiguity. Please rephrase.",
        current_phase: "failed",
        phase_updated_at: now,
      });
      return reply.status(200).send({
        success: false,
        jobId,
        error: "Clarification did not resolve ambiguity. Please rephrase.",
      });
    }

    if (!("spec" in reInterpret)) {
      await updateJob(pool, jobId, {
        status: "failed",
        rejection_reason: "Could not produce spec after clarification",
        current_phase: "failed",
        phase_updated_at: now,
      });
      return reply.status(200).send({ success: false, jobId, error: "Could not produce spec after clarification" });
    }

    const spec = sanitizeSpec(reInterpret.spec);
    try {
      validateSpec(spec, { prompt: resolvedPrompt });
    } catch {
      // non-blocking
    }
    await updateJob(pool, jobId, { spec_json: spec });
    const expanded = expandSpecTier1(spec);
    const scopeFromPrompt = expandPromptToScope(resolvedPrompt);
    const scopeFromItems = expanded.items.flatMap((item, i) =>
      expandIntentToScope({
        name: item.name,
        description: i === 0 ? resolvedPrompt : undefined,
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
    const itemPlans = expanded.items.map((item, i) =>
      planFromIntent({
        name: item.name,
        description: i === 0 ? resolvedPrompt : undefined,
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
    try {
      await triggerBuilderJob(jobId, "build");
      await updateJob(pool, jobId, { status: "building" });
    } catch (err) {
      console.error(`[JOBS] jobId=${jobId} builder trigger failed after clarification:`, err);
      await updateJob(pool, jobId, {
        status: "failed",
        rejection_reason: err instanceof Error ? err.message : "Failed to start builder",
      });
      return reply.status(502).send({ error: "Builder could not be started", jobId });
    }
    const expectationContract = buildAggregatedExpectationContract(aggregatedPlan);
    const safetyDisclosure = buildSafetyDisclosure(aggregatedPlan.primitives);
    return reply.status(200).send({
      success: true,
      jobId,
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
};
