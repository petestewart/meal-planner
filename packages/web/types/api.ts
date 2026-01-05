/**
 * API Types for the Meal Planner Web Frontend
 *
 * These types define the structure of data returned by the backend API.
 * They are designed to match the API response format defined in packages/api/src/types.ts
 */

// ==================== API Response Types ====================

/**
 * Standard API response wrapper type
 */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

/**
 * API Error codes as defined in the backend
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IMPORT_FAILED'
  | 'INTERNAL_ERROR';

/**
 * API Error structure
 * Note: code is a string to handle any error code from the backend
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ==================== Recipe Types ====================

/**
 * Valid source types for recipes
 */
export type SourceType = 'manual' | 'imported' | 'agent_curated';

/**
 * Valid difficulty levels for recipes
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Tag category types
 */
export type TagCategory = 'meal_type' | 'dietary' | 'cuisine' | 'season' | 'custom';

/**
 * Tag entity
 */
export interface Tag {
  id: string;
  name: string;
  category: TagCategory | null;
}

/**
 * Ingredient entity
 */
export interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  defaultUnit: string | null;
}

/**
 * Recipe ingredient junction with quantity info
 */
export interface RecipeIngredient {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  optional: boolean;
}

/**
 * Ingredient override for recipe modifications
 */
export interface IngredientOverride {
  original: string;
  replacement: string;
}

/**
 * Recipe modifications (personal notes and changes)
 */
export interface RecipeModification {
  recipeId: string;
  userNotes: string | null;
  ingredientOverrides: IngredientOverride[];
  instructionNotes: string | null;
  updatedAt: string;
}

/**
 * Recipe entity
 */
export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  instructions: string;
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  sourceUrl: string | null;
  sourceType: SourceType | null;
  cuisine: string | null;
  difficulty: Difficulty | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Recipe with related data (ingredients and tags)
 */
export interface RecipeWithRelations extends Recipe {
  ingredients?: RecipeIngredient[];
  tagIds?: string[];
}

/**
 * Input for creating/updating recipe ingredients
 */
export interface IngredientInput {
  ingredientId: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  optional?: boolean;
}

/**
 * Input for creating a recipe
 */
export interface CreateRecipeInput {
  title: string;
  instructions: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients?: IngredientInput[];
  tags?: string[];
  sourceUrl?: string;
  sourceType?: SourceType;
  cuisine?: string;
  difficulty?: Difficulty;
}

/**
 * Input for updating a recipe
 */
export interface UpdateRecipeInput {
  title?: string;
  instructions?: string;
  description?: string | null;
  servings?: number;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  ingredients?: IngredientInput[];
  tags?: string[];
  sourceUrl?: string | null;
  sourceType?: SourceType | null;
  cuisine?: string | null;
  difficulty?: Difficulty | null;
}

/**
 * Input for updating recipe modifications
 */
export interface UpdateModificationsInput {
  userNotes?: string | null;
  ingredientOverrides?: IngredientOverride[];
  instructionNotes?: string | null;
}

/**
 * Pagination info
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Recipe list response with pagination
 */
export interface RecipeListResponse {
  recipes: RecipeWithRelations[];
  pagination: Pagination;
}

/**
 * Options for listing/searching recipes
 */
