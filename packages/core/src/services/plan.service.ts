/**
 * Plan service - Business logic layer for weekly plans
 *
 * Wraps PlanRepository with audit logging for all mutations.
 * Read operations pass through directly without logging.
 * Validates recipe exists before assigning to meal slots.
 */

import type { Database } from 'better-sqlite3';
import {
  PlanRepository,
  type ListPlansOptions,
} from '../repos/plan.repo.js';
import { RecipeRepository } from '../repos/recipe.repo.js';
import { AuditRepository, type AuditActor } from '../repos/audit.repo.js';
import type {
  CreateWeeklyPlan,
  UpdateWeeklyPlan,
  WeeklyPlanWithItems,
  PlanItem,
  PlanStatus,
  MealType,
  SlotType,
} from '../models/index.js';

/**
 * Default actor for operations when not specified.
 */
const DEFAULT_ACTOR: AuditActor = 'user';

export class PlanService {
  private planRepo: PlanRepository;
  private recipeRepo: RecipeRepository;
  private auditRepo: AuditRepository;

  constructor(db: Database) {
    this.planRepo = new PlanRepository(db);
    this.recipeRepo = new RecipeRepository(db);
    this.auditRepo = new AuditRepository(db);
  }

  /**
   * Create a new weekly plan.
   * Logs 'create' action to audit log.
   */
  createPlan(
    data: CreateWeeklyPlan,
    actor: string = DEFAULT_ACTOR
  ): WeeklyPlanWithItems {
    const plan = this.planRepo.create(data);

    this.auditRepo.log({
      actor,
      action: 'create',
      entityType: 'weekly_plan',
      entityId: plan.id,
      details: {
        week: plan.week,
        status: plan.status,
      },
    });

    return plan;
  }

  /**
   * Get a plan by ID with its items.
   * No audit logging for read operations.
   */
  getPlan(id: string): WeeklyPlanWithItems | null {
    return this.planRepo.getById(id);
  }

  /**
   * Get a plan by ISO week string (e.g., "2025-W02").
   * No audit logging for read operations.
   */
  getPlanByWeek(week: string): WeeklyPlanWithItems | null {
    return this.planRepo.getByWeek(week);
  }

  /**
   * List plans with optional filters.
   * No audit logging for read operations.
   */
  listPlans(options?: ListPlansOptions): WeeklyPlanWithItems[] {
    return this.planRepo.list(options);
  }

  /**
   * Update a weekly plan.
   * Logs 'update' action to audit log.
   * Returns null if plan not found.
   */
  updatePlan(
    data: UpdateWeeklyPlan,
    actor: string = DEFAULT_ACTOR
  ): WeeklyPlanWithItems | null {
    const plan = this.planRepo.update(data);

    if (plan) {
      // Build details object with changed fields
      const details: Record<string, unknown> = {};

      if (data.week !== undefined) details.week = data.week;
      if (data.status !== undefined) details.status = data.status;
      if (data.notes !== undefined) details.notes = data.notes ?? '(cleared)';

      this.auditRepo.log({
        actor,
        action: 'update',
        entityType: 'weekly_plan',
        entityId: plan.id,
        details,
      });
    }

    return plan;
  }

  /**
   * Delete a weekly plan by ID.
   * Logs 'delete' action to audit log.
   * Returns true if plan was deleted, false if not found.
   */
  deletePlan(id: string, actor: string = DEFAULT_ACTOR): boolean {
    // Get plan info before deletion for audit log
    const plan = this.planRepo.getById(id);

    const deleted = this.planRepo.delete(id);

    if (deleted && plan) {
      this.auditRepo.log({
        actor,
        action: 'delete',
        entityType: 'weekly_plan',
        entityId: id,
        details: {
          week: plan.week,
          status: plan.status,
          itemCount: plan.items?.length ?? 0,
        },
      });
    }

    return deleted;
  }

  /**
   * Change the status of a weekly plan.
   * Logs 'update' action to audit log with status change details.
   * Returns null if plan not found.
   */
  setStatus(
    id: string,
    status: PlanStatus,
    actor: string = DEFAULT_ACTOR
  ): WeeklyPlanWithItems | null {
    // Get current plan to capture old status
    const oldPlan = this.planRepo.getById(id);
    if (!oldPlan) return null;

    const plan = this.planRepo.setStatus(id, status);

    if (plan) {
      this.auditRepo.log({
        actor,
        action: 'update',
        entityType: 'weekly_plan',
        entityId: id,
        details: {
          statusChange: {
            from: oldPlan.status,
            to: status,
          },
        },
      });
    }

    return plan;
  }

