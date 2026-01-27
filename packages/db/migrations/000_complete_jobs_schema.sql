-- Complete jobs table schema (single migration)
-- This replaces incremental migrations 001 and 002

-- Create enum type for job status
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'created',
    'planned',
    'rejected',
    'queued',
    'building',
    'succeeded',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  parent_id       UUID REFERENCES jobs(id),
  prompt          TEXT NOT NULL,
  mode            TEXT DEFAULT 'test',
  status          job_status NOT NULL DEFAULT 'created',
  rejection_reason TEXT,
  spec_json       JSONB,
  artifact_path   TEXT,
  log_path        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS jobs_updated_at ON jobs;
CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
