/**
 * SQLite database connection module using better-sqlite3
 *
 * Provides a singleton database connection with automatic file creation
 * if the database file does not exist.
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Default database path relative to project root */
const DEFAULT_DB_PATH = resolve(
  import.meta.dirname ?? process.cwd(),
  '../../../data/meals.db'
);

/** Singleton database instance */
let dbInstance: DatabaseType | null = null;

/** Options for database connection */
export interface DbOptions {
  /** Path to the database file. Use ':memory:' for in-memory database */
  dbPath?: string;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
  /** Create the database file and parent directories if they don't exist */
  createIfMissing?: boolean;
}

/**
 * Get a database connection.
 *
 * If no connection exists, creates one. Uses the provided path or defaults
 * to data/meals.db. Creates the database file and parent directories if
 * they don't exist.
 *
 * @param options - Connection options
 * @returns The database connection
 */
export function getDb(options: DbOptions = {}): DatabaseType {
  const {
    dbPath = DEFAULT_DB_PATH,
    verbose = false,
    createIfMissing = true,
  } = options;

  // Return existing instance if available and using default path
  if (dbInstance && dbPath === DEFAULT_DB_PATH) {
    return dbInstance;
  }

  // Ensure parent directory exists (unless in-memory)
  if (dbPath !== ':memory:' && createIfMissing) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Create database connection
  const db = new Database(dbPath, {
    verbose: verbose ? console.log : undefined,
  });

  // Enable WAL mode for better concurrency (file-based databases only)
  // In-memory databases don't support WAL mode
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Store as singleton if using default path
  if (dbPath === DEFAULT_DB_PATH) {
    dbInstance = db;
  }

  return db;
}

/**
 * Close the database connection.
 *
 * @param db - Optional specific database to close. If not provided,
 *             closes the singleton instance.
 */
export function closeDb(db?: DatabaseType): void {
  if (db) {
    db.close();
    if (db === dbInstance) {
      dbInstance = null;
    }
  } else if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Check if a database connection is currently open.
 *
 * @returns true if the singleton database connection is open
 */
export function isDbOpen(): boolean {
  return dbInstance !== null && dbInstance.open;
}

// Re-export Database type for consumers
export type { DatabaseType as Database };
