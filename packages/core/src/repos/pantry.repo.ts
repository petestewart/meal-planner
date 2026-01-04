/**
 * Pantry repository - CRUD operations for pantry items
 *
 * Handles the pantry_items table with operations to create, update, delete,
 * and query pantry items. Supports expiration tracking, location filtering,
 * and staple item management.
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type {
  PantryItem,
  PantryItemWithIngredient,
  CreatePantryItem,
  UpdatePantryItem,
  PantryLocation,
} from '../models/pantry.js';

/** Raw pantry item row from database */
interface PantryItemRow {
  id: string;
  ingredient_id: string;
  quantity: number | null;
  unit: string | null;
  expires_at: string | null;
  updated_at: string;
  is_prepared: number | null; // SQLite stores booleans as 0/1
  preparation_notes: string | null;
  location: string | null;
  is_staple: number | null;
}

/** Extended row with joined ingredient data */
interface PantryItemWithIngredientRow extends PantryItemRow {
  ingredient_name: string;
  ingredient_category: string | null;
}

/**
 * Convert database row to PantryItem model
 */
function rowToPantryItem(row: PantryItemRow): PantryItem {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    quantity: row.quantity,
    unit: row.unit,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    isPrepared: Boolean(row.is_prepared),
    preparationNotes: row.preparation_notes,
    location: row.location as PantryLocation | null,
    isStaple: Boolean(row.is_staple),
  };
}

/**
 * Convert extended database row to PantryItemWithIngredient model
 */
function rowToPantryItemWithIngredient(row: PantryItemWithIngredientRow): PantryItemWithIngredient {
  return {
    ...rowToPantryItem(row),
    ingredientName: row.ingredient_name,
    ingredientCategory: row.ingredient_category,
  };
}

/**
 * Options for listing pantry items
 */
export interface ListPantryItemsOptions {
  location?: PantryLocation;
  isPrepared?: boolean;
  isStaple?: boolean;
  expiringWithinDays?: number;
}

export class PantryRepository {
  constructor(private db: Database) {}

  /**
   * Create a new pantry item
   */
  create(data: CreatePantryItem): PantryItem {
    const id = uuid();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO pantry_items (
          id, ingredient_id, quantity, unit, expires_at, updated_at,
          is_prepared, preparation_notes, location, is_staple
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.ingredientId,
        data.quantity ?? null,
        data.unit ?? null,
        data.expiresAt ?? null,
        now,
        data.isPrepared ? 1 : 0,
        data.preparationNotes ?? null,
        data.location ?? null,
        data.isStaple ? 1 : 0
      );

    return this.getById(id)!;
  }

  /**
   * Get a pantry item by ID
   */
  getById(id: string): PantryItem | null {
    const row = this.db
      .prepare('SELECT * FROM pantry_items WHERE id = ?')
      .get(id) as PantryItemRow | undefined;

    return row ? rowToPantryItem(row) : null;
  }

  /**
   * Get a pantry item by ID with ingredient details
   */
  getByIdWithIngredient(id: string): PantryItemWithIngredient | null {
    const row = this.db
      .prepare(
        `SELECT p.*, i.name as ingredient_name, i.category as ingredient_category
         FROM pantry_items p
         JOIN ingredients i ON p.ingredient_id = i.id
         WHERE p.id = ?`
      )
      .get(id) as PantryItemWithIngredientRow | undefined;

    return row ? rowToPantryItemWithIngredient(row) : null;
  }

  /**
   * Get a pantry item by ingredient ID
   */
  getByIngredientId(ingredientId: string): PantryItem | null {
    const row = this.db
      .prepare('SELECT * FROM pantry_items WHERE ingredient_id = ?')
      .get(ingredientId) as PantryItemRow | undefined;

    return row ? rowToPantryItem(row) : null;
  }

  /**
   * Get a pantry item by ingredient name (case-insensitive)
   */
  getByIngredientName(name: string): PantryItemWithIngredient | null {
    const row = this.db
      .prepare(
        `SELECT p.*, i.name as ingredient_name, i.category as ingredient_category
         FROM pantry_items p
         JOIN ingredients i ON p.ingredient_id = i.id
         WHERE LOWER(i.name) = LOWER(?)`
      )
      .get(name) as PantryItemWithIngredientRow | undefined;

    return row ? rowToPantryItemWithIngredient(row) : null;
  }

