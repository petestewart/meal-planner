-- 008_prep_batches.sql
-- Add support for batch cooking and meal prep tracking

-- Prep batches table - tracks when multiple meals come from the same batch/prep session
CREATE TABLE prep_batches (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  prep_date TEXT NOT NULL,  -- ISO date when batch will be prepared
  total_servings INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Add batch_id to plan_items as nullable foreign key
ALTER TABLE plan_items ADD COLUMN batch_id TEXT REFERENCES prep_batches(id) ON DELETE SET NULL;

-- Indexes for efficient queries
CREATE INDEX idx_prep_batches_recipe ON prep_batches(recipe_id);
CREATE INDEX idx_prep_batches_date ON prep_batches(prep_date);
CREATE INDEX idx_plan_items_batch ON plan_items(batch_id);
