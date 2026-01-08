import { z } from 'zod';

/**
 * Valid store sections for grocery list organization.
 * These represent physical sections in a typical grocery store.
 */
export const StoreSectionEnum = z.enum([
  'produce',
  'meat',
  'seafood',
  'dairy',
  'bakery',
  'frozen',
  'pantry',
  'beverages',
  'condiments',
  'spices',
  'other',
]);

export type StoreSection = z.infer<typeof StoreSectionEnum>;

export const STORE_SECTIONS = StoreSectionEnum.options;

/**
 * Check if a string is a valid store section.
 */
export function isValidStoreSection(section: string): section is StoreSection {
  return STORE_SECTIONS.includes(section as StoreSection);
}

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
  storeSection: StoreSectionEnum.nullable(),
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
