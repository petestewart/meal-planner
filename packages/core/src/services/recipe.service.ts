/**
 * Recipe service - Business logic layer for recipes
 *
 * Wraps RecipeRepository with audit logging for all mutations.
 * Read operations pass through directly without logging.
 */

import type { Database } from 'better-sqlite3';
import {
  RecipeRepository,
  type CreateRecipeIngredientInput,
  type ListRecipesOptions,
} from '../repos/recipe.repo.js';
import { AuditRepository, type AuditActor } from '../repos/audit.repo.js';
import type {
  CreateRecipe,
  UpdateRecipe,
  RecipeWithRelations,
} from '../models/index.js';

/**
 * Default actor for operations when not specified.
 */
const DEFAULT_ACTOR: AuditActor = 'user';

export class RecipeService {
  private recipeRepo: RecipeRepository;
  private auditRepo: AuditRepository;

  constructor(db: Database) {
    this.recipeRepo = new RecipeRepository(db);
    this.auditRepo = new AuditRepository(db);
  }

  /**
   * Create a new recipe with optional ingredients and tags.
   * Logs 'create' action to audit log.
   */
  createRecipe(
    data: CreateRecipe,
    ingredients?: CreateRecipeIngredientInput[],
    tagIds?: string[],
    actor: string = DEFAULT_ACTOR
  ): RecipeWithRelations {
    const recipe = this.recipeRepo.create(data, ingredients, tagIds);

    this.auditRepo.log({
      actor,
      action: 'create',
      entityType: 'recipe',
      entityId: recipe.id,
      details: {
        title: recipe.title,
        ingredientCount: ingredients?.length ?? 0,
        tagCount: tagIds?.length ?? 0,
      },
    });

    return recipe;
  }

  /**
   * Get a recipe by ID with its ingredients and tags.
   * No audit logging for read operations.
   */
  getRecipe(id: string): RecipeWithRelations | null {
    return this.recipeRepo.getById(id);
  }

  /**
   * List recipes with optional filters.
   * No audit logging for read operations.
   */
  listRecipes(options?: ListRecipesOptions): RecipeWithRelations[] {
    return this.recipeRepo.list(options);
  }

  /**
   * Update a recipe and optionally its ingredients and tags.
   * Logs 'update' action to audit log.
   * Returns null if recipe not found.
   */
  updateRecipe(
    data: UpdateRecipe,
    ingredients?: CreateRecipeIngredientInput[],
    tagIds?: string[],
    actor: string = DEFAULT_ACTOR
  ): RecipeWithRelations | null {
    const recipe = this.recipeRepo.update(data, ingredients, tagIds);

    if (recipe) {
      // Build details object with changed fields
      const details: Record<string, unknown> = {};

      // Include all provided update fields
      if (data.title !== undefined) details.title = data.title;
      if (data.description !== undefined) details.description = data.description;
      if (data.instructions !== undefined) details.instructions = '(updated)';
      if (data.servings !== undefined) details.servings = data.servings;
      if (data.prepTimeMinutes !== undefined)
        details.prepTimeMinutes = data.prepTimeMinutes;
      if (data.cookTimeMinutes !== undefined)
        details.cookTimeMinutes = data.cookTimeMinutes;
      if (data.sourceUrl !== undefined) details.sourceUrl = data.sourceUrl;
      if (data.sourceType !== undefined) details.sourceType = data.sourceType;
      if (data.cuisine !== undefined) details.cuisine = data.cuisine;
      if (data.difficulty !== undefined) details.difficulty = data.difficulty;

      // Include ingredient/tag changes if provided
      if (ingredients !== undefined) {
        details.ingredientsReplaced = true;
        details.ingredientCount = ingredients.length;
      }
      if (tagIds !== undefined) {
        details.tagsReplaced = true;
        details.tagCount = tagIds.length;
      }

      this.auditRepo.log({
        actor,
        action: 'update',
        entityType: 'recipe',
        entityId: recipe.id,
        details,
      });
    }

    return recipe;
  }

  /**
   * Delete a recipe by ID.
   * Logs 'delete' action to audit log.
   * Returns true if recipe was deleted, false if not found.
   */
  deleteRecipe(id: string, actor: string = DEFAULT_ACTOR): boolean {
    // Get recipe info before deletion for audit log
    const recipe = this.recipeRepo.getById(id);

    const deleted = this.recipeRepo.delete(id);

    if (deleted && recipe) {
      this.auditRepo.log({
        actor,
        action: 'delete',
        entityType: 'recipe',
        entityId: id,
        details: {
          title: recipe.title,
        },
      });
    }

    return deleted;
  }

  /**
   * Check if a recipe exists by ID.
   * No audit logging for read operations.
   */
  recipeExists(id: string): boolean {
    return this.recipeRepo.exists(id);
  }

  /**
   * Count total recipes, optionally with filters.
   * No audit logging for read operations.
   */
  countRecipes(
    options?: Omit<ListRecipesOptions, 'limit' | 'offset'>
  ): number {
    return this.recipeRepo.count(options);
  }

  /**
   * Get audit log entries for a specific recipe.
   */
  getRecipeAuditLog(recipeId: string) {
    return this.auditRepo.getByEntityId(recipeId);
  }
}
