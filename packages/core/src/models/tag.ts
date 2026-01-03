import { z } from 'zod';

/**
 * Valid tag categories as defined in the database schema.
 */
export const TagCategoryEnum = z.enum([
  'meal_type',
  'dietary',
  'cuisine',
  'season',
  'custom',
]);

export type TagCategory = z.infer<typeof TagCategoryEnum>;

/**
 * Tag schema matching the database `tags` table.
 *
 * Tags are used to categorize recipes for filtering and organization.
 */
export const TagSchema = z.object({
  id: z.string().min(1, 'Tag ID is required'),
  name: z.string().min(1, 'Tag name is required'),
  category: TagCategoryEnum.nullable(),
});

export type Tag = z.infer<typeof TagSchema>;

/**
 * Schema for creating a new tag (without id).
 */
export const CreateTagSchema = TagSchema.omit({ id: true });
export type CreateTag = z.infer<typeof CreateTagSchema>;

/**
 * Schema for updating a tag (all fields optional except id).
 */
export const UpdateTagSchema = TagSchema.partial().required({ id: true });
export type UpdateTag = z.infer<typeof UpdateTagSchema>;

/**
 * Recipe-Tag junction schema for the `recipe_tags` table.
 */
export const RecipeTagSchema = z.object({
  recipeId: z.string().min(1, 'Recipe ID is required'),
  tagId: z.string().min(1, 'Tag ID is required'),
});

export type RecipeTag = z.infer<typeof RecipeTagSchema>;
