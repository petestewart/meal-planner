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

// Run all tests
console.log('Running migration system tests...');
console.log('');
runTests();
