/**
 * PrepBatch repository - CRUD operations for prep batches
 *
 * Handles prep_batches table for batch cooking and meal prep tracking.
 * Uses raw SQL with parameterized queries (no ORM).
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type {
  PrepBatch,
  CreatePrepBatch,
  UpdatePrepBatch,
  PrepBatchWithRecipe,
  PrepBatchWithRemaining,
} from '../models/index.js';

/** Raw prep batch row from database */
interface PrepBatchRow {
  id: string;
  recipe_id: string;
  prep_date: string;
  total_servings: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Raw prep batch row with recipe title joined */
interface PrepBatchWithRecipeRow extends PrepBatchRow {
  recipe_title: string | null;
}

/** Options for listing prep batches */
export interface ListPrepBatchesOptions {
  /** Filter by recipe ID */
  recipeId?: string;
  /** Filter by date (ISO date string YYYY-MM-DD) */
  prepDate?: string;
  /** Filter batches with remaining servings > 0 */
  hasRemaining?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Convert database row to PrepBatch model
 */
function rowToPrepBatch(row: PrepBatchRow): PrepBatch {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    prepDate: row.prep_date,
    totalServings: row.total_servings,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to PrepBatchWithRecipe model
 */
function rowToPrepBatchWithRecipe(row: PrepBatchWithRecipeRow): PrepBatchWithRecipe {
  return {
    ...rowToPrepBatch(row),
    recipeTitle: row.recipe_title ?? undefined,
  };
}

export class PrepBatchRepository {
  constructor(private db: Database) {}

  /**
   * Create a new prep batch
   */
  create(data: CreatePrepBatch): PrepBatch {
    const id = uuid();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO prep_batches (id, recipe_id, prep_date, total_servings, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        id,
        data.recipeId,
        data.prepDate,
        data.totalServings,
        data.notes ?? null,
        now,
        now
      );

    return this.getById(id)!;
  }

  /**
   * Get a prep batch by ID
   */
  getById(id: string): PrepBatch | null {
    const row = this.db
      .prepare('SELECT * FROM prep_batches WHERE id = ?')
      .get(id) as PrepBatchRow | undefined;

    if (!row) return null;
    return rowToPrepBatch(row);
  }

  /**
   * Get a prep batch by ID with recipe title
   */
  getByIdWithRecipe(id: string): PrepBatchWithRecipe | null {
    const row = this.db
      .prepare(
        `
        SELECT pb.*, r.title as recipe_title
        FROM prep_batches pb
        LEFT JOIN recipes r ON pb.recipe_id = r.id
        WHERE pb.id = ?
      `
      )
      .get(id) as PrepBatchWithRecipeRow | undefined;

    if (!row) return null;
    return rowToPrepBatchWithRecipe(row);
  }

  /**
   * Get a prep batch by ID with remaining servings calculated
   */
  getByIdWithRemaining(id: string): PrepBatchWithRemaining | null {
    const batch = this.getByIdWithRecipe(id);
    if (!batch) return null;

    // Calculate allocated servings from linked plan items
    const result = this.db
      .prepare(
        `
        SELECT COALESCE(SUM(servings), 0) as allocated_servings, COUNT(*) as linked_meals
        FROM plan_items
        WHERE batch_id = ?
      `
      )
      .get(id) as { allocated_servings: number; linked_meals: number };

    return {
      ...batch,
      allocatedServings: result.allocated_servings,
      linkedMeals: result.linked_meals,
      remainingServings: batch.totalServings - result.allocated_servings,
    };
  }

  /**
   * List prep batches with optional filters
   */
  list(options: ListPrepBatchesOptions = {}): PrepBatchWithRecipe[] {
    const { recipeId, prepDate, limit, offset } = options;

    let sql = `
      SELECT pb.*, r.title as recipe_title
      FROM prep_batches pb
      LEFT JOIN recipes r ON pb.recipe_id = r.id
    `;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (recipeId) {
      conditions.push('pb.recipe_id = ?');
      params.push(recipeId);
    }

    if (prepDate) {
      conditions.push('pb.prep_date = ?');
      params.push(prepDate);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY pb.prep_date DESC, pb.created_at DESC';

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    if (offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(offset);
    }

    const rows = this.db.prepare(sql).all(...params) as PrepBatchWithRecipeRow[];
    return rows.map(rowToPrepBatchWithRecipe);
  }

  /**
   * List prep batches with remaining servings calculated
   */
  listWithRemaining(options: ListPrepBatchesOptions = {}): PrepBatchWithRemaining[] {
    const batches = this.list(options);

    return batches.map((batch) => {
      const result = this.db
        .prepare(
          `
          SELECT COALESCE(SUM(servings), 0) as allocated_servings, COUNT(*) as linked_meals
          FROM plan_items
          WHERE batch_id = ?
        `
        )
        .get(batch.id) as { allocated_servings: number; linked_meals: number };

      const remaining: PrepBatchWithRemaining = {
        ...batch,
        allocatedServings: result.allocated_servings,
        linkedMeals: result.linked_meals,
        remainingServings: batch.totalServings - result.allocated_servings,
      };

      return remaining;
    });
  }

  /**
   * List only active batches (with remaining servings > 0)
   */
  listActive(options: Omit<ListPrepBatchesOptions, 'hasRemaining'> = {}): PrepBatchWithRemaining[] {
    const allBatches = this.listWithRemaining(options);
    return allBatches.filter((batch) => batch.remainingServings > 0);
  }

  /**
   * Update a prep batch
   */
  update(data: UpdatePrepBatch): PrepBatch | null {
    const existing = this.getById(data.id);
    if (!existing) return null;

    const now = new Date().toISOString();

    const updates: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (data.recipeId !== undefined) {
      updates.push('recipe_id = ?');
      params.push(data.recipeId);
    }
    if (data.prepDate !== undefined) {
      updates.push('prep_date = ?');
      params.push(data.prepDate);
    }
    if (data.totalServings !== undefined) {
      updates.push('total_servings = ?');
      params.push(data.totalServings);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }

    params.push(data.id);

    this.db
      .prepare(`UPDATE prep_batches SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    return this.getById(data.id);
  }

  /**
   * Delete a prep batch by ID
   *
   * Plan items with this batch_id will have batch_id set to NULL via ON DELETE SET NULL.
   */
  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM prep_batches WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  /**
   * Check if a prep batch exists by ID
   */
  exists(id: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM prep_batches WHERE id = ?')
      .get(id);
    return row !== undefined;
  }

  /**
   * Count total prep batches, optionally with filters
   */
  count(options: Omit<ListPrepBatchesOptions, 'limit' | 'offset'> = {}): number {
    const { recipeId, prepDate } = options;

    let sql = 'SELECT COUNT(*) as count FROM prep_batches';
    const params: string[] = [];
    const conditions: string[] = [];

    if (recipeId) {
      conditions.push('recipe_id = ?');
      params.push(recipeId);
    }

    if (prepDate) {
      conditions.push('prep_date = ?');
      params.push(prepDate);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row.count;
  }

  /**
   * Get batches for a specific recipe
   */
  getByRecipeId(recipeId: string): PrepBatchWithRecipe[] {
    return this.list({ recipeId });
  }

  /**
   * Get active batches for a specific recipe (with remaining servings)
   */
  getActiveByRecipeId(recipeId: string): PrepBatchWithRemaining[] {
    return this.listActive({ recipeId });
  }
}
