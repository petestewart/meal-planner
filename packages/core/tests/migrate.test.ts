/**
 * Unit tests for database migration system
 */

import { test, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getAppliedMigrations } from '../src/db/migrate.js';

// Test utilities
function randomTmpDir(): string {
  return join(
    tmpdir(),
    `meals-migrate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('migrate creates schema_migrations table', () => {
  const db = getDb({ dbPath: ':memory:' });
  const tmpDir = randomTmpDir();

  try {
    // Create empty migrations dir
    mkdirSync(tmpDir, { recursive: true });

    migrate(db, tmpDir);

    // Check schema_migrations table exists
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
      )
      .get();

    expect(tableExists).toBeDefined();
  } finally {
    closeDb(db);
    cleanupDir(tmpDir);
  }
});

test('migrate applies migrations in order', () => {
  const db = getDb({ dbPath: ':memory:' });
  const tmpDir = randomTmpDir();

  try {
    mkdirSync(tmpDir, { recursive: true });

    // Create two migrations
    writeFileSync(
      join(tmpDir, '001_first.sql'),
      'CREATE TABLE first_table (id INTEGER PRIMARY KEY);'
    );
    writeFileSync(
      join(tmpDir, '002_second.sql'),
      'CREATE TABLE second_table (id INTEGER PRIMARY KEY);'
    );

    const applied = migrate(db, tmpDir);

    expect(applied).toBe(2);

    // Verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('first_table');
    expect(tableNames).toContain('second_table');
    expect(tableNames).toContain('schema_migrations');
  } finally {
    closeDb(db);
    cleanupDir(tmpDir);
  }
});

test('migrate skips already-applied migrations', () => {
  const db = getDb({ dbPath: ':memory:' });
  const tmpDir = randomTmpDir();

  try {
    mkdirSync(tmpDir, { recursive: true });

    writeFileSync(
      join(tmpDir, '001_test.sql'),
      'CREATE TABLE test_table (id INTEGER PRIMARY KEY);'
    );

    // First run
    const firstRun = migrate(db, tmpDir);
    expect(firstRun).toBe(1);

    // Second run - should skip
    const secondRun = migrate(db, tmpDir);
    expect(secondRun).toBe(0);

    // Verify only one entry in schema_migrations
    const migrations = getAppliedMigrations(db);
    expect(migrations.length).toBe(1);
    expect(migrations[0].version).toBe(1);
  } finally {
    closeDb(db);
    cleanupDir(tmpDir);
  }
});

test('migrate is transactional - rolls back on failure', () => {
  const db = getDb({ dbPath: ':memory:' });
  const tmpDir = randomTmpDir();

  try {
    mkdirSync(tmpDir, { recursive: true });

    // Create a migration that will fail
    writeFileSync(
      join(tmpDir, '001_bad.sql'),
      `
      CREATE TABLE good_table (id INTEGER PRIMARY KEY);
      CREATE TABLE good_table (id INTEGER PRIMARY KEY); -- duplicate, will fail
      `
    );

    expect(() => migrate(db, tmpDir)).toThrow();

    // Verify table was NOT created (rolled back)
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='good_table'"
      )
      .get();

    expect(tableExists).toBeUndefined();

    // Verify no migration was recorded
    const migrations = getAppliedMigrations(db);
    expect(migrations.length).toBe(0);
  } finally {
    closeDb(db);
    cleanupDir(tmpDir);
  }
});

test('migrate handles missing directory gracefully', () => {
  const db = getDb({ dbPath: ':memory:' });
  const tmpDir = join(tmpdir(), 'nonexistent-' + Date.now());

  try {
    const applied = migrate(db, tmpDir);
    expect(applied).toBe(0);
  } finally {
    closeDb(db);
  }
});

test('migrate skips files without version prefix', () => {
  const db = getDb({ dbPath: ':memory:' });
  const tmpDir = randomTmpDir();

  try {
    mkdirSync(tmpDir, { recursive: true });

    writeFileSync(
      join(tmpDir, 'no_prefix.sql'),
      'CREATE TABLE should_not_exist (id INTEGER);'
    );
    writeFileSync(
      join(tmpDir, '001_valid.sql'),
      'CREATE TABLE valid_table (id INTEGER PRIMARY KEY);'
    );

    const applied = migrate(db, tmpDir);
    expect(applied).toBe(1);

    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='should_not_exist'"
      )
      .get();

    expect(tableExists).toBeUndefined();
  } finally {
    closeDb(db);
    cleanupDir(tmpDir);
  }
});

test('getAppliedMigrations returns empty array when table does not exist', () => {
  const db = getDb({ dbPath: ':memory:' });

  try {
    const migrations = getAppliedMigrations(db);
    expect(migrations.length).toBe(0);
  } finally {
    closeDb(db);
  }
});

test('getAppliedMigrations returns applied migrations in order', () => {
  const db = getDb({ dbPath: ':memory:' });
  const tmpDir = randomTmpDir();

  try {
    mkdirSync(tmpDir, { recursive: true });

    writeFileSync(join(tmpDir, '003_third.sql'), 'SELECT 1;');
    writeFileSync(join(tmpDir, '001_first.sql'), 'SELECT 1;');
    writeFileSync(join(tmpDir, '002_second.sql'), 'SELECT 1;');

    migrate(db, tmpDir);

    const migrations = getAppliedMigrations(db);
    expect(migrations.length).toBe(3);
    expect(migrations[0].version).toBe(1);
    expect(migrations[1].version).toBe(2);
    expect(migrations[2].version).toBe(3);

    // Verify appliedAt is a valid timestamp
    expect(migrations[0].appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  } finally {
    closeDb(db);
    cleanupDir(tmpDir);
  }
});

test('001_initial.sql creates all required tables', () => {
  const db = getDb({ dbPath: ':memory:' });
  const migrationsDir = join(import.meta.dirname, '..', 'src', 'db', 'migrations');

  try {
    const applied = migrate(db, migrationsDir);
    expect(applied).toBeGreaterThanOrEqual(1);

    // Expected tables from Deliverable B
    const expectedTables = [
      'recipes',
      'ingredients',
      'recipe_ingredients',
      'tags',
      'recipe_tags',
      'weekly_plans',
      'plan_items',
      'pantry_items',
      'preferences',
      'audit_log',
    ];

    // Get all tables
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  } finally {
    closeDb(db);
  }
});

test('001_initial.sql creates all required indexes', () => {
  const db = getDb({ dbPath: ':memory:' });
  const migrationsDir = join(import.meta.dirname, '..', 'src', 'db', 'migrations');

  try {
    migrate(db, migrationsDir);

    // Expected indexes
    const expectedIndexes = [
      'idx_recipes_title',
      'idx_recipes_cuisine',
      'idx_recipe_ingredients_recipe',
      'idx_recipe_ingredients_ingredient',
      'idx_recipe_tags_recipe',
      'idx_recipe_tags_tag',
      'idx_plan_items_plan',
      'idx_plan_items_recipe',
      'idx_audit_log_timestamp',
      'idx_audit_log_actor',
      'idx_audit_log_entity',
    ];

    // Get all indexes
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    for (const index of expectedIndexes) {
      expect(indexNames).toContain(index);
    }
  } finally {
    closeDb(db);
  }
});

test('001_initial.sql creates FTS5 virtual table', () => {
  const db = getDb({ dbPath: ':memory:' });
  const migrationsDir = join(import.meta.dirname, '..', 'src', 'db', 'migrations');

  try {
    migrate(db, migrationsDir);

    // Check for FTS5 virtual table
    const ftsTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='recipes_fts'"
      )
      .get();

    expect(ftsTable).toBeDefined();
  } finally {
    closeDb(db);
  }
});

test('001_initial.sql creates FTS triggers', () => {
  const db = getDb({ dbPath: ':memory:' });
  const migrationsDir = join(import.meta.dirname, '..', 'src', 'db', 'migrations');

  try {
    migrate(db, migrationsDir);

    // Expected triggers
    const expectedTriggers = ['recipes_ai', 'recipes_ad', 'recipes_au'];

    // Get all triggers
    const triggers = db
      .prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
      .all() as Array<{ name: string }>;
    const triggerNames = triggers.map((t) => t.name);

    for (const trigger of expectedTriggers) {
      expect(triggerNames).toContain(trigger);
    }
  } finally {
    closeDb(db);
  }
});

test('FTS triggers work correctly for insert, update, delete', () => {
  const db = getDb({ dbPath: ':memory:' });
  const migrationsDir = join(import.meta.dirname, '..', 'src', 'db', 'migrations');

  try {
    migrate(db, migrationsDir);

    // Insert a recipe
    db.prepare(
      `INSERT INTO recipes (id, title, description, instructions)
       VALUES ('test-1', 'Spaghetti Carbonara', 'Classic Italian pasta dish', 'Cook pasta, add egg mixture')`
    ).run();

    // Search for it via FTS
    const searchResult = db
      .prepare("SELECT * FROM recipes_fts WHERE recipes_fts MATCH 'carbonara'")
      .all() as Array<{ title: string }>;
    expect(searchResult.length).toBe(1);

    // Update the recipe
    db.prepare(
      "UPDATE recipes SET title = 'Updated Carbonara' WHERE id = 'test-1'"
    ).run();

    // Search for updated title
    const updatedResult = db
      .prepare("SELECT * FROM recipes_fts WHERE recipes_fts MATCH 'updated'")
      .all() as Array<{ title: string }>;
    expect(updatedResult.length).toBe(1);

    // Old search should not find it
    const oldSearch = db
      .prepare("SELECT * FROM recipes_fts WHERE recipes_fts MATCH 'spaghetti'")
      .all();
    expect(oldSearch.length).toBe(0);

    // Delete the recipe
    db.prepare("DELETE FROM recipes WHERE id = 'test-1'").run();

    // FTS should be empty
    const afterDelete = db
      .prepare("SELECT * FROM recipes_fts WHERE recipes_fts MATCH 'carbonara'")
      .all();
    expect(afterDelete.length).toBe(0);
  } finally {
    closeDb(db);
  }
});
