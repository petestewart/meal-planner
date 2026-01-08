-- 012_meal_sides.sql
-- Add side dish support to plan_items table
--
-- This migration:
-- 1. Adds is_side_dish and main_item_id columns
-- 2. Removes the unique constraint on (plan_id, day_of_week, meal_type)
--    to allow multiple items (main + sides) for the same slot
-- 3. Creates a new unique constraint for main dishes only

-- Step 1: Create new table with updated schema
CREATE TABLE plan_items_new (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
  meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
  servings INTEGER NOT NULL DEFAULT 2,
  notes TEXT,
  slot_type TEXT CHECK(slot_type IN ('recipe', 'dining_out', 'skip', 'leftovers')),
  leftovers_source_id TEXT REFERENCES plan_items(id) ON DELETE SET NULL,
  was_made INTEGER DEFAULT 0,
  batch_id TEXT REFERENCES prep_batches(id) ON DELETE SET NULL,
  is_side_dish INTEGER DEFAULT 0,
  main_item_id TEXT REFERENCES plan_items(id) ON DELETE SET NULL
);

-- Step 2: Copy existing data to new table
INSERT INTO plan_items_new (
  id, plan_id, recipe_id, day_of_week, meal_type, servings, notes,
  slot_type, leftovers_source_id, was_made, batch_id, is_side_dish, main_item_id
)
SELECT
  id, plan_id, recipe_id, day_of_week, meal_type, servings, notes,
  slot_type, leftovers_source_id, was_made, batch_id, 0, NULL
FROM plan_items;

-- Step 3: Drop old table
DROP TABLE plan_items;

-- Step 4: Rename new table to original name
ALTER TABLE plan_items_new RENAME TO plan_items;

-- Step 5: Recreate indexes
CREATE INDEX idx_plan_items_plan ON plan_items(plan_id);
CREATE INDEX idx_plan_items_recipe ON plan_items(recipe_id);
CREATE INDEX idx_plan_items_main ON plan_items(main_item_id);

-- Step 6: Create unique index for main dishes only (excluding side dishes)
-- This ensures only one main dish per (plan, day, meal) combination
CREATE UNIQUE INDEX idx_plan_items_unique_main ON plan_items(plan_id, day_of_week, meal_type)
  WHERE is_side_dish = 0 OR is_side_dish IS NULL;
