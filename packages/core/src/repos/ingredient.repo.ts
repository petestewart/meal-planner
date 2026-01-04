/**
 * Ingredient repository - CRUD operations for ingredients
 *
 * Handles the ingredients table with operations to create, lookup, and manage ingredients.
 * Ingredients have unique names, allowing lookup by name for user-friendly CLI usage.
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Ingredient, CreateIngredient } from '../models/ingredient.js';

/** Raw ingredient row from database */
interface IngredientRow {
  id: string;
  name: string;
  category: string | null;
  default_unit: string | null;
}

/**
 * Convert database row to Ingredient model
 */
function rowToIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    defaultUnit: row.default_unit,
  };
}

export class IngredientRepository {
  constructor(private db: Database) {}

  /**
   * Create a new ingredient
   */
  create(data: CreateIngredient): Ingredient {
    const id = uuid();

    this.db
      .prepare(
        `INSERT INTO ingredients (id, name, category, default_unit) VALUES (?, ?, ?, ?)`
      )
      .run(id, data.name, data.category ?? null, data.defaultUnit ?? null);

    return this.getById(id)!;
  }

  /**
   * Get an ingredient by ID
   */
  getById(id: string): Ingredient | null {
    const row = this.db
      .prepare('SELECT * FROM ingredients WHERE id = ?')
      .get(id) as IngredientRow | undefined;

    return row ? rowToIngredient(row) : null;
  }

  /**
   * Get an ingredient by name (case-insensitive)
   */
  getByName(name: string): Ingredient | null {
    const row = this.db
      .prepare('SELECT * FROM ingredients WHERE LOWER(name) = LOWER(?)')
      .get(name) as IngredientRow | undefined;

    return row ? rowToIngredient(row) : null;
  }

  /**
   * Get or create an ingredient by name.
   * If an ingredient with the given name exists, returns it.
   * Otherwise, creates a new ingredient with the given name.
   */
  getOrCreate(name: string, category?: string | null, defaultUnit?: string | null): Ingredient {
    const existing = this.getByName(name);
    if (existing) {
      return existing;
    }

    return this.create({
      name,
      category: category ?? null,
      defaultUnit: defaultUnit ?? null,
    });
  }

  /**
   * Resolve multiple ingredient names to ingredient IDs.
   * Creates ingredients that don't exist.
   * Returns an array of ingredient IDs.
   */
  resolveIngredientNames(names: string[]): string[] {
    return names.map((name) => {
      const ingredient = this.getOrCreate(name);
      return ingredient.id;
    });
  }

  /**
   * List all ingredients, optionally filtered by category
   */
  list(category?: string): Ingredient[] {
    let sql = 'SELECT * FROM ingredients';
    const params: string[] = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name';

    const rows = this.db.prepare(sql).all(...params) as IngredientRow[];
    return rows.map(rowToIngredient);
  }

  /**
   * Delete an ingredient by ID
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Check if an ingredient exists by ID
   */
  exists(id: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM ingredients WHERE id = ?').get(id);
    return row !== undefined;
  }
}
