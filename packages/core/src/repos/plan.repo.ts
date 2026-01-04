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
  SlotType,
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
  completed_at: string | null;
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
  slot_type: string | null;
  leftovers_source_id: string | null;
  was_made: number | null;
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
    completedAt: row.completed_at,
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
    slotType: (row.slot_type ?? 'recipe') as SlotType,
    leftoversSourceId: row.leftovers_source_id,
    wasMade: row.was_made === 1,
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
    notes: string | null = null,
    slotType: SlotType = 'recipe',
    leftoversSourceId: string | null = null
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
        INSERT OR REPLACE INTO plan_items (id, plan_id, recipe_id, day_of_week, meal_type, servings, notes, slot_type, leftovers_source_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(id, planId, recipeId, dayOfWeek, mealType, servings, notes, slotType, leftoversSourceId);

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

  // ============================================
  // Plan Completion Methods
  // ============================================

  /**
   * Mark a plan as completed
   * Sets status to 'completed' and records completed_at timestamp
   * Returns null if plan is already completed or not found
   */
  completePlan(id: string): WeeklyPlanWithItems | null {
    const existing = this.getById(id);
    if (!existing) return null;

    // Prevent completing already completed plans
    if (existing.completedAt) {
      return null;
    }

    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE weekly_plans SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`
      )
      .run(now, now, id);

    return this.getById(id);
  }

  /**
   * Get completed plans (history)
   * Returns plans with completed_at set, ordered by completion date descending
   */
  getCompletedPlans(limit?: number): WeeklyPlanWithItems[] {
    let sql = `SELECT * FROM weekly_plans WHERE completed_at IS NOT NULL ORDER BY completed_at DESC`;
    const params: number[] = [];

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
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
   * Mark a meal as made (was_made = true)
   * Returns the updated plan item or null if not found
   */
  markMealAsMade(
    planId: string,
    dayOfWeek: number,
    mealType: MealType,
    wasMade: boolean = true
  ): PlanItem | null {
    // Verify the meal exists
    const existing = this.getMealBySlot(planId, dayOfWeek, mealType);
    if (!existing) return null;

    this.db
      .prepare(
        `UPDATE plan_items SET was_made = ? WHERE plan_id = ? AND day_of_week = ? AND meal_type = ?`
      )
      .run(wasMade ? 1 : 0, planId, dayOfWeek, mealType);

    return this.getMealBySlot(planId, dayOfWeek, mealType);
  }

  /**
   * Get all meals that were marked as made from completed plans
   * Useful for tracking meal history and informing suggestions
   */
  getMadeMeals(limit?: number): PlanItem[] {
    let sql = `
      SELECT pi.* FROM plan_items pi
      INNER JOIN weekly_plans wp ON pi.plan_id = wp.id
      WHERE pi.was_made = 1 AND wp.completed_at IS NOT NULL
      ORDER BY wp.completed_at DESC, pi.day_of_week
    `;
    const params: number[] = [];

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as PlanItemRow[];
    return rows.map(rowToPlanItem);
  }

  /**
   * Get recently made recipe IDs (for suggestion penalty)
   * Returns recipe IDs from meals marked as made within the given number of days
   */
  getRecentlyMadeRecipeIds(daysBack: number = 14): string[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffStr = cutoffDate.toISOString();

    const rows = this.db
      .prepare(
        `
        SELECT DISTINCT pi.recipe_id FROM plan_items pi
        INNER JOIN weekly_plans wp ON pi.plan_id = wp.id
        WHERE pi.was_made = 1
          AND pi.recipe_id IS NOT NULL
          AND wp.completed_at IS NOT NULL
          AND wp.completed_at >= ?
        `
      )
      .all(cutoffStr) as { recipe_id: string }[];

    return rows.map((r) => r.recipe_id);
  }
}
