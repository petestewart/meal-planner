-- 007_recipe_favorites.sql
-- Add is_favorite column to recipes table for quick access to favorite recipes

ALTER TABLE recipes ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

-- Index for quick lookup of favorites
CREATE INDEX idx_recipes_is_favorite ON recipes(is_favorite);
