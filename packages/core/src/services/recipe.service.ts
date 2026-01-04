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
  RecipeIngredient,
} from '../models/index.js';

/**
 * Unit conversion definitions for scaling.
 * Defines base units and conversion factors.
 */
interface UnitConversion {
  baseUnit: string;
  factor: number;
}

/**
 * Map of units to their base unit and conversion factor.
 * Used for simplifying scaled quantities (e.g., 1500g -> 1.5kg).
 */
const UNIT_CONVERSIONS: Record<string, UnitConversion> = {
  // Weight - base unit: g
  'g': { baseUnit: 'g', factor: 1 },
  'kg': { baseUnit: 'g', factor: 1000 },
  'mg': { baseUnit: 'g', factor: 0.001 },
  'oz': { baseUnit: 'g', factor: 28.3495 },
  'lb': { baseUnit: 'g', factor: 453.592 },
  // Volume - base unit: ml
  'ml': { baseUnit: 'ml', factor: 1 },
  'l': { baseUnit: 'ml', factor: 1000 },
  'cl': { baseUnit: 'ml', factor: 10 },
  'tsp': { baseUnit: 'ml', factor: 5 },
  'tbsp': { baseUnit: 'ml', factor: 15 },
  'cup': { baseUnit: 'ml', factor: 240 },
  'fl oz': { baseUnit: 'ml', factor: 29.5735 },
  'pint': { baseUnit: 'ml', factor: 473.176 },
  'quart': { baseUnit: 'ml', factor: 946.353 },
};

/**
 * Preferred units for display, ordered by size (largest first).
 */
const PREFERRED_UNITS: Record<string, { unit: string; minValue: number }[]> = {
  'g': [
    { unit: 'kg', minValue: 1000 },
    { unit: 'g', minValue: 1 },
  ],
  'ml': [
    { unit: 'l', minValue: 1000 },
    { unit: 'ml', minValue: 1 },
  ],
};

/**
 * Convert a quantity from one unit to a more readable unit if applicable.
 * E.g., 1500g -> 1.5kg, 2000ml -> 2l
 */
function simplifyUnit(quantity: number, unit: string): { quantity: number; unit: string } {
  const lowerUnit = unit.toLowerCase();
  const conversion = UNIT_CONVERSIONS[lowerUnit];

  if (!conversion) {
    // Unknown unit, return as-is
    return { quantity, unit };
  }

  // Convert to base unit
  const baseValue = quantity * conversion.factor;
  const preferred = PREFERRED_UNITS[conversion.baseUnit];

  if (!preferred) {
    return { quantity, unit };
  }

  // Find the best unit for display
  for (const { unit: targetUnit, minValue } of preferred) {
    if (baseValue >= minValue) {
      const targetConversion = UNIT_CONVERSIONS[targetUnit];
      if (targetConversion) {
        const newQuantity = baseValue / targetConversion.factor;
        return { quantity: newQuantity, unit: targetUnit };
      }
    }
  }

  return { quantity, unit };
}

/**
 * Format a number to a clean string, removing unnecessary decimal places.
 * E.g., 1.0 -> 1, 1.5 -> 1.5, 1.333333 -> 1.33
 */
function formatQuantity(value: number): number {
  // Round to 2 decimal places
  const rounded = Math.round(value * 100) / 100;
  return rounded;
}

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

  /**
   * Scale a recipe to a different number of servings.
   * Returns a copy of the recipe with all ingredient quantities multiplied
   * by (targetServings / originalServings).
   *
   * Does NOT modify the stored recipe.
   *
   * Handles unit conversions for readability (e.g., 1500g -> 1.5kg).
   *
   * @param recipeId - The ID of the recipe to scale
   * @param targetServings - The desired number of servings
   * @returns Scaled recipe copy, or null if recipe not found
   */
  scaleRecipe(recipeId: string, targetServings: number): RecipeWithRelations | null {
    const recipe = this.recipeRepo.getById(recipeId);

    if (!recipe) {
      return null;
    }

    // Calculate scaling factor
    const originalServings = recipe.servings || 1;
    const scalingFactor = targetServings / originalServings;

    // Scale ingredients
    const scaledIngredients: RecipeIngredient[] | undefined = recipe.ingredients?.map(
      (ing): RecipeIngredient => {
        if (ing.quantity === null || ing.quantity === undefined) {
          // No quantity to scale
          return { ...ing };
        }

        const scaledQuantity = ing.quantity * scalingFactor;

        // Apply unit simplification if possible
        if (ing.unit) {
          const simplified = simplifyUnit(scaledQuantity, ing.unit);
          return {
            ...ing,
            quantity: formatQuantity(simplified.quantity),
            unit: simplified.unit,
          };
        }

        return {
          ...ing,
          quantity: formatQuantity(scaledQuantity),
        };
      }
    );

    // Return a copy with scaled values
    return {
      ...recipe,
      servings: targetServings,
      ingredients: scaledIngredients,
    };
  }
}
