/**
 * Planner Agent Tool Schemas
 *
 * Zod schemas for all planner agent tools as defined in PLAN.md Deliverable E.
 * The planner agent is responsible for building and refining weekly meal plans.
 */

import { z } from 'zod';
import {
  UserPreferencesSchema,
  WeeklyPlanWithItemsSchema,
  IsoWeekSchema,
  MealTypeEnum,
  DayOfWeekSchema,
  PlanItemSchema,
} from '@meals/core';

// ============================================================================
// 1. get_preferences
// ============================================================================

/**
 * Input schema for get_preferences tool.
 * Takes no input parameters.
 */
export const GetPreferencesInputSchema = z.object({});

export type GetPreferencesInput = z.infer<typeof GetPreferencesInputSchema>;

/**
 * Output schema for get_preferences tool.
 * Returns the user preferences.
 */
export const GetPreferencesOutputSchema = z.object({
  preferences: UserPreferencesSchema,
});

export type GetPreferencesOutput = z.infer<typeof GetPreferencesOutputSchema>;

// ============================================================================
// 2. get_week_plan
// ============================================================================

/**
 * Input schema for get_week_plan tool.
 * Retrieves a weekly plan by ISO week string.
 */
export const GetWeekPlanInputSchema = z.object({
  week: IsoWeekSchema,
});

export type GetWeekPlanInput = z.infer<typeof GetWeekPlanInputSchema>;

/**
 * Schema for an empty slot in the weekly plan.
 */
export const EmptySlotSchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeEnum,
});

export type EmptySlot = z.infer<typeof EmptySlotSchema>;

/**
 * Output schema for get_week_plan tool.
 * Returns the plan (or null if not exists), filled slot count, and empty slots.
 */
export const GetWeekPlanOutputSchema = z.object({
  plan: WeeklyPlanWithItemsSchema.nullable(),
  filledSlots: z.number().int().nonnegative(),
  emptySlots: z.array(EmptySlotSchema),
});

export type GetWeekPlanOutput = z.infer<typeof GetWeekPlanOutputSchema>;

// ============================================================================
// 3. suggest_meals
// ============================================================================

/**
 * Schema for a slot to fill with a meal suggestion.
 */
export const MealSlotSchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeEnum,
});

export type MealSlot = z.infer<typeof MealSlotSchema>;

/**
 * Schema for suggestion constraints.
 */
export const SuggestionConstraintsSchema = z.object({
  maxPrepTime: z.number().int().positive().optional(),
  cuisines: z.array(z.string()).optional(),
  excludeRecipes: z.array(z.string()).optional(),
  preferVariety: z.boolean().optional(),
  considerPantry: z.boolean().optional(),
});

export type SuggestionConstraints = z.infer<typeof SuggestionConstraintsSchema>;

/**
 * Input schema for suggest_meals tool.
 * Generates meal suggestions for specified slots.
 */
export const SuggestMealsInputSchema = z.object({
  week: IsoWeekSchema,
  slots: z.array(MealSlotSchema).min(1, 'At least one slot is required'),
  constraints: SuggestionConstraintsSchema.optional(),
});

export type SuggestMealsInput = z.infer<typeof SuggestMealsInputSchema>;

/**
 * Schema for a single meal suggestion.
 */
export const MealSuggestionSchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeEnum,
  recipeId: z.string(),
  recipeTitle: z.string(),
  score: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type MealSuggestion = z.infer<typeof MealSuggestionSchema>;

/**
 * Output schema for suggest_meals tool.
 * Returns a list of meal suggestions with scores and reasoning.
 */
export const SuggestMealsOutputSchema = z.object({
  suggestions: z.array(MealSuggestionSchema),
});

export type SuggestMealsOutput = z.infer<typeof SuggestMealsOutputSchema>;

// ============================================================================
// 4. set_meal
// ============================================================================

/**
 * Input schema for set_meal tool.
 * Sets a specific meal in the weekly plan.
 */
