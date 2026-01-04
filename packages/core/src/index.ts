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
  // Preference
  PlanningHeuristicsSchema,
  UserPreferencesSchema,
  PreferenceKeyEnum,
  DEFAULT_PREFERENCES,
  PreferenceRowSchema,
  SetPreferenceSchema,
  PreferenceValueSchemas,
  getDefaultPreference,
  validatePreferenceValue,
  parsePreferenceValue,
  // Enhanced preference exports (T044)
  AllergySeverityEnum,
  AllergyEntrySchema,
  CuisinePreferencesSchema,
  PrepDayEnum,
  type PlanningHeuristics,
  type UserPreferences,
  type PreferenceKey,
  type PreferenceRow,
  type SetPreference,
  // Enhanced preference types (T044)
  type AllergySeverity,
  type AllergyEntry,
  type CuisinePreferences,
  type PrepDay,
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
  PreferenceRepository,
  type PreferenceData,
  TagRepository,
  IngredientRepository,
  INGREDIENT_CATEGORIES,
  getAutoCategory,
  isValidCategory,
  type IngredientCategory,
  GroceryListRepository,
  type PersistedGroceryList,
  type PersistedGroceryItem,
  type PersistedGroceryListWithItems,
  type CreateGroceryItemInput,
  type UpdateGroceryItemInput,
} from './repos/index.js';

// Re-export GroceryItemStatus type from repos
export type { GroceryItemStatus } from './repos/index.js';

// Services
export {
  RecipeService,
  PlanService,
  GroceryService,
  type GroceryItem,
  type GroceryGroup,
  type GroceryList,
  type GroceryListItemWithStatus,
  type PersistentGroceryList,
  type CheckPantryResult,
  PreferenceService,
  ImportService,
  type ImportedRecipeData,
  type ImportResult,
  type SaveImportResult,
  type ImportOptions,
  SuggestionService,
  type SuggestionReason,
  type RecipeSuggestion,
  type SuggestionContext,
  type GetSuggestionsOptions,
  SCORING_WEIGHTS,
  RECENT_DAYS_THRESHOLD,
} from './services/index.js';
