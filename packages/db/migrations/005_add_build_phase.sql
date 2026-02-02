-- Observability: latest phase per build (buildId = job id)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_phase TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS phase_updated_at TIMESTAMPTZ;
