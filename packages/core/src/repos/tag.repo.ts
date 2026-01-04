/**
 * Tag repository - CRUD operations for tags
 *
 * Handles the tags table with operations to create, lookup, and manage tags.
 * Tags have unique names, allowing lookup by name for user-friendly CLI usage.
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Tag, CreateTag, TagCategory } from '../models/tag.js';

/** Raw tag row from database */
interface TagRow {
  id: string;
  name: string;
  category: string | null;
}

/**
 * Convert database row to Tag model
 */
function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    category: row.category as TagCategory | null,
  };
}

export class TagRepository {
  constructor(private db: Database) {}

  /**
   * Create a new tag
   */
  create(data: CreateTag): Tag {
    const id = uuid();

    this.db
      .prepare(
        `INSERT INTO tags (id, name, category) VALUES (?, ?, ?)`
      )
      .run(id, data.name, data.category ?? null);

    return this.getById(id)!;
  }

  /**
   * Get a tag by ID
   */
  getById(id: string): Tag | null {
    const row = this.db
      .prepare('SELECT * FROM tags WHERE id = ?')
      .get(id) as TagRow | undefined;

    return row ? rowToTag(row) : null;
  }

  /**
   * Get a tag by name (case-insensitive)
   */
  getByName(name: string): Tag | null {
    const row = this.db
      .prepare('SELECT * FROM tags WHERE LOWER(name) = LOWER(?)')
      .get(name) as TagRow | undefined;

    return row ? rowToTag(row) : null;
  }

  /**
   * Get or create a tag by name.
   * If a tag with the given name exists, returns it.
   * Otherwise, creates a new tag with the given name and optional category.
   */
  getOrCreate(name: string, category?: TagCategory | null): Tag {
    const existing = this.getByName(name);
    if (existing) {
      return existing;
    }

    return this.create({
      name,
      category: category ?? 'custom',
    });
  }

  /**
   * Resolve multiple tag names to tag IDs.
   * Creates tags that don't exist.
   * Returns an array of tag IDs.
   */
  resolveTagNames(names: string[]): string[] {
    return names.map((name) => {
      const tag = this.getOrCreate(name);
      return tag.id;
    });
  }

  /**
   * List all tags, optionally filtered by category
   */
  list(category?: TagCategory): Tag[] {
    let sql = 'SELECT * FROM tags';
    const params: string[] = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name';

    const rows = this.db.prepare(sql).all(...params) as TagRow[];
    return rows.map(rowToTag);
  }

  /**
   * Delete a tag by ID
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Check if a tag exists by ID
   */
  exists(id: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM tags WHERE id = ?').get(id);
    return row !== undefined;
  }
}
