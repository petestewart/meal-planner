/**
 * Database migration system for meal-planner
 *
 * Runs SQL migrations from a directory, tracking applied migrations
 * in a schema_migrations table. Each migration runs in a transaction.
 */

import type { Database } from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Row type for schema_migrations table */
interface MigrationRow {
  version: number;
  applied_at: string;
}

/**
 * Run all pending migrations from a directory.
 *
 * Migrations are SQL files named with a numeric prefix (e.g., 001_initial.sql).
 * The numeric prefix determines the version number and execution order.
 * Already-applied migrations are skipped.
 *
 * @param db - The database connection
 * @param migrationsDir - Path to the directory containing .sql migration files
 * @returns The number of migrations that were applied
 */
export function migrate(db: Database, migrationsDir: string): number {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get set of already-applied versions
  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as MigrationRow).version)
  );

  // Find all .sql files in migrations directory, sorted by name
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch (error) {
    // If directory doesn't exist, no migrations to run
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }
    throw error;
  }

  let appliedCount = 0;

  for (const file of files) {
    // Extract version number from filename (e.g., "001_initial.sql" -> 1)
    const versionMatch = file.match(/^(\d+)/);
    if (!versionMatch) {
      console.warn(`Skipping ${file}: no version number prefix`);
      continue;
    }

    const version = parseInt(versionMatch[1], 10);

    // Skip if already applied
    if (applied.has(version)) {
      continue;
    }

    // Read and execute migration in a transaction
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(
        version
      );
    })();

    console.log(`Applied migration ${file}`);
    appliedCount++;
  }

  return appliedCount;
}

/**
 * Get the list of applied migrations.
 *
 * @param db - The database connection
 * @returns Array of applied migration versions with timestamps
 */
export function getAppliedMigrations(
  db: Database
): Array<{ version: number; appliedAt: string }> {
  // Check if table exists first
  const tableExists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
    )
    .get();

  if (!tableExists) {
    return [];
  }

  const rows = db
    .prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version')
    .all() as MigrationRow[];

  return rows.map((row) => ({
    version: row.version,
    appliedAt: row.applied_at,
  }));
}

/**
 * Get the path to the default migrations directory.
 *
 * @returns Absolute path to packages/core/src/db/migrations/
 */
export function getDefaultMigrationsDir(): string {
  return join(import.meta.dirname ?? process.cwd(), 'migrations');
}
