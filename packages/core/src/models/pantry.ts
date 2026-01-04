import { z } from 'zod';

/**
 * Valid storage locations for pantry items
 */
export const PantryLocationEnum = z.enum(['fridge', 'freezer', 'pantry']);
export type PantryLocation = z.infer<typeof PantryLocationEnum>;

/**
 * Pantry locations as a constant array for CLI help text
 */
export const PANTRY_LOCATIONS = ['fridge', 'freezer', 'pantry'] as const;

/**
 * Pantry item schema matching the database `pantry_items` table.
 *
 * Represents an ingredient in the user's pantry with quantity, location,
 * expiration, and preparation status tracking.
 */
export const PantryItemSchema = z.object({
  id: z.string().min(1, 'Pantry item ID is required'),
  ingredientId: z.string().min(1, 'Ingredient ID is required'),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  expiresAt: z.string().nullable(), // ISO date string
  updatedAt: z.string(), // ISO datetime string
  isPrepared: z.boolean().default(false),
  preparationNotes: z.string().nullable(),
  location: PantryLocationEnum.nullable(),
  isStaple: z.boolean().default(false),
});

export type PantryItem = z.infer<typeof PantryItemSchema>;

/**
 * Extended pantry item with ingredient name for display
 */
export const PantryItemWithIngredientSchema = PantryItemSchema.extend({
  ingredientName: z.string(),
  ingredientCategory: z.string().nullable(),
});

export type PantryItemWithIngredient = z.infer<typeof PantryItemWithIngredientSchema>;

/**
 * Schema for creating a new pantry item
 */
export const CreatePantryItemSchema = z.object({
  ingredientId: z.string().min(1, 'Ingredient ID is required'),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(), // ISO date string YYYY-MM-DD
  isPrepared: z.boolean().optional().default(false),
  preparationNotes: z.string().nullable().optional(),
  location: PantryLocationEnum.nullable().optional(),
  isStaple: z.boolean().optional().default(false),
});

export type CreatePantryItem = z.infer<typeof CreatePantryItemSchema>;

/**
 * Schema for updating a pantry item
 */
export const UpdatePantryItemSchema = z.object({
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isPrepared: z.boolean().optional(),
  preparationNotes: z.string().nullable().optional(),
  location: PantryLocationEnum.nullable().optional(),
  isStaple: z.boolean().optional(),
});

export type UpdatePantryItem = z.infer<typeof UpdatePantryItemSchema>;

/**
 * Check if a location string is valid
 */
export function isValidPantryLocation(location: string): location is PantryLocation {
  return PANTRY_LOCATIONS.includes(location as PantryLocation);
}
