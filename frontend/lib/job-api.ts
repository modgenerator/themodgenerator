/**
 * Contract types for GET /jobs/:id (and POST /jobs create response).
 * Backend returns status only as "queued"|"running"|"completed"|"failed" (never "succeeded").
 * When status === "completed", artifactUrl is always set.
 * Use progress (0–100) for progress bar; currentPhase + phaseUpdatedAt for phase labels.
 */
export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface GetJobResponse {
  id: string;
  status: JobStatus;
  progress: number;
  error?: string;
  artifactUrl?: string | null;
  currentPhase?: string | null;
  phaseUpdatedAt?: string | null;
  executionPlan?: {
    systems: string[];
    explanation: string[];
    upgradePath?: string[];
    futureExpansion?: string[];
  };
  capabilitySummary?: { hasUseAction: boolean; dealsDamage: boolean; appliesEffects: boolean };
  expectationContract?: {
    whatItDoes: string[];
    howYouUseIt: string[];
    limits: string[];
    scalesWithCredits: string[];
  };
  safetyDisclosure?: { statements: string[] };
  scopeSummary?: string[];
  totalCredits?: number;
  budget?: number;
  fitsBudget?: boolean;
  explanation?: string;
}
