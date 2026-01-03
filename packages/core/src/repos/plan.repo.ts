/**
 * Plan repository - CRUD operations for weekly plans and plan items
 *
 * Handles weekly_plans and plan_items tables.
 * Uses raw SQL with parameterized queries (no ORM).
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type {
  WeeklyPlan,
  CreateWeeklyPlan,
  UpdateWeeklyPlan,
  PlanItem,
  PlanStatus,
  MealType,
  WeeklyPlanWithItems,
} from '../models/index.js';

/** Options for listing weekly plans */
export interface ListPlansOptions {
  /** Filter by status */
  status?: PlanStatus;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/** Raw weekly plan row from database */
interface WeeklyPlanRow {
  id: string;
  week: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Raw plan item row from database */
interface PlanItemRow {
  id: string;
  plan_id: string;
  recipe_id: string | null;
  day_of_week: number;
  meal_type: string;
  servings: number;
  notes: string | null;
}

/**
 * Convert database row to WeeklyPlan model
 */
function rowToWeeklyPlan(row: WeeklyPlanRow): WeeklyPlan {
  return {
    id: row.id,
    week: row.week,
    status: row.status as PlanStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to PlanItem model
 */
function rowToPlanItem(row: PlanItemRow): PlanItem {
  return {
    id: row.id,
    planId: row.plan_id,
    recipeId: row.recipe_id,
    dayOfWeek: row.day_of_week,
    mealType: row.meal_type as MealType,
    servings: row.servings,
    notes: row.notes,
  };
}

export class PlanRepository {
  constructor(private db: Database) {}

  /**
   * Create a new weekly plan
   */
  create(data: CreateWeeklyPlan): WeeklyPlanWithItems {
    const id = uuid();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO weekly_plans (id, week, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        id,
        data.week,
        data.status ?? 'draft',
        data.notes ?? null,
        now,
        now
      );

    return this.getById(id)!;
  }

  /**
   * Get a weekly plan by ID with its items
   */
  getById(id: string): WeeklyPlanWithItems | null {
    const row = this.db
      .prepare('SELECT * FROM weekly_plans WHERE id = ?')
      .get(id) as WeeklyPlanRow | undefined;

    if (!row) return null;

    const plan = rowToWeeklyPlan(row);
    const items = this.getMeals(id);

    return {
      ...plan,
      items,
    };
  }

  /**
   * Get a weekly plan by ISO week string (e.g., "2025-W02")
   */
  getByWeek(week: string): WeeklyPlanWithItems | null {
    const row = this.db
      .prepare('SELECT * FROM weekly_plans WHERE week = ?')
      .get(week) as WeeklyPlanRow | undefined;

    if (!row) return null;

    const plan = rowToWeeklyPlan(row);
    const items = this.getMeals(row.id);

    return {
      ...plan,
      items,
    };
  }

  /**
   * List weekly plans with optional filters
   */
  list(options: ListPlansOptions = {}): WeeklyPlanWithItems[] {
    const { status, limit, offset } = options;

    let sql = 'SELECT * FROM weekly_plans';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY week DESC';

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    if (offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(offset);
    }

    const rows = this.db.prepare(sql).all(...params) as WeeklyPlanRow[];

    return rows.map((row) => {
      const plan = rowToWeeklyPlan(row);
      const items = this.getMeals(row.id);
      return {
        ...plan,
        items,
      };
    });
  }

  /**
   * Update a weekly plan
   */
  update(data: UpdateWeeklyPlan): WeeklyPlanWithItems | null {
    const existing = this.getById(data.id);
    if (!existing) return null;

    const now = new Date().toISOString();

    const updates: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (data.week !== undefined) {
      updates.push('week = ?');
      params.push(data.week);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }

    params.push(data.id);

    this.db
      .prepare(`UPDATE weekly_plans SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    return this.getById(data.id);
  }

  /**
   * Delete a weekly plan by ID
   *
   * Related plan_items are automatically deleted via ON DELETE CASCADE.
   */
  delete(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM weekly_plans WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  /**
   * Set the status of a weekly plan
   */
  setStatus(id: string, status: PlanStatus): WeeklyPlanWithItems | null {
    return this.update({ id, status });
  }

  /**
   * Check if a weekly plan exists by ID
   */
  exists(id: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM weekly_plans WHERE id = ?')
      .get(id);
    return row !== undefined;
  }

  /**
   * Count total weekly plans, optionally with filters
   */
  count(options: Omit<ListPlansOptions, 'limit' | 'offset'> = {}): number {
    const { status } = options;

    let sql = 'SELECT COUNT(*) as count FROM weekly_plans';
    const params: string[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row.count;
  }

  // ============================================
  // Plan Item Methods
  // ============================================

  /**
   * Set or update a meal in a plan
   *
   * Uses INSERT OR REPLACE to handle the unique constraint on (plan_id, day_of_week, meal_type).
   * If a meal already exists for that slot, it will be replaced.
   */
  setMeal(
    planId: string,
    dayOfWeek: number,
    mealType: MealType,
    recipeId: string | null,
    servings: number = 2,
    notes: string | null = null
  ): PlanItem {
    // Check if a meal already exists at this slot
    const existing = this.db
      .prepare(
        `SELECT id FROM plan_items WHERE plan_id = ? AND day_of_week = ? AND meal_type = ?`
      )
      .get(planId, dayOfWeek, mealType) as { id: string } | undefined;

    const id = existing?.id ?? uuid();

    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO plan_items (id, plan_id, recipe_id, day_of_week, meal_type, servings, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(id, planId, recipeId, dayOfWeek, mealType, servings, notes);

    return this.getMealBySlot(planId, dayOfWeek, mealType)!;
  }

  /**
   * Remove a meal from a plan
   */
  removeMeal(planId: string, dayOfWeek: number, mealType: MealType): boolean {
    const result = this.db
      .prepare(
        `DELETE FROM plan_items WHERE plan_id = ? AND day_of_week = ? AND meal_type = ?`
      )
      .run(planId, dayOfWeek, mealType);
    return result.changes > 0;
  }

  /**
   * Get all meals for a plan
   */
  getMeals(planId: string): PlanItem[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM plan_items WHERE plan_id = ? ORDER BY day_of_week,
         CASE meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 END`
      )
      .all(planId) as PlanItemRow[];

    return rows.map(rowToPlanItem);
  }

  /**
   * Get a specific meal by plan, day, and meal type
   */
  getMealBySlot(
    planId: string,
    dayOfWeek: number,
    mealType: MealType
  ): PlanItem | null {
    const row = this.db
      .prepare(
        `SELECT * FROM plan_items WHERE plan_id = ? AND day_of_week = ? AND meal_type = ?`
      )
      .get(planId, dayOfWeek, mealType) as PlanItemRow | undefined;

    if (!row) return null;

    return rowToPlanItem(row);
  }

  /**
   * Get a plan item by ID
   */
  getMealById(id: string): PlanItem | null {
    const row = this.db
      .prepare('SELECT * FROM plan_items WHERE id = ?')
      .get(id) as PlanItemRow | undefined;

    if (!row) return null;

    return rowToPlanItem(row);
  }
}