  /**
   * List all pantry items with ingredient details
   */
  list(options?: ListPantryItemsOptions): PantryItemWithIngredient[] {
    let sql = `
      SELECT p.*, i.name as ingredient_name, i.category as ingredient_category
      FROM pantry_items p
      JOIN ingredients i ON p.ingredient_id = i.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.location) {
      sql += ' AND p.location = ?';
      params.push(options.location);
    }

    if (options?.isPrepared !== undefined) {
      sql += ' AND p.is_prepared = ?';
      params.push(options.isPrepared ? 1 : 0);
    }

    if (options?.isStaple !== undefined) {
      sql += ' AND p.is_staple = ?';
      params.push(options.isStaple ? 1 : 0);
    }

    if (options?.expiringWithinDays !== undefined) {
      // Calculate cutoff date
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + options.expiringWithinDays);
      const cutoffStr = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD
      sql += ' AND p.expires_at IS NOT NULL AND p.expires_at <= ?';
      params.push(cutoffStr);
    }

    sql += ' ORDER BY i.name';

    const rows = this.db.prepare(sql).all(...params) as PantryItemWithIngredientRow[];
    return rows.map(rowToPantryItemWithIngredient);
  }

  /**
   * List items expiring within a number of days
   */
  listExpiring(days: number = 7): PantryItemWithIngredient[] {
    return this.list({ expiringWithinDays: days });
  }

  /**
   * List staple items
   */
  listStaples(): PantryItemWithIngredient[] {
    return this.list({ isStaple: true });
  }

  /**
   * Update a pantry item
   */
  update(id: string, data: UpdatePantryItem): PantryItem | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(data.quantity);
    }

    if (data.unit !== undefined) {
      updates.push('unit = ?');
      params.push(data.unit);
    }

    if (data.expiresAt !== undefined) {
      updates.push('expires_at = ?');
      params.push(data.expiresAt);
    }

    if (data.isPrepared !== undefined) {
      updates.push('is_prepared = ?');
      params.push(data.isPrepared ? 1 : 0);
    }

    if (data.preparationNotes !== undefined) {
      updates.push('preparation_notes = ?');
      params.push(data.preparationNotes);
    }

    if (data.location !== undefined) {
      updates.push('location = ?');
      params.push(data.location);
    }

    if (data.isStaple !== undefined) {
      updates.push('is_staple = ?');
      params.push(data.isStaple ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    // Always update updated_at
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    this.db
      .prepare(`UPDATE pantry_items SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    return this.getById(id);
  }

  /**
   * Use (decrement) quantity of a pantry item
   * Returns the updated item or null if not found
   */
  use(id: string, amount: number): PantryItem | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const currentQty = existing.quantity ?? 0;
    const newQty = Math.max(0, currentQty - amount);

    return this.update(id, { quantity: newQty });
  }

  /**
   * Use (decrement) quantity of a pantry item by ingredient name
   */
  useByIngredientName(name: string, amount: number): PantryItemWithIngredient | null {
    const existing = this.getByIngredientName(name);
    if (!existing) {
      return null;
    }

    const currentQty = existing.quantity ?? 0;
    const newQty = Math.max(0, currentQty - amount);

    this.update(existing.id, { quantity: newQty });
    return this.getByIngredientName(name);
  }

  /**
   * Delete a pantry item by ID
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM pantry_items WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Delete a pantry item by ingredient name
   */
  deleteByIngredientName(name: string): boolean {
    const result = this.db
      .prepare(
        `DELETE FROM pantry_items
         WHERE ingredient_id IN (
           SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?)
         )`
      )
      .run(name);
    return result.changes > 0;
  }

  /**
   * Check if an ingredient exists in pantry
   */
  exists(ingredientId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM pantry_items WHERE ingredient_id = ?')
      .get(ingredientId);
    return row !== undefined;
  }

  /**
   * Get all pantry items that match ingredient IDs
   * Used for checking grocery list against pantry
   */
  getByIngredientIds(ingredientIds: string[]): PantryItem[] {
    if (ingredientIds.length === 0) {
      return [];
    }

    const placeholders = ingredientIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT * FROM pantry_items WHERE ingredient_id IN (${placeholders})`)
      .all(...ingredientIds) as PantryItemRow[];

    return rows.map(rowToPantryItem);
  }

  /**
   * Get pantry quantities by ingredient ID
   * Returns a map of ingredientId -> { quantity, unit }
   */
  getPantryQuantities(): Map<string, { quantity: number; unit: string | null }> {
    const rows = this.db
      .prepare('SELECT ingredient_id, quantity, unit FROM pantry_items')
      .all() as { ingredient_id: string; quantity: number | null; unit: string | null }[];

    const map = new Map<string, { quantity: number; unit: string | null }>();
    for (const row of rows) {
      if (row.quantity !== null && row.quantity > 0) {
        map.set(row.ingredient_id, {
          quantity: row.quantity,
          unit: row.unit,
        });
      }
    }
    return map;
  }
}
