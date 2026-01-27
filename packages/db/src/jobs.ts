import type { Pool } from "pg";
import type { ModSpecV1 } from "@themodgenerator/spec";

export type JobStatus =
  | "created"
  | "planned"
  | "rejected"
  | "queued"
  | "building"
  | "succeeded"
  | "failed";

export interface JobRow {
  id: string;
  user_id: string | null;
  parent_id: string | null;
  prompt: string;
  mode: string | null;
  status: JobStatus;
  rejection_reason: string | null;
  spec_json: ModSpecV1 | null;
  artifact_path: string | null;
  log_path: string | null;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}

export interface InsertJobInput {
  id?: string;
  user_id?: string | null;
  parent_id?: string | null;
  prompt: string;
  mode?: string | null;
  status?: JobStatus;
  rejection_reason?: string | null;
  spec_json?: ModSpecV1 | null;
  artifact_path?: string | null;
  log_path?: string | null;
}

export interface UpdateJobInput {
  status?: JobStatus;
  rejection_reason?: string | null;
  spec_json?: ModSpecV1 | null;
  artifact_path?: string | null;
  log_path?: string | null;
  started_at?: Date | null;
  finished_at?: Date | null;
}

export async function insertJob(
  pool: Pool,
  input: InsertJobInput
): Promise<JobRow> {
  const res = await pool.query<Record<string, unknown>>(
    `INSERT INTO jobs (
      id, user_id, parent_id, prompt, mode, status, rejection_reason,
      spec_json, artifact_path, log_path
    ) VALUES (
      COALESCE($1, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'test'), $6::job_status,
      $7, $8, $9, $10
    )
    RETURNING *`,
    [
      input.id ?? null,
      input.user_id ?? null,
      input.parent_id ?? null,
      input.prompt,
      input.mode ?? "test",
      input.status ?? "created",
      input.rejection_reason ?? null,
      input.spec_json ? JSON.stringify(input.spec_json) : null,
      input.artifact_path ?? null,
      input.log_path ?? null,
    ]
  );
  return mapRow(res.rows[0]);
}

export async function getJobById(
  pool: Pool,
  id: string
): Promise<JobRow | null> {
  const res = await pool.query<Record<string, unknown>>(
    "SELECT * FROM jobs WHERE id = $1",
    [id]
  );
  if (res.rows.length === 0) return null;
  return mapRow(res.rows[0] as Record<string, unknown>);
}

export async function updateJob(
  pool: Pool,
  id: string,
  input: UpdateJobInput
): Promise<JobRow | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.status !== undefined) {
    updates.push(`status = $${i++}::job_status`);
    values.push(input.status);
  }
  if (input.rejection_reason !== undefined) {
    updates.push(`rejection_reason = $${i++}`);
    values.push(input.rejection_reason);
  }
  if (input.spec_json !== undefined) {
    updates.push(`spec_json = $${i++}`);
    values.push(JSON.stringify(input.spec_json));
  }
  if (input.artifact_path !== undefined) {
    updates.push(`artifact_path = $${i++}`);
    values.push(input.artifact_path);
  }
  if (input.log_path !== undefined) {
    updates.push(`log_path = $${i++}`);
    values.push(input.log_path);
  }
  if (input.started_at !== undefined) {
    updates.push(`started_at = $${i++}`);
    values.push(input.started_at);
  }
  if (input.finished_at !== undefined) {
    updates.push(`finished_at = $${i++}`);
    values.push(input.finished_at);
  }
  if (updates.length === 0) {
    return getJobById(pool, id);
  }
  values.push(id);
  const res = await pool.query<Record<string, unknown>>(
    `UPDATE jobs SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  if (res.rows.length === 0) return null;
  return mapRow(res.rows[0]);
}

function mapRow(r: Record<string, unknown>): JobRow {
  return {
    id: r.id as string,
    user_id: r.user_id as string | null,
    parent_id: r.parent_id as string | null,
    prompt: r.prompt as string,
    mode: (r.mode as string | null) ?? "test",
    status: r.status as JobStatus,
    rejection_reason: r.rejection_reason as string | null,
    spec_json: r.spec_json as ModSpecV1 | null,
    artifact_path: r.artifact_path as string | null,
    log_path: r.log_path as string | null,
    created_at: r.created_at as Date,
    updated_at: r.updated_at as Date,
    started_at: r.started_at as Date | null,
    finished_at: r.finished_at as Date | null,
  };
}
