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
import {
  RecipeModificationRepository,
  type RecipeModification,
  type IngredientOverride,
} from '../repos/recipe-modification.repo.js';
import { SubstitutionRepository } from '../repos/substitution.repo.js';
import { IngredientRepository } from '../repos/ingredient.repo.js';
import type {
  CreateRecipe,
  UpdateRecipe,
  RecipeWithRelations,
  RecipeIngredient,
  Substitution,
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

/**
 * Ingredient with substitution suggestions
 */
export interface IngredientWithSubstitutions {
  ingredientId: string;
  ingredientName: string;
  substitutions: Substitution[];
  hasSubstitutions: boolean;
}

/**
 * Result of getting substitution suggestions for a recipe
 */
export interface RecipeSubstitutionSuggestions {
  recipeId: string;
  recipeTitle: string;
  ingredients: IngredientWithSubstitutions[];
  totalWithSubstitutions: number;
}

export class RecipeService {
  private recipeRepo: RecipeRepository;
  private auditRepo: AuditRepository;
  private modificationRepo: RecipeModificationRepository;
  private substitutionRepo: SubstitutionRepository;
  private ingredientRepo: IngredientRepository;

  constructor(db: Database) {
    this.recipeRepo = new RecipeRepository(db);
    this.auditRepo = new AuditRepository(db);
    this.modificationRepo = new RecipeModificationRepository(db);
    this.substitutionRepo = new SubstitutionRepository(db);
    this.ingredientRepo = new IngredientRepository(db);
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
   * Toggle a recipe's favorite status.
   * Returns the recipe with updated favorite status.
   * Logs 'favorite' or 'unfavorite' action to audit log.
   */
  toggleFavorite(
    recipeId: string,
    actor: string = DEFAULT_ACTOR
  ): RecipeWithRelations {
    const recipe = this.recipeRepo.getById(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    const newStatus = this.recipeRepo.toggleFavorite(recipeId);

    this.auditRepo.log({
      actor,
      action: newStatus ? 'favorite' : 'unfavorite',
      entityType: 'recipe',
      entityId: recipeId,
      details: {
        title: recipe.title,
        isFavorite: newStatus,
      },
    });

    // Return updated recipe
    return this.recipeRepo.getById(recipeId)!;
  }

  /**
   * Get all favorite recipe IDs.
   * Useful for building suggestion context.
   */
  getFavoriteRecipeIds(): string[] {
    return this.recipeRepo.listFavoriteIds();
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

  // ==================== Recipe Modifications ====================

  /**
   * Get modifications for a recipe.
   * Returns null if no modifications exist.
   */
  getModifications(recipeId: string): RecipeModification | null {
    return this.modificationRepo.getByRecipeId(recipeId);
  }

  /**
   * Check if a recipe has any modifications.
   */
  hasModifications(recipeId: string): boolean {
    return this.modificationRepo.hasModifications(recipeId);
  }

  /**
   * Set user notes for a recipe.
   * Creates or updates the modification record.
   * Logs 'update' action to audit log.
   */
  setRecipeNote(
    recipeId: string,
    notes: string | null,
    actor: string = DEFAULT_ACTOR
  ): RecipeModification {
    // Verify recipe exists
    if (!this.recipeRepo.exists(recipeId)) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    const modification = this.modificationRepo.setUserNotes(recipeId, notes);

    this.auditRepo.log({
      actor,
      action: 'update',
      entityType: 'recipe_modification',
      entityId: recipeId,
      details: {
        field: 'user_notes',
        hasNotes: notes !== null && notes.length > 0,
      },
    });

    return modification;
  }

  /**
   * Add an ingredient override for a recipe.
   * If an override for the same original ingredient exists, it is replaced.
   * Logs 'update' action to audit log.
   */
  addIngredientOverride(
    recipeId: string,
    original: string,
    replacement: string,
    actor: string = DEFAULT_ACTOR
  ): RecipeModification {
    // Verify recipe exists
    if (!this.recipeRepo.exists(recipeId)) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    const modification = this.modificationRepo.addIngredientOverride(
      recipeId,
      original,
      replacement
    );

    this.auditRepo.log({
      actor,
      action: 'update',
      entityType: 'recipe_modification',
      entityId: recipeId,
      details: {
        field: 'ingredient_override',
        original,
        replacement,
      },
    });

    return modification;
  }

  /**
   * Remove an ingredient override for a recipe.
   * Logs 'update' action to audit log.
   */
  removeIngredientOverride(
    recipeId: string,
    original: string,
    actor: string = DEFAULT_ACTOR
  ): RecipeModification | null {
    const modification = this.modificationRepo.removeIngredientOverride(
      recipeId,
      original
    );

    if (modification) {
      this.auditRepo.log({
        actor,
        action: 'update',
        entityType: 'recipe_modification',
        entityId: recipeId,
        details: {
          field: 'ingredient_override',
          removed: original,
        },
      });
    }

    return modification;
  }

  /**
   * Clear all modifications for a recipe.
   * Logs 'delete' action to audit log.
   */
  clearModifications(recipeId: string, actor: string = DEFAULT_ACTOR): boolean {
    const deleted = this.modificationRepo.delete(recipeId);

    if (deleted) {
      this.auditRepo.log({
        actor,
        action: 'delete',
        entityType: 'recipe_modification',
        entityId: recipeId,
        details: {},
      });
    }

    return deleted;
  }

  /**
   * Get a recipe with modifications applied.
   * Ingredient overrides are applied to the display without modifying stored data.
   */
  getRecipeWithModifications(recipeId: string): {
    recipe: RecipeWithRelations | null;
    modifications: RecipeModification | null;
  } {
    const recipe = this.recipeRepo.getById(recipeId);
    const modifications = this.modificationRepo.getByRecipeId(recipeId);

    return { recipe, modifications };
  }

  /**
   * Update modifications for a recipe (full update).
   */
  updateModifications(
    recipeId: string,
    data: {
      userNotes?: string | null;
      ingredientOverrides?: IngredientOverride[];
      instructionNotes?: string | null;
    },
    actor: string = DEFAULT_ACTOR
  ): RecipeModification {
    // Verify recipe exists
    if (!this.recipeRepo.exists(recipeId)) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    const modification = this.modificationRepo.upsert({
      recipeId,
      ...data,
    });

    this.auditRepo.log({
      actor,
      action: 'update',
      entityType: 'recipe_modification',
      entityId: recipeId,
      details: {
        hasNotes: data.userNotes !== null && data.userNotes !== undefined,
        overrideCount: data.ingredientOverrides?.length ?? 0,
      },
    });

    return modification;
  }

  // ==================== Recipe Versioning ====================

  /**
   * Fork a recipe to create a new version/variation.
   *
   * Creates a copy of the recipe with all its ingredients and tags.
   * The new version has source_type='variation' and links to the parent.
   *
   * @param recipeId - The ID of the recipe to fork
   * @param versionName - The name for this version (e.g., "sous vide", "vegan")
   * @param actor - The actor performing the operation
   * @returns The newly created recipe version
   * @throws Error if recipe not found
   */
  forkRecipe(
    recipeId: string,
    versionName: string,
    actor: string = DEFAULT_ACTOR
  ): RecipeWithRelations {
    const forked = this.recipeRepo.forkRecipe(recipeId, versionName);

    if (!forked) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    this.auditRepo.log({
      actor,
      action: 'create',
      entityType: 'recipe',
      entityId: forked.id,
      details: {
        title: forked.title,
        versionName,
        parentRecipeId: recipeId,
        operation: 'fork',
      },
    });

    return forked;
  }

  /**
   * Get all versions of a recipe (including the original).
   *
   * @param recipeId - The ID of any recipe in the version chain
   * @returns Array of all versions including the original
   */
  getRecipeVersions(recipeId: string): RecipeWithRelations[] {
    return this.recipeRepo.getVersions(recipeId);
  }

  /**
   * Get the parent recipe for a version.
   *
   * @param recipeId - The ID of a recipe version
   * @returns The parent recipe, or null if this is not a version
   */
  getParentRecipe(recipeId: string): RecipeWithRelations | null {
    return this.recipeRepo.getParentRecipe(recipeId);
  }

  // ==================== Substitution Suggestions ====================

  /**
   * Get substitution suggestions for all ingredients in a recipe.
   * Useful when the user is missing some ingredients and wants alternatives.
   *
   * @param recipeId - The ID of the recipe
   * @param ingredientNames - Optional list of specific ingredient names to get suggestions for
   *                          (if not provided, gets suggestions for all ingredients)
   * @returns Substitution suggestions for each ingredient
   */
  getSubstitutionSuggestions(
    recipeId: string,
    ingredientNames?: string[]
  ): RecipeSubstitutionSuggestions | null {
    const recipe = this.recipeRepo.getById(recipeId);
    if (!recipe) {
      return null;
    }

    const ingredients: IngredientWithSubstitutions[] = [];
    let totalWithSubstitutions = 0;

    // Get ingredients to process
    const ingredientsToProcess = recipe.ingredients ?? [];

    for (const ing of ingredientsToProcess) {
      // Look up ingredient name from the ingredient table
      const ingredientDetails = this.ingredientRepo.getById(ing.ingredientId);
      const ingredientName = ingredientDetails?.name ?? 'Unknown Ingredient';

      // Skip if we have a specific list and this ingredient isn't in it
      if (ingredientNames && ingredientNames.length > 0) {
        const ingNameLower = ingredientName.toLowerCase();
        const matches = ingredientNames.some(
          name => name.toLowerCase() === ingNameLower
        );
        if (!matches) {
          continue;
        }
      }

      // Find substitutions for this ingredient
      const substitutions = this.substitutionRepo.findByIngredient(ingredientName);
      const hasSubstitutions = substitutions.length > 0;

      if (hasSubstitutions) {
        totalWithSubstitutions++;
      }

      ingredients.push({
        ingredientId: ing.ingredientId,
        ingredientName,
        substitutions,
        hasSubstitutions,
      });
    }

    return {
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      ingredients,
      totalWithSubstitutions,
    };
  }

  /**
   * Get substitution suggestions for missing ingredients.
   * Given a list of ingredients the user doesn't have, find alternatives.
   *
   * @param recipeId - The ID of the recipe
   * @param missingIngredientNames - Names of ingredients the user is missing
   * @returns Substitution suggestions for the missing ingredients
   */
  suggestSubstitutionsForMissing(
    recipeId: string,
    missingIngredientNames: string[]
  ): RecipeSubstitutionSuggestions | null {
    return this.getSubstitutionSuggestions(recipeId, missingIngredientNames);
  }
}
