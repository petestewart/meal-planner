// @meals/core - Domain logic and repositories
export const version = '0.1.0';

// Database connection
export { getDb, closeDb, isDbOpen } from './db/connection.js';
export type { Database, DbOptions } from './db/connection.js';

// Database migrations
export {
  migrate,
  getAppliedMigrations,
  getDefaultMigrationsDir,
} from './db/migrate.js';

// Models - Zod schemas and TypeScript types
export {
  // Ingredient
  IngredientSchema,
  CreateIngredientSchema,
  UpdateIngredientSchema,
  type Ingredient,
  type CreateIngredient,
  type UpdateIngredient,
  // Tag
  TagCategoryEnum,
  TagSchema,
  CreateTagSchema,
  UpdateTagSchema,
  RecipeTagSchema,
  type TagCategory,
  type Tag,
  type CreateTag,
  type UpdateTag,
  type RecipeTag,
  // Recipe
  SourceTypeEnum,
  DifficultyEnum,
  RecipeIngredientSchema,
  CreateRecipeIngredientSchema,
  RecipeSchema,
  CreateRecipeSchema,
  UpdateRecipeSchema,
  RecipeWithRelationsSchema,
  type SourceType,
  type Difficulty,
  type RecipeIngredient,
  type CreateRecipeIngredient,
  type Recipe,
  type CreateRecipe,
  type UpdateRecipe,
  type RecipeWithRelations,
} from './models/index.js';

// Repositories
export {
  RecipeRepository,
  type CreateRecipeIngredientInput,
  type ListRecipesOptions,
} from './repos/index.js';
