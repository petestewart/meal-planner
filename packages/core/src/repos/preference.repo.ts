/**
 * Preference repository - CRUD operations for user preferences
 *
 * Handles the preferences table which stores key-value pairs
 * with JSON-encoded values.
 * Uses raw SQL with parameterized queries (no ORM).
 */

import type { Database } from 'better-sqlite3';
import type { PreferenceKey } from '../models/index.js';

/**
 * Raw preference row from database.
 */
interface PreferenceRow {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * Preference data as returned by the repository.
 */
export interface PreferenceData {
  key: PreferenceKey;
  value: unknown;
  updatedAt: string;
}

/**
 * Convert database row to preference data.
 */
function rowToPreference(row: PreferenceRow): PreferenceData {
  return {
    key: row.key as PreferenceKey,
    value: JSON.parse(row.value),
    updatedAt: row.updated_at,
  };
}

export class PreferenceRepository {
  constructor(private db: Database) {}

  /**
   * Get a preference by key.
   * Returns null if not found.
   */
  get(key: PreferenceKey): PreferenceData | null {
    const row = this.db
      .prepare('SELECT * FROM preferences WHERE key = ?')
      .get(key) as PreferenceRow | undefined;

    if (!row) return null;

    return rowToPreference(row);
  }

  /**
   * Get all preferences.
   * Returns an array of all stored preferences.
   */
  getAll(): PreferenceData[] {
    const rows = this.db
      .prepare('SELECT * FROM preferences ORDER BY key')
      .all() as PreferenceRow[];

    return rows.map(rowToPreference);
  }

  /**
   * Set a preference value.
   * Creates or updates the preference (upsert).
   * Returns the saved preference.
   */
  set(key: PreferenceKey, value: unknown): PreferenceData {
    const now = new Date().toISOString();
    const valueJson = JSON.stringify(value);

    this.db
      .prepare(
        `
        INSERT INTO preferences (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `
      )
      .run(key, valueJson, now);

    return this.get(key)!;
  }

  /**
   * Delete a preference by key.
   * Returns true if deleted, false if not found.
   */
  delete(key: PreferenceKey): boolean {
    const result = this.db
      .prepare('DELETE FROM preferences WHERE key = ?')
      .run(key);

    return result.changes > 0;
  }

  /**
   * Check if a preference exists.
   */
  exists(key: PreferenceKey): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM preferences WHERE key = ?')
      .get(key);

    return row !== undefined;
  }

  /**
   * Clear all preferences.
   * Returns the number of preferences deleted.
   */
  clearAll(): number {
    const result = this.db.prepare('DELETE FROM preferences').run();
    return result.changes;
  }

  /**
   * Set multiple preferences at once.
   * Uses a transaction for atomicity.
   * Returns all saved preferences.
   */
  setMany(preferences: Record<PreferenceKey, unknown>): PreferenceData[] {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO preferences (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `);

      for (const [key, value] of Object.entries(preferences)) {
        stmt.run(key, JSON.stringify(value), now);
      }
    })();

    return this.getAll();
  }
}