  /**
   * Set or update a meal in a plan.
   * Validates that the recipe exists if a recipeId is provided.
   * Logs 'update' action to audit log for plan_item.
   * Returns null if plan not found.
   * Throws error if recipe not found.
   */
  setMeal(
    planId: string,
    dayOfWeek: number,
    mealType: MealType,
    recipeId: string | null,
    servings?: number,
    notes?: string,
    actor: string = DEFAULT_ACTOR,
    slotType: SlotType = 'recipe',
    leftoversSourceId: string | null = null
  ): PlanItem | null {
    // Verify plan exists
    if (!this.planRepo.exists(planId)) {
      return null;
    }

    // Verify recipe exists if provided (only for recipe slot types)
    if (recipeId && slotType === 'recipe' && !this.recipeRepo.exists(recipeId)) {
      throw new Error(`Recipe ${recipeId} not found`);
    }

    // Verify leftovers source exists if provided
    if (leftoversSourceId) {
      const sourceItem = this.planRepo.getMealById(leftoversSourceId);
      if (!sourceItem) {
        throw new Error(`Leftovers source meal ${leftoversSourceId} not found`);
      }
    }

    const item = this.planRepo.setMeal(
      planId,
      dayOfWeek,
      mealType,
      recipeId,
      servings,
      notes ?? null,
      slotType,
      leftoversSourceId
    );

    this.auditRepo.log({
      actor,
      action: 'update',
      entityType: 'plan_item',
      entityId: item.id,
      details: {
        planId,
        dayOfWeek,
        mealType,
        recipeId,
        servings: item.servings,
        slotType,
        leftoversSourceId,
      },
    });

    return item;
  }

  /**
   * Remove a meal from a plan.
   * Logs 'delete' action to audit log for plan_item.
   * Returns true if meal was removed, false if not found.
   */
  removeMeal(
    planId: string,
    dayOfWeek: number,
    mealType: MealType,
    actor: string = DEFAULT_ACTOR
  ): boolean {
    // Get meal info before deletion for audit log
    const meal = this.planRepo.getMealBySlot(planId, dayOfWeek, mealType);

    const removed = this.planRepo.removeMeal(planId, dayOfWeek, mealType);

    if (removed && meal) {
      this.auditRepo.log({
        actor,
        action: 'delete',
        entityType: 'plan_item',
        entityId: meal.id,
        details: {
          planId,
          dayOfWeek,
          mealType,
          recipeId: meal.recipeId,
        },
      });
    }

    return removed;
  }

  /**
   * Check if a plan exists by ID.
   * No audit logging for read operations.
   */
  planExists(id: string): boolean {
    return this.planRepo.exists(id);
  }

  /**
   * Count total plans, optionally with filters.
   * No audit logging for read operations.
   */
  countPlans(
    options?: Omit<ListPlansOptions, 'limit' | 'offset'>
  ): number {
    return this.planRepo.count(options);
  }

  /**
   * Get audit log entries for a specific plan.
   */
  getPlanAuditLog(planId: string) {
    return this.auditRepo.getByEntityId(planId);
  }

  // ============================================
  // Plan Completion Methods
  // ============================================

  /**
   * Mark a plan as completed.
   * Sets status to 'completed' and records completed_at timestamp.
   * A plan can only be completed once.
   * Logs 'complete' action to audit log.
   * Returns null if plan not found or already completed.
   */
  completePlan(
    id: string,
    actor: string = DEFAULT_ACTOR
  ): WeeklyPlanWithItems | null {
    // Get plan info before completion for audit log
    const oldPlan = this.planRepo.getById(id);
    if (!oldPlan) return null;

    // Check if already completed
    if (oldPlan.completedAt) {
      return null;
    }

    const plan = this.planRepo.completePlan(id);

    if (plan) {
      this.auditRepo.log({
        actor,
        action: 'update',
        entityType: 'weekly_plan',
        entityId: id,
        details: {
          action: 'complete',
          week: plan.week,
          completedAt: plan.completedAt,
          itemCount: plan.items?.length ?? 0,
          madeCount: plan.items?.filter(i => i.wasMade).length ?? 0,
        },
      });
    }

    return plan;
  }

  /**
   * Get completed plan history.
   * Returns plans that have been completed, ordered by completion date descending.
   * No audit logging for read operations.
   */
  getCompletedPlans(limit?: number): WeeklyPlanWithItems[] {
    return this.planRepo.getCompletedPlans(limit);
  }

  /**
   * Mark a meal as made (was_made = true).
   * Tracks which meals were actually cooked vs just planned.
   * Logs 'mark_made' action to audit log.
   * Returns null if meal not found.
   */
  markMealAsMade(
    planId: string,
    dayOfWeek: number,
    mealType: MealType,
    wasMade: boolean = true,
    actor: string = DEFAULT_ACTOR
  ): PlanItem | null {
    const item = this.planRepo.markMealAsMade(planId, dayOfWeek, mealType, wasMade);

    if (item) {
      this.auditRepo.log({
        actor,
        action: 'update',
        entityType: 'plan_item',
        entityId: item.id,
        details: {
          action: wasMade ? 'mark_made' : 'unmark_made',
          planId,
          dayOfWeek,
          mealType,
          recipeId: item.recipeId,
          wasMade,
        },
      });
    }

    return item;
  }

  /**
   * Get all meals that were marked as made from completed plans.
   * No audit logging for read operations.
   */
  getMadeMeals(limit?: number): PlanItem[] {
    return this.planRepo.getMadeMeals(limit);
  }

  /**
   * Get recently made recipe IDs (for suggestion penalty).
   * Returns recipe IDs from meals marked as made within the given number of days.
   * No audit logging for read operations.
   */
  getRecentlyMadeRecipeIds(daysBack: number = 14): string[] {
    return this.planRepo.getRecentlyMadeRecipeIds(daysBack);
  }
}
