import { z } from 'zod';

/**
 * Substitution schema matching the database `substitutions` table.
 *
 * Represents an ingredient substitution with dietary tags for filtering.
 */
export const SubstitutionSchema = z.object({
  id: z.string().min(1, 'Substitution ID is required'),
  originalIngredient: z.string().min(1, 'Original ingredient is required'),
  substituteIngredients: z.string().min(1, 'Substitute ingredients is required'),
  substituteDescription: z.string().nullable(),
  dietaryTags: z.array(z.string()), // Parsed from JSON
  isUserDefined: z.boolean().default(false),
  createdAt: z.string(), // ISO datetime string
});

export type Substitution = z.infer<typeof SubstitutionSchema>;

/**
 * Schema for creating a new substitution
 */
export const CreateSubstitutionSchema = z.object({
  originalIngredient: z.string().min(1, 'Original ingredient is required'),
  substituteIngredients: z.string().min(1, 'Substitute ingredients is required'),
  substituteDescription: z.string().nullable().optional(),
  dietaryTags: z.array(z.string()).optional().default([]),
  isUserDefined: z.boolean().optional().default(true), // User-created substitutions default to true
});

export type CreateSubstitution = z.infer<typeof CreateSubstitutionSchema>;

/**
 * Schema for updating a substitution
 */
export const UpdateSubstitutionSchema = z.object({
  id: z.string().min(1, 'Substitution ID is required'),
  substituteIngredients: z.string().min(1).optional(),
  substituteDescription: z.string().nullable().optional(),
  dietaryTags: z.array(z.string()).optional(),
});

export type UpdateSubstitution = z.infer<typeof UpdateSubstitutionSchema>;

/**
 * Common dietary tags for substitutions
 */
export const DIETARY_TAGS = [
  'gluten-free',
  'dairy-free',
  'vegan',
  'vegetarian',
  'egg-free',
  'soy-free',
  'nut-free',
  'grain-free',
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number];

/**
 * Check if a string is a valid dietary tag
 */
export function isValidDietaryTag(tag: string): tag is DietaryTag {
  return DIETARY_TAGS.includes(tag as DietaryTag);
}
