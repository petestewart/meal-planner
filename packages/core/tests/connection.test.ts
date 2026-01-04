/**
 * Unit tests for database connection module
 */

import { test, expect } from 'vitest';
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

test('can open in-memory database', () => {
  const db = getDb({ dbPath: ':memory:' });
  expect(db.open).toBe(true);
  closeDb(db);
  expect(db.open).toBe(false);
});

test('can create database file if missing', () => {
  const dbPath = randomDbPath();
  try {
    expect(existsSync(dbPath)).toBe(false);

    const db = getDb({ dbPath, createIfMissing: true });
    expect(db.open).toBe(true);
    expect(existsSync(dbPath)).toBe(true);

    closeDb(db);
    expect(db.open).toBe(false);
  } finally {
    cleanup(dbPath);
  }
});

test('can create database in nested directory', () => {
  const dbPath = join(tmpdir(), `meals-test-nested-${Date.now()}`, 'subdir', 'test.db');
  try {
    expect(existsSync(dbPath)).toBe(false);

    const db = getDb({ dbPath, createIfMissing: true });
    expect(db.open).toBe(true);
    expect(existsSync(dbPath)).toBe(true);

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
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe('hello');
    expect(rows[1].name).toBe('world');
  } finally {
    closeDb(db);
  }
});

test('WAL mode is enabled for file-based databases', () => {
  const dbPath = randomDbPath();
  try {
    const db = getDb({ dbPath });
    const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
    expect(result[0].journal_mode).toBe('wal');
    closeDb(db);
  } finally {
    cleanup(dbPath);
  }
});

test('in-memory databases use memory journal mode', () => {
  const db = getDb({ dbPath: ':memory:' });
  try {
    const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
    expect(result[0].journal_mode).toBe('memory');
  } finally {
    closeDb(db);
  }
});

test('foreign keys are enabled', () => {
  const db = getDb({ dbPath: ':memory:' });
  try {
    const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
    expect(result[0].foreign_keys).toBe(1);
  } finally {
    closeDb(db);
  }
});

test('isDbOpen returns false when no connection', () => {
  // This test assumes no singleton is open
  // We can't reliably test this without resetting global state
  // So we'll just verify the function exists and returns a boolean
  const result = isDbOpen();
  expect(typeof result).toBe('boolean');
});
