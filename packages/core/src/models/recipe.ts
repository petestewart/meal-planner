import { z } from 'zod';

/**
 * Valid source types for recipes as defined in the database schema.
 */
export const SourceTypeEnum = z.enum(['manual', 'imported', 'agent_curated']);
export type SourceType = z.infer<typeof SourceTypeEnum>;

/**
 * Valid difficulty levels for recipes as defined in the database schema.
 */
export const DifficultyEnum = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof DifficultyEnum>;

/**
 * RecipeIngredient schema matching the database `recipe_ingredients` table.
 *
 * Represents the junction between recipes and ingredients with quantity/unit info.
 */
export const RecipeIngredientSchema = z.object({
  id: z.string().min(1, 'RecipeIngredient ID is required'),
  recipeId: z.string().min(1, 'Recipe ID is required'),
  ingredientId: z.string().min(1, 'Ingredient ID is required'),
  quantity: z.number().positive().nullable(),
  unit: z.string().nullable(),
  notes: z.string().nullable(),
  optional: z.boolean().default(false),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

/**
 * Schema for creating a new recipe ingredient (without id).
 */
export const CreateRecipeIngredientSchema = RecipeIngredientSchema.omit({ id: true });
export type CreateRecipeIngredient = z.infer<typeof CreateRecipeIngredientSchema>;

/**
 * Recipe schema matching the database `recipes` table.
 *
 * Represents a recipe with all its metadata.
 */
export const RecipeSchema = z.object({
  id: z.string().min(1, 'Recipe ID is required'),
  title: z.string().min(1, 'Recipe title is required'),
  description: z.string().nullable(),
  instructions: z.string().min(1, 'Recipe instructions are required'),
  servings: z.number().int().positive().default(4),
  prepTimeMinutes: z.number().int().nonnegative().nullable(),
  cookTimeMinutes: z.number().int().nonnegative().nullable(),
  sourceUrl: z.string().url().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  sourceType: SourceTypeEnum.nullable(),
  cuisine: z.string().nullable(),
  difficulty: DifficultyEnum.nullable(),
  isFavorite: z.boolean().default(false),
  createdAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)),
  updatedAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)),
});

export type Recipe = z.infer<typeof RecipeSchema>;

/**
 * Schema for creating a new recipe (without id, timestamps, and isFavorite).
 * isFavorite defaults to false and is set via the favorite toggle command.
 */
export const CreateRecipeSchema = RecipeSchema.omit({
  id: true,
  isFavorite: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateRecipe = z.infer<typeof CreateRecipeSchema>;

/**
 * Schema for updating a recipe (all fields optional except id).
 * isFavorite is omitted as it's managed via the favorite toggle command.
 */
export const UpdateRecipeSchema = RecipeSchema.omit({
  isFavorite: true,
  createdAt: true,
  updatedAt: true,
}).partial().required({ id: true });
export type UpdateRecipe = z.infer<typeof UpdateRecipeSchema>;

/**
 * Full recipe with related data (ingredients and tags).
 * Used when loading a complete recipe from the database.
 */
export const RecipeWithRelationsSchema = RecipeSchema.extend({
  ingredients: z.array(RecipeIngredientSchema).optional(),
  tagIds: z.array(z.string()).optional(),
});

export type RecipeWithRelations = z.infer<typeof RecipeWithRelationsSchema>;
