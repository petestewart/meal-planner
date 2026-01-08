import { z } from 'zod';

/**
 * PrepBatch schema matching the database `prep_batches` table.
 *
 * Represents a batch cooking/meal prep session where multiple servings
 * of a recipe are prepared at once and used for multiple meals.
 */
export const PrepBatchSchema = z.object({
  id: z.string().min(1, 'PrepBatch ID is required'),
  recipeId: z.string().min(1, 'Recipe ID is required'),
  prepDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
  totalServings: z.number().int().positive('Total servings must be positive'),
  notes: z.string().nullable(),
  createdAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)),
  updatedAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)),
});

export type PrepBatch = z.infer<typeof PrepBatchSchema>;

/**
 * Schema for creating a new prep batch (without id and timestamps).
 */
export const CreatePrepBatchSchema = PrepBatchSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreatePrepBatch = z.infer<typeof CreatePrepBatchSchema>;

/**
 * Schema for updating a prep batch (all fields optional except id).
 */
export const UpdatePrepBatchSchema = PrepBatchSchema.omit({
  createdAt: true,
  updatedAt: true,
}).partial().required({ id: true });
export type UpdatePrepBatch = z.infer<typeof UpdatePrepBatchSchema>;

/**
 * Prep batch with related recipe information.
 * Used when loading a prep batch with its associated recipe title.
 */
export const PrepBatchWithRecipeSchema = PrepBatchSchema.extend({
  recipeTitle: z.string().optional(),
});
export type PrepBatchWithRecipe = z.infer<typeof PrepBatchWithRecipeSchema>;

/**
 * Prep batch with remaining servings calculated.
 * Used for display to show how many servings are left after allocated meals.
 */
export const PrepBatchWithRemainingSchema = PrepBatchWithRecipeSchema.extend({
  remainingServings: z.number().int(),
  allocatedServings: z.number().int(),
  linkedMeals: z.number().int(),
});
export type PrepBatchWithRemaining = z.infer<typeof PrepBatchWithRemainingSchema>;
