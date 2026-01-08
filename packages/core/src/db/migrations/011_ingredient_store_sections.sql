-- 011_ingredient_store_sections.sql
-- Add store_section column to ingredients table for grocery list organization

-- Add store_section column to ingredients table
ALTER TABLE ingredients ADD COLUMN store_section TEXT;

-- Create index for fast lookup by store_section
CREATE INDEX idx_ingredients_store_section ON ingredients(store_section);

-- Update existing ingredients with store_section based on their category
-- Categories map directly to store sections for initial migration
UPDATE ingredients
SET store_section = LOWER(category)
WHERE category IS NOT NULL;

-- Set default for uncategorized ingredients
UPDATE ingredients
SET store_section = 'other'
WHERE store_section IS NULL;
