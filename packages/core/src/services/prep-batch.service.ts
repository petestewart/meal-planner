/**
 * PrepBatch service - Business logic layer for prep batches
 *
 * Wraps PrepBatchRepository with audit logging for all mutations.
 * Read operations pass through directly without logging.
 * Validates recipe exists before creating batches.
 */

import type { Database } from 'better-sqlite3';
import { PrepBatchRepository, type ListPrepBatchesOptions } from '../repos/prep-batch.repo.js';
import { RecipeRepository } from '../repos/recipe.repo.js';
import { AuditRepository, type AuditActor } from '../repos/audit.repo.js';
import type {
  PrepBatch,
  CreatePrepBatch,
  UpdatePrepBatch,
  PrepBatchWithRecipe,
  PrepBatchWithRemaining,
} from '../models/index.js';

/**
 * Default actor for operations when not specified.
 */
const DEFAULT_ACTOR: AuditActor = 'user';

export class PrepBatchService {
  private prepBatchRepo: PrepBatchRepository;
  private recipeRepo: RecipeRepository;
  private auditRepo: AuditRepository;

  constructor(db: Database) {
    this.prepBatchRepo = new PrepBatchRepository(db);
    this.recipeRepo = new RecipeRepository(db);
    this.auditRepo = new AuditRepository(db);
  }

  /**
   * Create a new prep batch.
   * Validates that the recipe exists.
   * Logs 'create' action to audit log.
   */
  createBatch(
    data: CreatePrepBatch,
    actor: string = DEFAULT_ACTOR
  ): PrepBatch {
    // Verify recipe exists
    if (!this.recipeRepo.exists(data.recipeId)) {
      throw new Error(`Recipe ${data.recipeId} not found`);
    }

    const batch = this.prepBatchRepo.create(data);

    this.auditRepo.log({
      actor,
      action: 'create',
      entityType: 'prep_batch',
      entityId: batch.id,
      details: {
        recipeId: batch.recipeId,
        prepDate: batch.prepDate,
        totalServings: batch.totalServings,
      },
    });

    return batch;
  }

  /**
   * Get a prep batch by ID.
   * No audit logging for read operations.
   */
  getBatch(id: string): PrepBatch | null {
    return this.prepBatchRepo.getById(id);
  }

  /**
   * Get a prep batch by ID with recipe title.
   * No audit logging for read operations.
   */
  getBatchWithRecipe(id: string): PrepBatchWithRecipe | null {
    return this.prepBatchRepo.getByIdWithRecipe(id);
  }

  /**
   * Get a prep batch by ID with remaining servings.
   * No audit logging for read operations.
   */
  getBatchWithRemaining(id: string): PrepBatchWithRemaining | null {
    return this.prepBatchRepo.getByIdWithRemaining(id);
  }

  /**
   * List prep batches with optional filters.
   * No audit logging for read operations.
   */
  listBatches(options?: ListPrepBatchesOptions): PrepBatchWithRecipe[] {
    return this.prepBatchRepo.list(options);
  }

  /**
   * List prep batches with remaining servings.
   * No audit logging for read operations.
   */
  listBatchesWithRemaining(options?: ListPrepBatchesOptions): PrepBatchWithRemaining[] {
    return this.prepBatchRepo.listWithRemaining(options);
  }

  /**
   * List only active batches (with remaining servings > 0).
   * No audit logging for read operations.
   */
  listActiveBatches(options?: Omit<ListPrepBatchesOptions, 'hasRemaining'>): PrepBatchWithRemaining[] {
    return this.prepBatchRepo.listActive(options);
  }

  /**
   * Update a prep batch.
   * Logs 'update' action to audit log.
   * Returns null if batch not found.
   */
  updateBatch(
    data: UpdatePrepBatch,
    actor: string = DEFAULT_ACTOR
  ): PrepBatch | null {
    // If updating recipeId, verify recipe exists
    if (data.recipeId && !this.recipeRepo.exists(data.recipeId)) {
      throw new Error(`Recipe ${data.recipeId} not found`);
    }

    const batch = this.prepBatchRepo.update(data);

    if (batch) {
      // Build details object with changed fields
      const details: Record<string, unknown> = {};

      if (data.recipeId !== undefined) details.recipeId = data.recipeId;
      if (data.prepDate !== undefined) details.prepDate = data.prepDate;
      if (data.totalServings !== undefined) details.totalServings = data.totalServings;
      if (data.notes !== undefined) details.notes = data.notes ?? '(cleared)';

      this.auditRepo.log({
        actor,
        action: 'update',
        entityType: 'prep_batch',
        entityId: batch.id,
        details,
      });
    }

    return batch;
  }

  /**
   * Delete a prep batch by ID.
   * Logs 'delete' action to audit log.
   * Returns true if batch was deleted, false if not found.
   */
  deleteBatch(id: string, actor: string = DEFAULT_ACTOR): boolean {
    // Get batch info before deletion for audit log
    const batch = this.prepBatchRepo.getByIdWithRemaining(id);

    const deleted = this.prepBatchRepo.delete(id);

    if (deleted && batch) {
      this.auditRepo.log({
        actor,
        action: 'delete',
        entityType: 'prep_batch',
        entityId: id,
        details: {
          recipeId: batch.recipeId,
          prepDate: batch.prepDate,
          totalServings: batch.totalServings,
          linkedMeals: batch.linkedMeals,
        },
      });
    }

    return deleted;
  }

  /**
   * Check if a prep batch exists by ID.
   * No audit logging for read operations.
   */
  batchExists(id: string): boolean {
    return this.prepBatchRepo.exists(id);
  }

  /**
   * Count total prep batches, optionally with filters.
   * No audit logging for read operations.
   */
  countBatches(options?: Omit<ListPrepBatchesOptions, 'limit' | 'offset'>): number {
    return this.prepBatchRepo.count(options);
  }

  /**
   * Get batches for a specific recipe.
   * No audit logging for read operations.
   */
  getBatchesByRecipeId(recipeId: string): PrepBatchWithRecipe[] {
    return this.prepBatchRepo.getByRecipeId(recipeId);
  }

  /**
   * Get active batches for a specific recipe (with remaining servings).
   * No audit logging for read operations.
   */
  getActiveBatchesByRecipeId(recipeId: string): PrepBatchWithRemaining[] {
    return this.prepBatchRepo.getActiveByRecipeId(recipeId);
  }

  /**
   * Get audit log entries for a specific prep batch.
   */
  getBatchAuditLog(batchId: string) {
    return this.auditRepo.getByEntityId(batchId);
  }
}