export const SetMealInputSchema = z.object({
  week: IsoWeekSchema,
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeEnum,
  recipeId: z.string().min(1, 'Recipe ID is required'),
  servings: z.number().int().positive().optional(),
});

export type SetMealInput = z.infer<typeof SetMealInputSchema>;

/**
 * Output schema for set_meal tool.
 * Returns the created/updated plan item.
 */
export const SetMealOutputSchema = z.object({
  planItem: PlanItemSchema,
});

export type SetMealOutput = z.infer<typeof SetMealOutputSchema>;

// ============================================================================
// 5. swap_meal
// ============================================================================

/**
 * Input schema for swap_meal tool.
 * Swaps a meal with a different recipe, providing a reason for audit.
 */
export const SwapMealInputSchema = z.object({
  week: IsoWeekSchema,
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeEnum,
  reason: z.string().min(1, 'Reason is required for audit'),
  newRecipeId: z.string().min(1, 'New recipe ID is required'),
});

export type SwapMealInput = z.infer<typeof SwapMealInputSchema>;

/**
 * Schema for a recipe reference (id and title).
 */
export const RecipeRefSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export type RecipeRef = z.infer<typeof RecipeRefSchema>;

/**
 * Output schema for swap_meal tool.
 * Returns the old and new recipe references plus the updated plan item.
 */
export const SwapMealOutputSchema = z.object({
  oldRecipe: RecipeRefSchema,
  newRecipe: RecipeRefSchema,
  planItem: PlanItemSchema,
});

export type SwapMealOutput = z.infer<typeof SwapMealOutputSchema>;

// ============================================================================
// 6. get_swap_alternatives
// ============================================================================

/**
 * Input schema for get_swap_alternatives tool.
 * Gets alternative recipes for swapping a meal.
 */
export const GetSwapAlternativesInputSchema = z.object({
  week: IsoWeekSchema,
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeEnum,
  reason: z.string().optional(),
  count: z.number().int().positive().default(3).optional(),
});

export type GetSwapAlternativesInput = z.infer<typeof GetSwapAlternativesInputSchema>;

/**
 * Schema for a swap alternative.
 */
export const SwapAlternativeSchema = z.object({
  recipeId: z.string(),
  recipeTitle: z.string(),
  reasoning: z.string(),
  score: z.number().min(0).max(100),
});

export type SwapAlternative = z.infer<typeof SwapAlternativeSchema>;

/**
 * Output schema for get_swap_alternatives tool.
 * Returns the current recipe and a list of alternatives.
 */
export const GetSwapAlternativesOutputSchema = z.object({
  currentRecipe: RecipeRefSchema,
  alternatives: z.array(SwapAlternativeSchema),
});

export type GetSwapAlternativesOutput = z.infer<typeof GetSwapAlternativesOutputSchema>;

// ============================================================================
// 7. generate_grocery_list
// ============================================================================

/**
 * Input schema for generate_grocery_list tool.
 * Generates a grocery list for a weekly plan.
 */
export const GenerateGroceryListInputSchema = z.object({
  week: IsoWeekSchema,
  excludePantry: z.boolean().optional(),
});

export type GenerateGroceryListInput = z.infer<typeof GenerateGroceryListInputSchema>;

/**
 * Schema for a grocery list item.
 */
export const GroceryListItemSchema = z.object({
  ingredient: z.string(),
  quantity: z.number(),
  unit: z.string(),
  category: z.string(),
  recipes: z.array(z.string()),
});

export type GroceryListItem = z.infer<typeof GroceryListItemSchema>;

/**
 * Output schema for generate_grocery_list tool.
 * Returns the list of grocery items and total count.
 */
export const GenerateGroceryListOutputSchema = z.object({
  items: z.array(GroceryListItemSchema),
  totalItems: z.number().int().nonnegative(),
});

export type GenerateGroceryListOutput = z.infer<typeof GenerateGroceryListOutputSchema>;
