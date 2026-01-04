/**
 * Grocery list repository - CRUD operations for persistent grocery lists
 *
 * Handles grocery_lists and grocery_list_items tables.
 * Uses raw SQL with parameterized queries (no ORM).
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

/**
 * Item status in a grocery list
 */
export type GroceryItemStatus = 'need_to_buy' | 'already_have' | 'partial';

/**
 * A persistent grocery list
 */
export interface PersistedGroceryList {
  id: string;
  week: string;
  generatedAt: string | null;
  updatedAt: string | null;
}

/**
 * A persistent grocery list item
 */
export interface PersistedGroceryItem {
  id: string;
  groceryListId: string;
  ingredientId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  status: GroceryItemStatus;
  haveQuantity: number | null;
  isManual: boolean;
  recipes: string[];
}

/**
 * Input for creating a grocery list item
 */
export interface CreateGroceryItemInput {
  ingredientId?: string | null;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  status?: GroceryItemStatus;
  haveQuantity?: number | null;
  isManual?: boolean;
  recipes?: string[];
}

/**
 * Input for updating a grocery list item
 */
export interface UpdateGroceryItemInput {
  status?: GroceryItemStatus;
  haveQuantity?: number | null;
  quantity?: number | null;
  unit?: string | null;
}

/**
 * Raw grocery list row from database
 */
interface GroceryListRow {
  id: string;
  week: string;
  generated_at: string | null;
  updated_at: string | null;
}

/**
 * Raw grocery list item row from database
 */
interface GroceryListItemRow {
  id: string;
  grocery_list_id: string;
  ingredient_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  status: string;
  have_quantity: number | null;
  is_manual: number;
  recipes: string | null;
}

/**
 * Convert database row to PersistedGroceryList model
 */
