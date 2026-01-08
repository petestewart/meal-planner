/**
 * Substitution repository - CRUD operations for ingredient substitutions
 *
 * Handles the substitutions table with operations to create, update, delete,
 * and query ingredient substitutions. Supports filtering by dietary tags
 * and distinguishes between system-defined and user-defined substitutions.
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type {
  Substitution,
  CreateSubstitution,
  UpdateSubstitution,
} from '../models/substitution.js';

/** Raw substitution row from database */
interface SubstitutionRow {
  id: string;
  original_ingredient: string;
  substitute_ingredients: string;
  substitute_description: string | null;
  dietary_tags: string | null; // JSON string
  is_user_defined: number | null; // SQLite stores booleans as 0/1
  created_at: string;
}

/**
 * Convert database row to Substitution model
 */
function rowToSubstitution(row: SubstitutionRow): Substitution {
  let dietaryTags: string[] = [];
  if (row.dietary_tags) {
    try {
      dietaryTags = JSON.parse(row.dietary_tags);
    } catch {
      dietaryTags = [];
    }
  }

  return {
    id: row.id,
    originalIngredient: row.original_ingredient,
    substituteIngredients: row.substitute_ingredients,
    substituteDescription: row.substitute_description,
    dietaryTags,
    isUserDefined: Boolean(row.is_user_defined),
    createdAt: row.created_at,
  };
}

/**
 * Options for listing substitutions
 */
export interface ListSubstitutionsOptions {
  originalIngredient?: string;
  dietaryTag?: string;
  isUserDefined?: boolean;
}

export class SubstitutionRepository {
  constructor(private db: Database) {}

  /**
   * Create a new substitution
   */
  create(data: CreateSubstitution): Substitution {
    const id = uuid();
    const now = new Date().toISOString();
    const dietaryTagsJson = JSON.stringify(data.dietaryTags ?? []);

    this.db
      .prepare(
        `INSERT INTO substitutions (
          id, original_ingredient, substitute_ingredients, substitute_description,
          dietary_tags, is_user_defined, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.originalIngredient.toLowerCase(),
        data.substituteIngredients,
        data.substituteDescription ?? null,
        dietaryTagsJson,
        data.isUserDefined ? 1 : 0,
        now
      );

    return this.getById(id)!;
  }

  /**
   * Get a substitution by ID
   */
  getById(id: string): Substitution | null {
    const row = this.db
      .prepare('SELECT * FROM substitutions WHERE id = ?')
      .get(id) as SubstitutionRow | undefined;

    return row ? rowToSubstitution(row) : null;
  }

  /**
   * Find substitutions for a specific ingredient (case-insensitive)
   */
  findByIngredient(ingredientName: string): Substitution[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM substitutions
         WHERE LOWER(original_ingredient) = LOWER(?)
         ORDER BY is_user_defined DESC, created_at DESC`
      )
      .all(ingredientName) as SubstitutionRow[];

    return rows.map(rowToSubstitution);
  }

  /**
   * Find substitutions with a specific dietary tag
   */
  findByDietaryTag(tag: string): Substitution[] {
    // Use JSON contains pattern for SQLite
    const rows = this.db
      .prepare(
        `SELECT * FROM substitutions
         WHERE dietary_tags LIKE ?
         ORDER BY original_ingredient, created_at DESC`
      )
      .all(`%"${tag}"%`) as SubstitutionRow[];

    return rows.map(rowToSubstitution);
  }

  /**
   * List all substitutions with optional filtering
   */
  list(options?: ListSubstitutionsOptions): Substitution[] {
    let sql = 'SELECT * FROM substitutions WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.originalIngredient) {
      sql += ' AND LOWER(original_ingredient) = LOWER(?)';
      params.push(options.originalIngredient);
    }

    if (options?.dietaryTag) {
      sql += ' AND dietary_tags LIKE ?';
      params.push(`%"${options.dietaryTag}"%`);
    }

    if (options?.isUserDefined !== undefined) {
      sql += ' AND is_user_defined = ?';
      params.push(options.isUserDefined ? 1 : 0);
    }

    sql += ' ORDER BY original_ingredient, is_user_defined DESC, created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as SubstitutionRow[];
    return rows.map(rowToSubstitution);
  }

  /**
   * Update a substitution
   */
  update(data: UpdateSubstitution): Substitution | null {
    const existing = this.getById(data.id);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.substituteIngredients !== undefined) {
      updates.push('substitute_ingredients = ?');
      params.push(data.substituteIngredients);
    }

    if (data.substituteDescription !== undefined) {
      updates.push('substitute_description = ?');
      params.push(data.substituteDescription);
    }

    if (data.dietaryTags !== undefined) {
      updates.push('dietary_tags = ?');
      params.push(JSON.stringify(data.dietaryTags));
    }

    if (updates.length === 0) {
      return existing;
    }

    params.push(data.id);

    this.db
      .prepare(`UPDATE substitutions SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    return this.getById(data.id);
  }

  /**
   * Delete a substitution by ID
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM substitutions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Delete all user-defined substitutions for an ingredient
   */
  deleteUserDefinedByIngredient(ingredientName: string): number {
    const result = this.db
      .prepare(
        `DELETE FROM substitutions
         WHERE LOWER(original_ingredient) = LOWER(?)
         AND is_user_defined = 1`
      )
      .run(ingredientName);
    return result.changes;
  }

  /**
   * Check if a substitution exists for an ingredient
   */
  exists(originalIngredient: string): boolean {
    const row = this.db
      .prepare(
        'SELECT 1 FROM substitutions WHERE LOWER(original_ingredient) = LOWER(?)'
      )
      .get(originalIngredient);
    return row !== undefined;
  }

  /**
   * Get all unique original ingredients that have substitutions
   */
  getOriginalIngredients(): string[] {
    const rows = this.db
      .prepare(
        'SELECT DISTINCT original_ingredient FROM substitutions ORDER BY original_ingredient'
      )
      .all() as { original_ingredient: string }[];

    return rows.map(row => row.original_ingredient);
  }

  /**
   * Search for substitutions by ingredient name (partial match)
   */
  search(query: string): Substitution[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM substitutions
         WHERE LOWER(original_ingredient) LIKE LOWER(?)
         ORDER BY original_ingredient, is_user_defined DESC, created_at DESC`
      )
      .all(`%${query}%`) as SubstitutionRow[];

    return rows.map(rowToSubstitution);
  }
}
