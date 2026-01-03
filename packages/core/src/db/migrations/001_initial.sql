-- 001_initial.sql

-- Recipes table
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,
  servings INTEGER NOT NULL DEFAULT 4,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  source_url TEXT,
  source_type TEXT CHECK(source_type IN ('manual', 'imported', 'agent_curated')),
  cuisine TEXT,
  difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ingredients table (normalized)
CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  default_unit TEXT
);

-- Recipe ingredients junction
CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity REAL,
  unit TEXT,
  notes TEXT,
  optional INTEGER NOT NULL DEFAULT 0
);

-- Tags table
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT CHECK(category IN ('meal_type', 'dietary', 'cuisine', 'season', 'custom'))
);

-- Recipe tags junction
CREATE TABLE recipe_tags (
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

-- Weekly plans
CREATE TABLE weekly_plans (
  id TEXT PRIMARY KEY,
  week TEXT NOT NULL UNIQUE,  -- ISO week: 2025-W02
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'completed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Plan items (meals)
CREATE TABLE plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),  -- 1=Monday
  meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
  servings INTEGER NOT NULL DEFAULT 2,
  notes TEXT,
  UNIQUE(plan_id, day_of_week, meal_type)
);

-- Pantry items (optional tracking)
CREATE TABLE pantry_items (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity REAL,
  unit TEXT,
  expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User preferences
CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,  -- JSON encoded
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,  -- 'user', 'cli', 'api', 'agent:curator', 'agent:planner'
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT  -- JSON
);

-- Indexes
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_recipe_tags_recipe ON recipe_tags(recipe_id);
CREATE INDEX idx_recipe_tags_tag ON recipe_tags(tag_id);
CREATE INDEX idx_plan_items_plan ON plan_items(plan_id);
CREATE INDEX idx_plan_items_recipe ON plan_items(recipe_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_actor ON audit_log(actor);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Full-text search for recipes
CREATE VIRTUAL TABLE recipes_fts USING fts5(
  title,
  description,
  instructions,
  content='recipes',
  content_rowid='rowid'
);

-- FTS triggers
CREATE TRIGGER recipes_ai AFTER INSERT ON recipes BEGIN
  INSERT INTO recipes_fts(rowid, title, description, instructions)
  VALUES (NEW.rowid, NEW.title, NEW.description, NEW.instructions);
END;

CREATE TRIGGER recipes_ad AFTER DELETE ON recipes BEGIN
  INSERT INTO recipes_fts(recipes_fts, rowid, title, description, instructions)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.instructions);
END;

CREATE TRIGGER recipes_au AFTER UPDATE ON recipes BEGIN
  INSERT INTO recipes_fts(recipes_fts, rowid, title, description, instructions)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.instructions);
  INSERT INTO recipes_fts(rowid, title, description, instructions)
  VALUES (NEW.rowid, NEW.title, NEW.description, NEW.instructions);
END;
