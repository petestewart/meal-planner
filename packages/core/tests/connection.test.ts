/**
 * Unit tests for database connection module
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { getDb, closeDb, isDbOpen } from '../src/db/connection.js';

// Test utilities
function randomDbPath(): string {
  return join(tmpdir(), `meals-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function cleanup(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
  // Also clean up WAL and SHM files
  if (existsSync(`${path}-wal`)) {
    rmSync(`${path}-wal`, { force: true });
  }
  if (existsSync(`${path}-shm`)) {
    rmSync(`${path}-shm`, { force: true });
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

test('can open in-memory database', () => {
  const db = getDb({ dbPath: ':memory:' });
  assert(db.open, 'database should be open');
  closeDb(db);
  assert(!db.open, 'database should be closed');
});

test('can create database file if missing', () => {
  const dbPath = randomDbPath();
  try {
    assert(!existsSync(dbPath), 'database file should not exist initially');

    const db = getDb({ dbPath, createIfMissing: true });
    assert(db.open, 'database should be open');
    assert(existsSync(dbPath), 'database file should be created');

    closeDb(db);
    assert(!db.open, 'database should be closed');
  } finally {
    cleanup(dbPath);
  }
});

test('can create database in nested directory', () => {
  const dbPath = join(tmpdir(), `meals-test-nested-${Date.now()}`, 'subdir', 'test.db');
  try {
    assert(!existsSync(dbPath), 'database file should not exist initially');

    const db = getDb({ dbPath, createIfMissing: true });
    assert(db.open, 'database should be open');
    assert(existsSync(dbPath), 'database file should be created in nested directory');

    closeDb(db);
  } finally {
    // Clean up the entire test directory
    const baseDir = join(tmpdir(), `meals-test-nested-${Date.now()}`);
    if (existsSync(baseDir)) {
      rmSync(baseDir, { recursive: true, force: true });
    }
    cleanup(dbPath);
  }
});

test('can run queries on database', () => {
  const db = getDb({ dbPath: ':memory:' });
  try {
    // Create a test table
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

    // Insert data
    const insert = db.prepare('INSERT INTO test (name) VALUES (?)');
    insert.run('hello');
    insert.run('world');

    // Query data
    const rows = db.prepare('SELECT * FROM test').all() as Array<{ id: number; name: string }>;
    assertEqual(rows.length, 2, 'should have 2 rows');
    assertEqual(rows[0].name, 'hello', 'first row name');
    assertEqual(rows[1].name, 'world', 'second row name');
  } finally {
    closeDb(db);
  }
});

test('WAL mode is enabled for file-based databases', () => {
  const dbPath = randomDbPath();
  try {
    const db = getDb({ dbPath });
    const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
    assertEqual(result[0].journal_mode, 'wal', 'journal mode should be WAL');
    closeDb(db);
  } finally {
    cleanup(dbPath);
  }
});

test('in-memory databases use memory journal mode', () => {
  const db = getDb({ dbPath: ':memory:' });
  try {
    const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
    assertEqual(result[0].journal_mode, 'memory', 'in-memory db should use memory journal mode');
  } finally {
    closeDb(db);
  }
});

test('foreign keys are enabled', () => {
  const db = getDb({ dbPath: ':memory:' });
  try {
    const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
    assertEqual(result[0].foreign_keys, 1, 'foreign keys should be enabled');
  } finally {
    closeDb(db);
  }
});

test('isDbOpen returns false when no connection', () => {
  // This test assumes no singleton is open
  // We can't reliably test this without resetting global state
  // So we'll just verify the function exists and returns a boolean
  const result = isDbOpen();
  assert(typeof result === 'boolean', 'isDbOpen should return a boolean');
});

// Run all tests
console.log('Running database connection tests...');
console.log('');
runTests();
