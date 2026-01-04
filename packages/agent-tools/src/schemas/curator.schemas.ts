/**
 * Curator Agent Tool Schemas
 *
 * Zod schemas for all curator agent tools as defined in PLAN.md Deliverable E.
 * The curator agent is responsible for importing, normalizing, and maintaining recipe quality.
 */

import { z } from 'zod';
import {
  RecipeSchema,
  DifficultyEnum,
} from '@meals/core';

// ============================================================================
// 1. search_recipes
// ============================================================================

/**
 * Input schema for search_recipes tool.
 * Searches for recipes by query, tags, cuisine, with optional limit.
 */
export const SearchRecipesInputSchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  cuisine: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});

export type SearchRecipesInput = z.infer<typeof SearchRecipesInputSchema>;

/**
 * Recipe summary returned in search results.
 */
export const RecipeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  cuisine: z.string().nullable(),
  tags: z.array(z.string()),
  prepTimeMinutes: z.number().int().nonnegative().nullable(),
  cookTimeMinutes: z.number().int().nonnegative().nullable(),
});

export type RecipeSummary = z.infer<typeof RecipeSummarySchema>;

/**
 * Output schema for search_recipes tool.
 */
export const SearchRecipesOutputSchema = z.object({
  recipes: z.array(RecipeSummarySchema),
  total: z.number().int().nonnegative(),
});

export type SearchRecipesOutput = z.infer<typeof SearchRecipesOutputSchema>;

// ============================================================================
// 2. get_recipe
// ============================================================================

/**
 * Input schema for get_recipe tool.
 * Retrieves a single recipe by ID.
 */
export const GetRecipeInputSchema = z.object({
  id: z.string().min(1, 'Recipe ID is required'),
});

export type GetRecipeInput = z.infer<typeof GetRecipeInputSchema>;

/**
 * Output schema for get_recipe tool.
 * Returns the full recipe with all details.
 */
export const GetRecipeOutputSchema = z.object({
  recipe: RecipeSchema,
});

export type GetRecipeOutput = z.infer<typeof GetRecipeOutputSchema>;

// ============================================================================
// 3. import_recipe
// ============================================================================

/**
 * Input schema for import_recipe tool.
 * Imports a recipe from a URL.
 */
export const ImportRecipeInputSchema = z.object({
  url: z.string().url('Valid URL is required'),
});

export type ImportRecipeInput = z.infer<typeof ImportRecipeInputSchema>;

/**
 * Output schema for import_recipe tool.
 * Returns success status and either the recipe or an error message.
 */
export const ImportRecipeOutputSchema = z.object({
  success: z.boolean(),
  recipe: RecipeSchema.optional(),
  error: z.string().optional(),
});

export type ImportRecipeOutput = z.infer<typeof ImportRecipeOutputSchema>;

// ============================================================================
// 4. normalize_recipe
// ============================================================================

/**
 * Ingredient update schema for normalize_recipe tool.
 */
export const NormalizeIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
});

export type NormalizeIngredient = z.infer<typeof NormalizeIngredientSchema>;

/**
 * Updates that can be applied when normalizing a recipe.
 */
export const NormalizeUpdatesSchema = z.object({
  title: z.string().min(1).optional(),
  ingredients: z.array(NormalizeIngredientSchema).optional(),
  tags: z.array(z.string()).optional(),
  cuisine: z.string().optional(),
  difficulty: DifficultyEnum.optional(),
});

export type NormalizeUpdates = z.infer<typeof NormalizeUpdatesSchema>;

/**
 * Input schema for normalize_recipe tool.
 * Updates a recipe with normalized data.
 */
export const NormalizeRecipeInputSchema = z.object({
  id: z.string().min(1, 'Recipe ID is required'),
  updates: NormalizeUpdatesSchema,
});

export type NormalizeRecipeInput = z.infer<typeof NormalizeRecipeInputSchema>;

/**
 * Output schema for normalize_recipe tool.
 * Returns the updated recipe.
 */
export const NormalizeRecipeOutputSchema = z.object({
  recipe: RecipeSchema,
});

export type NormalizeRecipeOutput = z.infer<typeof NormalizeRecipeOutputSchema>;

// ============================================================================
// 5. create_recipe
// ============================================================================

/**
 * Ingredient schema for create_recipe tool.
 */
export const CreateIngredientInputSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  optional: z.boolean().optional(),
});

export type CreateIngredientInput = z.infer<typeof CreateIngredientInputSchema>;

/**
 * Input schema for create_recipe tool.
 * Creates a new recipe with all details.
 */
export const CreateRecipeInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  instructions: z.string().min(1, 'Instructions are required'),
  servings: z.number().int().positive().optional(),
  prepTimeMinutes: z.number().int().nonnegative().optional(),
  cookTimeMinutes: z.number().int().nonnegative().optional(),
  ingredients: z.array(CreateIngredientInputSchema).min(1, 'At least one ingredient is required'),
  tags: z.array(z.string()).optional(),
  cuisine: z.string().optional(),
  difficulty: DifficultyEnum.optional(),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>;

/**
 * Output schema for create_recipe tool.
 * Returns the created recipe.
 */
export const CreateRecipeOutputSchema = z.object({
  recipe: RecipeSchema,
});

export type CreateRecipeOutput = z.infer<typeof CreateRecipeOutputSchema>;
