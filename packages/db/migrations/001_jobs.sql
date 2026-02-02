-- Jobs table: one row per mod build request.
-- status: created | planned | rejected | queued | building | succeeded | failed

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM (
      'created',
      'planned',
      'rejected',
      'queued',
      'building',
      'succeeded',
      'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,
  parent_id   UUID REFERENCES jobs(id),
  prompt         TEXT NOT NULL,
  status        job_status NOT NULL DEFAULT 'created',
  rejection_reason TEXT,
  spec_json     JSONB,
  artifact_path TEXT,
  log_path      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Keep updated_at in sync (optional trigger; can be done in app too)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jobs_updated_at') THEN
    CREATE TRIGGER jobs_updated_at
      BEFORE UPDATE ON jobs
      FOR EACH ROW
      EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;
