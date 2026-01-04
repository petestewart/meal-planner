-- 006_recipe_modifications.sql
-- Personal notes and modifications for recipes

CREATE TABLE recipe_modifications (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_notes TEXT,
  ingredient_overrides TEXT,
  instruction_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(recipe_id)
);

-- Index for quick lookup by recipe
CREATE INDEX idx_recipe_modifications_recipe ON recipe_modifications(recipe_id);
