-- Verification and fix script for jobs table
-- Run this to ensure the table schema is correct and fix any issues

-- 1. Verify enum type exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    RAISE EXCEPTION 'job_status enum type does not exist. Run 000_complete_jobs_schema.sql first.';
  END IF;
END $$;

-- 2. Verify all required columns exist
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'test';

-- 3. Verify column types are correct
DO $$
DECLARE
  status_type TEXT;
BEGIN
  SELECT data_type INTO status_type
  FROM information_schema.columns
  WHERE table_name = 'jobs' AND column_name = 'status';
  
  IF status_type != 'USER-DEFINED' THEN
    RAISE EXCEPTION 'status column type is incorrect. Expected job_status enum, got: %', status_type;
  END IF;
END $$;

-- 4. Verify default values
DO $$
BEGIN
  -- Check that status default is set correctly
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'status' 
    AND column_default LIKE '%created%'
  ) THEN
    ALTER TABLE jobs ALTER COLUMN status SET DEFAULT 'created'::job_status;
  END IF;
  
  -- Check that mode default is set correctly
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'mode' 
    AND column_default = '''test''::text'
  ) THEN
    ALTER TABLE jobs ALTER COLUMN mode SET DEFAULT 'test';
  END IF;
END $$;

-- 5. Verify foreign key constraint on parent_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'jobs' 
    AND constraint_name LIKE '%parent_id%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_parent_id_fkey 
      FOREIGN KEY (parent_id) REFERENCES jobs(id);
  END IF;
END $$;

-- 6. Verify indexes exist
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- 7. Verify trigger function and trigger exist
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
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 8. Test insert with enum casting (this will fail if there's still an issue)
DO $$
DECLARE
  test_id UUID;
BEGIN
  -- This should work without errors
  INSERT INTO jobs (prompt, status, mode)
  VALUES ('test prompt', 'created'::job_status, 'test')
  RETURNING id INTO test_id;
  
  -- Clean up test row
  DELETE FROM jobs WHERE id = test_id;
  
  RAISE NOTICE 'Enum casting test passed successfully';
END $$;
