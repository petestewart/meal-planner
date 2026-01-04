-- 005_pantry_enhancements.sql
-- Add enhanced pantry tracking columns for prepared items, location, and staples

-- Add is_prepared column to track cooked/prepped items
ALTER TABLE pantry_items ADD COLUMN is_prepared BOOLEAN DEFAULT FALSE;

-- Add preparation_notes for details about how item was prepared
ALTER TABLE pantry_items ADD COLUMN preparation_notes TEXT;

-- Add location column to track where item is stored
ALTER TABLE pantry_items ADD COLUMN location TEXT CHECK(location IN ('fridge', 'freezer', 'pantry'));

-- Add is_staple to mark items that are always on hand
ALTER TABLE pantry_items ADD COLUMN is_staple BOOLEAN DEFAULT FALSE;

-- Index for expiration queries (items expiring soon)
CREATE INDEX IF NOT EXISTS idx_pantry_items_expires ON pantry_items(expires_at);

-- Index for location queries
CREATE INDEX IF NOT EXISTS idx_pantry_items_location ON pantry_items(location);

-- Index for staple items
CREATE INDEX IF NOT EXISTS idx_pantry_items_staple ON pantry_items(is_staple);
