-- 004_plan_completion.sql
-- Add completed_at to weekly_plans and was_made to plan_items
-- for tracking plan completion and meal history

-- Add completed_at timestamp to weekly_plans
ALTER TABLE weekly_plans ADD COLUMN completed_at TEXT;

-- Add was_made boolean to plan_items to track which meals were actually cooked
ALTER TABLE plan_items ADD COLUMN was_made INTEGER DEFAULT 0;

-- Create index for querying completed plans
CREATE INDEX idx_weekly_plans_completed_at ON weekly_plans(completed_at);
