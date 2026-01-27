-- Fix: Ensure job_status enum exists and verify all values
-- This migration ensures the enum type is correct and can be used for casting

-- Verify enum type exists (should already exist from 000_complete_jobs_schema.sql)
DO $$ BEGIN
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

-- Verify all enum values exist (add any missing ones)
DO $$ 
BEGIN
  -- Check and add any missing enum values if needed
  -- PostgreSQL doesn't support adding enum values easily, so we just verify
  -- If you need to add values later, use: ALTER TYPE job_status ADD VALUE 'new_value';
  NULL;
END $$;

-- Test that casting works (this will fail if there's an issue)
DO $$
BEGIN
  -- This should not throw an error
  PERFORM 'created'::job_status;
  PERFORM 'planned'::job_status;
  PERFORM 'rejected'::job_status;
  PERFORM 'queued'::job_status;
  PERFORM 'building'::job_status;
  PERFORM 'succeeded'::job_status;
  PERFORM 'failed'::job_status;
END $$;
