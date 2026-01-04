-- 002_grocery_list_persistence.sql
-- Add persistent grocery lists with item states for shopping workflow

-- Grocery lists table (one per week)
CREATE TABLE IF NOT EXISTS grocery_lists (
  id TEXT PRIMARY KEY,
  week TEXT NOT NULL UNIQUE,
  generated_at TEXT,
  updated_at TEXT
);

-- Grocery list items table
CREATE TABLE IF NOT EXISTS grocery_list_items (
  id TEXT PRIMARY KEY,
  grocery_list_id TEXT NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  ingredient_id TEXT REFERENCES ingredients(id),
  name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  status TEXT DEFAULT 'need_to_buy' CHECK(status IN ('need_to_buy', 'already_have', 'partial')),
  have_quantity REAL,
  is_manual INTEGER DEFAULT 0,
  recipes TEXT
);

-- Indexes for grocery list queries
CREATE INDEX IF NOT EXISTS idx_grocery_list_items_list ON grocery_list_items(grocery_list_id);
CREATE INDEX IF NOT EXISTS idx_grocery_list_items_status ON grocery_list_items(status);
CREATE INDEX IF NOT EXISTS idx_grocery_list_items_ingredient ON grocery_list_items(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_week ON grocery_lists(week);
