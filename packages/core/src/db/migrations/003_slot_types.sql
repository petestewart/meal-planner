-- 003_slot_types.sql
-- Add slot_type and leftovers_source_id columns to plan_items table
-- to support dining out, skip, and leftovers meal slots

ALTER TABLE plan_items ADD COLUMN slot_type TEXT DEFAULT 'recipe'
  CHECK(slot_type IN ('recipe', 'dining_out', 'skip', 'leftovers'));

ALTER TABLE plan_items ADD COLUMN leftovers_source_id TEXT REFERENCES plan_items(id);
