-- Test migration for validation purposes
-- This creates a simple test table to verify the migration system works

CREATE TABLE test_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
