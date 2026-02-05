-- Store planner output for debugging (PlanSpec JSON from GPT planner).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS plan_json JSONB;