function rowToGroceryList(row: GroceryListRow): PersistedGroceryList {
  return {
    id: row.id,
    week: row.week,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to PersistedGroceryItem model
 */
function rowToGroceryItem(row: GroceryListItemRow): PersistedGroceryItem {
  let recipes: string[] = [];
  if (row.recipes) {
    try {
      recipes = JSON.parse(row.recipes);
    } catch {
      recipes = [];
    }
  }
  return {
    id: row.id,
    groceryListId: row.grocery_list_id,
    ingredientId: row.ingredient_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    status: row.status as GroceryItemStatus,
    haveQuantity: row.have_quantity,
    isManual: row.is_manual === 1,
    recipes,
  };
}

/**
 * Grocery list with items
 */
export interface PersistedGroceryListWithItems extends PersistedGroceryList {
  items: PersistedGroceryItem[];
}

export class GroceryListRepository {
  constructor(private db: Database) {}

  /**
   * Create or get a grocery list for a week
   */
  getOrCreateByWeek(week: string): PersistedGroceryListWithItems {
    const existing = this.getByWeek(week);
    if (existing) {
      return existing;
    }

    const id = uuid();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO grocery_lists (id, week, generated_at, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(id, week, now, now);

    return this.getByWeek(week)!;
  }

  /**
   * Get a grocery list by week
   */
  getByWeek(week: string): PersistedGroceryListWithItems | null {
    const row = this.db
      .prepare('SELECT * FROM grocery_lists WHERE week = ?')
      .get(week) as GroceryListRow | undefined;

    if (!row) return null;

    const list = rowToGroceryList(row);
    const items = this.getItems(row.id);

    return {
      ...list,
      items,
    };
  }

  /**
   * Get a grocery list by ID
   */
  getById(id: string): PersistedGroceryListWithItems | null {
    const row = this.db
      .prepare('SELECT * FROM grocery_lists WHERE id = ?')
      .get(id) as GroceryListRow | undefined;

    if (!row) return null;

    const list = rowToGroceryList(row);
    const items = this.getItems(row.id);

    return {
      ...list,
      items,
    };
  }

  /**
   * Delete a grocery list by week
   */
  deleteByWeek(week: string): boolean {
    const result = this.db
      .prepare('DELETE FROM grocery_lists WHERE week = ?')
      .run(week);
    return result.changes > 0;
  }

  /**
   * Update the updated_at timestamp for a grocery list
   */
  touch(listId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE grocery_lists SET updated_at = ? WHERE id = ?')
      .run(now, listId);
  }

  /**
   * Set the generated_at timestamp for a grocery list
   */
  setGeneratedAt(listId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE grocery_lists SET generated_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, listId);
  }

  // ============================================
  // Item Methods
  // ============================================

  /**
   * Get all items for a grocery list
   */
  getItems(listId: string): PersistedGroceryItem[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM grocery_list_items WHERE grocery_list_id = ? ORDER BY name`
      )
      .all(listId) as GroceryListItemRow[];

    return rows.map(rowToGroceryItem);
  }

  /**
   * Get an item by ID
   */
  getItemById(itemId: string): PersistedGroceryItem | null {
    const row = this.db
      .prepare('SELECT * FROM grocery_list_items WHERE id = ?')
      .get(itemId) as GroceryListItemRow | undefined;

    if (!row) return null;
    return rowToGroceryItem(row);
  }

  /**
   * Find an item by name in a grocery list (case-insensitive)
   */
  findItemByName(listId: string, name: string): PersistedGroceryItem | null {
    const row = this.db
      .prepare(
        `SELECT * FROM grocery_list_items
         WHERE grocery_list_id = ? AND LOWER(name) = LOWER(?)`
      )
      .get(listId, name) as GroceryListItemRow | undefined;

    if (!row) return null;
    return rowToGroceryItem(row);
  }

  /**
   * Add an item to a grocery list
   */
  addItem(listId: string, input: CreateGroceryItemInput): PersistedGroceryItem {
    const id = uuid();
    const recipesJson = input.recipes ? JSON.stringify(input.recipes) : null;

    this.db
      .prepare(
        `INSERT INTO grocery_list_items
         (id, grocery_list_id, ingredient_id, name, quantity, unit, status, have_quantity, is_manual, recipes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        listId,
        input.ingredientId ?? null,
        input.name,
        input.quantity ?? null,
        input.unit ?? null,
        input.status ?? 'need_to_buy',
        input.haveQuantity ?? null,
        input.isManual ? 1 : 0,
        recipesJson
      );

    this.touch(listId);
    return this.getItemById(id)!;
  }

  /**
   * Update an item in a grocery list
   */
  updateItem(itemId: string, input: UpdateGroceryItemInput): PersistedGroceryItem | null {
    const existing = this.getItemById(itemId);
    if (!existing) return null;

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.haveQuantity !== undefined) {
      updates.push('have_quantity = ?');
      params.push(input.haveQuantity);
    }
    if (input.quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(input.quantity);
    }
    if (input.unit !== undefined) {
      updates.push('unit = ?');
      params.push(input.unit);
    }

    if (updates.length === 0) {
      return existing;
    }

    params.push(itemId);

    this.db
      .prepare(`UPDATE grocery_list_items SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    // Touch the parent list
    this.touch(existing.groceryListId);

    return this.getItemById(itemId);
  }

  /**
   * Delete an item from a grocery list
   */
  deleteItem(itemId: string): boolean {
    const existing = this.getItemById(itemId);
    if (!existing) return false;

    const result = this.db
      .prepare('DELETE FROM grocery_list_items WHERE id = ?')
      .run(itemId);

    if (result.changes > 0) {
      this.touch(existing.groceryListId);
    }

    return result.changes > 0;
  }

  /**
   * Clear all items from a grocery list (for regeneration)
   */
  clearItems(listId: string): void {
    this.db
      .prepare('DELETE FROM grocery_list_items WHERE grocery_list_id = ?')
      .run(listId);
    this.touch(listId);
  }

  /**
   * Clear only non-manual items (for regeneration while keeping manual adds)
   */
  clearNonManualItems(listId: string): void {
    this.db
      .prepare('DELETE FROM grocery_list_items WHERE grocery_list_id = ? AND is_manual = 0')
      .run(listId);
    this.touch(listId);
  }

  /**
   * Bulk add items to a grocery list
   */
  bulkAddItems(listId: string, items: CreateGroceryItemInput[]): PersistedGroceryItem[] {
    const stmt = this.db.prepare(
      `INSERT INTO grocery_list_items
       (id, grocery_list_id, ingredient_id, name, quantity, unit, status, have_quantity, is_manual, recipes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const ids: string[] = [];

    const insertMany = this.db.transaction((items: CreateGroceryItemInput[]) => {
      for (const input of items) {
        const id = uuid();
        const recipesJson = input.recipes ? JSON.stringify(input.recipes) : null;
        stmt.run(
          id,
          listId,
          input.ingredientId ?? null,
          input.name,
          input.quantity ?? null,
          input.unit ?? null,
          input.status ?? 'need_to_buy',
          input.haveQuantity ?? null,
          input.isManual ? 1 : 0,
          recipesJson
        );
        ids.push(id);
      }
    });

    insertMany(items);
    this.touch(listId);

    return ids.map((id) => this.getItemById(id)!);
  }

  /**
   * Mark an item as already_have
   */
  markAsHave(itemId: string): PersistedGroceryItem | null {
    return this.updateItem(itemId, { status: 'already_have' });
  }

  /**
   * Mark an item as partial with a have_quantity
   */
  markAsPartial(itemId: string, haveQuantity: number): PersistedGroceryItem | null {
    return this.updateItem(itemId, { status: 'partial', haveQuantity });
  }

  /**
   * Reset an item to need_to_buy
   */
  markAsNeedToBuy(itemId: string): PersistedGroceryItem | null {
    return this.updateItem(itemId, { status: 'need_to_buy', haveQuantity: null });
  }

  /**
   * Get items by status
   */
  getItemsByStatus(listId: string, status: GroceryItemStatus): PersistedGroceryItem[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM grocery_list_items
         WHERE grocery_list_id = ? AND status = ?
         ORDER BY name`
      )
      .all(listId, status) as GroceryListItemRow[];

    return rows.map(rowToGroceryItem);
  }

  /**
   * Count items by status
   */
  countByStatus(listId: string): { needToBuy: number; alreadyHave: number; partial: number } {
    const rows = this.db
      .prepare(
        `SELECT status, COUNT(*) as count
         FROM grocery_list_items
         WHERE grocery_list_id = ?
         GROUP BY status`
      )
      .all(listId) as Array<{ status: string; count: number }>;

    const counts = {
      needToBuy: 0,
      alreadyHave: 0,
      partial: 0,
    };

    for (const row of rows) {
      if (row.status === 'need_to_buy') counts.needToBuy = row.count;
      else if (row.status === 'already_have') counts.alreadyHave = row.count;
      else if (row.status === 'partial') counts.partial = row.count;
    }

    return counts;
  }
}
