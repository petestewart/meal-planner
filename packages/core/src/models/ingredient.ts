import { z } from 'zod';

/**
 * Ingredient schema matching the database `ingredients` table.
 *
 * Represents a normalized ingredient that can be referenced by multiple recipes.
 */
export const IngredientSchema = z.object({
  id: z.string().min(1, 'Ingredient ID is required'),
  name: z.string().min(1, 'Ingredient name is required'),
  category: z.string().nullable(),
  defaultUnit: z.string().nullable(),
});

export type Ingredient = z.infer<typeof IngredientSchema>;

/**
 * Schema for creating a new ingredient (without id).
 */
export const CreateIngredientSchema = IngredientSchema.omit({ id: true });
export type CreateIngredient = z.infer<typeof CreateIngredientSchema>;

/**
 * Schema for updating an ingredient (all fields optional except id).
 */
export const UpdateIngredientSchema = IngredientSchema.partial().required({ id: true });
export type UpdateIngredient = z.infer<typeof UpdateIngredientSchema>;