export interface ListRecipesOptions {
  q?: string;
  tags?: string;
  cuisine?: string;
  favorites?: boolean;
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Recipe import input
 */
export interface ImportRecipeInput {
  url: string;
}

/**
 * Favorite toggle response
 */
export interface FavoriteToggleResponse {
  id: string;
  title: string;
  isFavorite: boolean;
}

// ==================== Plan Types ====================

/**
 * Valid plan status values
 */
export type PlanStatus = 'draft' | 'active' | 'completed';

/**
 * Valid meal type values
 */
export type MealType = 'breakfast' | 'lunch' | 'dinner';

/**
 * Valid slot type values for plan items
 */
export type SlotType = 'recipe' | 'dining_out' | 'skip' | 'leftovers';

/**
 * Day of week (1=Monday, 7=Sunday)
 */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Weekly plan entity
 */
export interface WeeklyPlan {
  id: string;
  week: string;
  status: PlanStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

/**
 * Plan item entity
 */
export interface PlanItem {
  id: string;
  planId: string;
  recipeId: string | null;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  servings: number;
  notes: string | null;
  slotType: SlotType;
  leftoversSourceId?: string | null;
  wasMade: boolean;
}

/**
 * Weekly plan with all its items
 */
export interface WeeklyPlanWithItems extends WeeklyPlan {
  items?: PlanItem[];
}

/**
 * Input for creating a plan
 */
export interface CreatePlanInput {
  week: string;
  notes?: string;
}

/**
 * Input for setting a meal
 */
export interface SetMealInput {
  recipeId: string | null;
  servings?: number;
  notes?: string;
}

/**
 * Input for updating plan status
 */
export interface UpdatePlanStatusInput {
  status: PlanStatus;
}

/**
 * Recipe suggestion with score and reasons
 */
export interface RecipeSuggestion {
  recipe: RecipeWithRelations;
  score: number;
  reasons: string[];
}

/**
 * Slot suggestion for a specific day/meal combination
 */
export interface SlotSuggestion {
  dayOfWeek: number;
  dayName: string;
  mealType: MealType;
  suggestions: RecipeSuggestion[];
}

/**
 * Suggestions response
 */
export interface SuggestionsResponse {
  week: string;
  slots: SlotSuggestion[];
  totalSuggestions: number;
}

/**
 * Options for getting suggestions
 */
export interface SuggestOptions {
  limit?: number;
  mealType?: MealType;
  dayOfWeek?: DayOfWeek;
  recipeFilters?: {
    cuisine?: string;
    tagIds?: string[];
    difficulty?: Difficulty;
    search?: string;
  };
}

// ==================== Grocery Types ====================

/**
 * Grocery item status
 */
export type GroceryItemStatus = 'need_to_buy' | 'already_have' | 'partial';

/**
 * Grocery list item
 */
export interface GroceryItem {
  id: string;
  listId: string;
  ingredientId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  status: GroceryItemStatus;
  haveQuantity: number | null;
  recipeIds: string[];
  isManual: boolean;
  addedAt: string;
}

/**
 * Persistent grocery list
 */
export interface GroceryList {
  id: string;
  week: string;
  items: GroceryItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Grocery list generation response
 */
export interface GroceryListResponse extends GroceryList {
  options: {
    excludePantry: boolean;
    groupBy: 'category' | 'recipe' | 'none';
  };
}

/**
 * Input for generating a grocery list
 */
export interface GenerateGroceryInput {
  week: string;
  excludePantry?: boolean;
  groupBy?: 'category' | 'recipe' | 'none';
}

/**
 * Input for updating a grocery item
 */
export interface UpdateGroceryItemInput {
  status?: GroceryItemStatus;
  haveQuantity?: number | null;
  quantity?: number | null;
  unit?: string | null;
}

/**
 * Input for adding a manual grocery item
 */
export interface AddGroceryItemInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

/**
 * Check pantry response
 */
export interface CheckPantryResponse {
  checkedCount: number;
  updatedItems: GroceryItem[];
}

// ==================== Preference Types ====================

/**
 * Allergy severity levels
 */
export type AllergySeverity = 'avoid' | 'strict';

/**
 * Allergy entry with ingredient and severity
 */
export interface AllergyEntry {
  ingredient: string;
  severity: AllergySeverity;
}

/**
 * Cuisine preferences with liked and disliked arrays
 */
export interface CuisinePreferences {
  liked: string[];
  disliked: string[];
}

/**
 * Planning heuristics for meal planning behavior
 */
export interface PlanningHeuristics {
  preferVariety: boolean;
  balanceCuisines: boolean;
  avoidRepeatInWeek: boolean;
}

/**
 * Prep day options
 */
export type PrepDay =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

/**
 * Full user preferences
 */
export interface UserPreferences {
  dietaryRestrictions: string[];
  dislikedIngredients: string[];
  favoriteCuisines: string[];
  defaultServings: number;
  maxPrepTimeMinutes: number | null;
  planningHeuristics: PlanningHeuristics;
  householdSize: number;
  mealTypes: string[];
  allergies: AllergyEntry[];
  prepDay: PrepDay | null;
  cuisinePreferences: CuisinePreferences;
}

/**
 * Input for updating preferences (partial)
 */
export interface UpdatePreferencesInput {
  dietaryRestrictions?: string[];
  dislikedIngredients?: string[];
  favoriteCuisines?: string[];
  defaultServings?: number;
  maxPrepTimeMinutes?: number | null;
  planningHeuristics?: Partial<PlanningHeuristics>;
  householdSize?: number;
  mealTypes?: string[];
  allergies?: AllergyEntry[];
  prepDay?: PrepDay | null;
  cuisinePreferences?: Partial<CuisinePreferences>;
}

// ==================== Pantry Types ====================

/**
 * Valid storage locations for pantry items
 */
export type PantryLocation = 'fridge' | 'freezer' | 'pantry';

/**
 * Pantry item entity
 */
export interface PantryItem {
  id: string;
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
  expiresAt: string | null; // ISO date string YYYY-MM-DD
  updatedAt: string; // ISO datetime string
  isPrepared: boolean;
  preparationNotes: string | null;
  location: PantryLocation | null;
  isStaple: boolean;
}

/**
 * Pantry item with ingredient details for display
 */
export interface PantryItemWithIngredient extends PantryItem {
  ingredientName: string;
  ingredientCategory: string | null;
}

/**
 * Input for adding a pantry item
 */
export interface AddPantryItemInput {
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
  location?: PantryLocation | null;
  expiresAt?: string | null;
  isPrepared?: boolean;
  preparationNotes?: string | null;
  isStaple?: boolean;
}

/**
 * Input for updating a pantry item
 */
export interface UpdatePantryItemInput {
  quantity?: number | null;
  unit?: string | null;
  location?: PantryLocation | null;
  expiresAt?: string | null;
  isPrepared?: boolean;
  preparationNotes?: string | null;
  isStaple?: boolean;
}

/**
 * Response for adding a pantry item
 */
export interface AddPantryItemResponse {
  item: PantryItemWithIngredient;
  created: boolean;
}

/**
 * Response for listing pantry items
 */
export interface PantryListResponse {
  items: PantryItemWithIngredient[];
}

/**
 * Options for listing pantry items
 */
export interface ListPantryOptions {
  location?: PantryLocation;
  [key: string]: string | number | boolean | undefined;
}
