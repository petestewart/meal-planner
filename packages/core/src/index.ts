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
  // Plan
  ISO_WEEK_REGEX,
  IsoWeekSchema,
  isValidIsoWeek,
  PlanStatusEnum,
  MealTypeEnum,
  DayOfWeekSchema,
  WeeklyPlanSchema,
  CreateWeeklyPlanSchema,
  UpdateWeeklyPlanSchema,
  PlanItemSchema,
  CreatePlanItemSchema,
  UpdatePlanItemSchema,
  WeeklyPlanWithItemsSchema,
  type IsoWeek,
  type PlanStatus,
  type MealType,
  type DayOfWeek,
  type WeeklyPlan,
  type CreateWeeklyPlan,
  type UpdateWeeklyPlan,
  type PlanItem,
  type CreatePlanItem,
  type UpdatePlanItem,
  type WeeklyPlanWithItems,
} from './models/index.js';

// Repositories
export {
  RecipeRepository,
  type CreateRecipeIngredientInput,
  type ListRecipesOptions,
  AuditRepository,
  type AuditActor,
  type AuditAction,
  type CreateAuditLogEntry,
  type AuditLogEntry,
  PlanRepository,
  type ListPlansOptions,
} from './repos/index.js';

// Services
export { RecipeService, PlanService } from './services/index.js';
