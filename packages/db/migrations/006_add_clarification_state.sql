-- Clarification state machine: none | asked | answered | skipped (one ask per job max).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS clarification_status TEXT DEFAULT 'none';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS clarification_question TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS clarification_answer TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS clarification_answered_at TIMESTAMPTZ;
