-- 009_recipe_versions.sql
-- Add support for recipe versioning and variations

-- Add parent_recipe_id and version_name columns to recipes table
-- Using SET NULL on delete so deleting parent doesn't cascade to versions
ALTER TABLE recipes ADD COLUMN parent_recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL;
ALTER TABLE recipes ADD COLUMN version_name TEXT;

-- SQLite doesn't support ALTER COLUMN to modify CHECK constraints
-- We need to recreate the table to include 'variation' in the source_type CHECK
-- This is the standard SQLite pattern for modifying constraints

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE recipes_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,
  servings INTEGER NOT NULL DEFAULT 4,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  source_url TEXT,
  source_type TEXT CHECK(source_type IN ('manual', 'imported', 'agent_curated', 'variation')),
  cuisine TEXT,
  difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
  is_favorite INTEGER NOT NULL DEFAULT 0,
  parent_recipe_id TEXT REFERENCES recipes_new(id) ON DELETE SET NULL,
  version_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy data from old table to new table
INSERT INTO recipes_new (id, title, description, instructions, servings, prep_time_minutes,
  cook_time_minutes, source_url, source_type, cuisine, difficulty, is_favorite,
  parent_recipe_id, version_name, created_at, updated_at)
SELECT id, title, description, instructions, servings, prep_time_minutes,
  cook_time_minutes, source_url, source_type, cuisine, difficulty,
  COALESCE(is_favorite, 0), parent_recipe_id, version_name, created_at, updated_at
FROM recipes;

-- Step 3: Drop old table
DROP TABLE recipes;

-- Step 4: Rename new table to original name
ALTER TABLE recipes_new RENAME TO recipes;

-- Step 5: Recreate indexes
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX idx_recipes_parent ON recipes(parent_recipe_id);

-- Step 6: Recreate FTS table and triggers
DROP TABLE IF EXISTS recipes_fts;
CREATE VIRTUAL TABLE recipes_fts USING fts5(
  title,
  description,
  instructions,
  content='recipes',
  content_rowid='rowid'
);

-- Rebuild FTS index
INSERT INTO recipes_fts(rowid, title, description, instructions)
SELECT rowid, title, description, instructions FROM recipes;

-- Recreate FTS triggers
DROP TRIGGER IF EXISTS recipes_ai;
DROP TRIGGER IF EXISTS recipes_ad;
DROP TRIGGER IF EXISTS recipes_au;

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
