/**
 * Unit tests for database migration system
 */

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

// Test runner (simple, no dependencies)
interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
}

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

async function runTests(): Promise<void> {
  const results: TestResult[] = [];

  for (const { name, fn } of tests) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`  PASS: ${name}`);
    } catch (error) {
      results.push({ name, passed: false, error: error as Error });
      console.log(`  FAIL: ${name}`);
      console.log(`        ${(error as Error).message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Assertions
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// Tests

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

    assert(tableExists !== undefined, 'schema_migrations table should exist');
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

    assertEqual(applied, 2, 'should apply 2 migrations');

    // Verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    assert(tableNames.includes('first_table'), 'first_table should exist');
    assert(tableNames.includes('second_table'), 'second_table should exist');
    assert(
      tableNames.includes('schema_migrations'),
      'schema_migrations should exist'
    );
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
    assertEqual(firstRun, 1, 'first run should apply 1 migration');

    // Second run - should skip
    const secondRun = migrate(db, tmpDir);
    assertEqual(secondRun, 0, 'second run should apply 0 migrations');

    // Verify only one entry in schema_migrations
    const migrations = getAppliedMigrations(db);
    assertEqual(migrations.length, 1, 'should have 1 migration record');
    assertEqual(migrations[0].version, 1, 'version should be 1');
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

    let errorThrown = false;
    try {
      migrate(db, tmpDir);
    } catch {
      errorThrown = true;
    }

    assert(errorThrown, 'should throw error on bad migration');

    // Verify table was NOT created (rolled back)
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='good_table'"
      )
      .get();

    assert(tableExists === undefined, 'good_table should not exist (rolled back)');

    // Verify no migration was recorded
    const migrations = getAppliedMigrations(db);
    assertEqual(migrations.length, 0, 'should have 0 migration records');
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
    assertEqual(applied, 0, 'should apply 0 migrations for missing dir');
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
    assertEqual(applied, 1, 'should only apply 1 migration');

    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='should_not_exist'"
      )
      .get();

    assert(
      tableExists === undefined,
      'table from non-prefixed file should not exist'
    );
  } finally {
    closeDb(db);
    cleanupDir(tmpDir);
  }
});

test('getAppliedMigrations returns empty array when table does not exist', () => {
  const db = getDb({ dbPath: ':memory:' });

  try {
    const migrations = getAppliedMigrations(db);
    assertEqual(migrations.length, 0, 'should return empty array');
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
    assertEqual(migrations.length, 3, 'should have 3 migrations');
    assertEqual(migrations[0].version, 1, 'first should be version 1');
    assertEqual(migrations[1].version, 2, 'second should be version 2');
    assertEqual(migrations[2].version, 3, 'third should be version 3');

    // Verify appliedAt is a valid timestamp
    assert(
      migrations[0].appliedAt.match(/^\d{4}-\d{2}-\d{2}/) !== null,
      'appliedAt should be a valid date string'
    );
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
    assert(applied >= 1, 'should apply at least 1 migration');

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
      assert(tableNames.includes(table), `table '${table}' should exist`);
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
      assert(indexNames.includes(index), `index '${index}' should exist`);
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

    assert(ftsTable !== undefined, 'recipes_fts virtual table should exist');
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
      assert(triggerNames.includes(trigger), `trigger '${trigger}' should exist`);
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
    assertEqual(searchResult.length, 1, 'should find 1 result after insert');

    // Update the recipe
    db.prepare(
      "UPDATE recipes SET title = 'Updated Carbonara' WHERE id = 'test-1'"
    ).run();

    // Search for updated title
    const updatedResult = db
      .prepare("SELECT * FROM recipes_fts WHERE recipes_fts MATCH 'updated'")
      .all() as Array<{ title: string }>;
    assertEqual(updatedResult.length, 1, 'should find 1 result after update');

    // Old search should not find it
    const oldSearch = db
      .prepare("SELECT * FROM recipes_fts WHERE recipes_fts MATCH 'spaghetti'")
      .all();
    assertEqual(oldSearch.length, 0, 'should not find old title after update');

    // Delete the recipe
    db.prepare("DELETE FROM recipes WHERE id = 'test-1'").run();

    // FTS should be empty
    const afterDelete = db
      .prepare("SELECT * FROM recipes_fts WHERE recipes_fts MATCH 'carbonara'")
      .all();
    assertEqual(afterDelete.length, 0, 'should not find result after delete');
  } finally {
    closeDb(db);
  }
});

// Run all tests
console.log('Running migration system tests...');
console.log('');
runTests();
