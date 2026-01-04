/**
 * Agent Tool Schemas
 *
 * Re-exports all tool schemas for curator and planner agents.
 */

// Curator Agent Tool Schemas
export {
  // search_recipes
  SearchRecipesInputSchema,
  SearchRecipesOutputSchema,
  RecipeSummarySchema,
  type SearchRecipesInput,
  type SearchRecipesOutput,
  type RecipeSummary,

  // get_recipe
  GetRecipeInputSchema,
  GetRecipeOutputSchema,
  type GetRecipeInput,
  type GetRecipeOutput,

  // import_recipe
  ImportRecipeInputSchema,
  ImportRecipeOutputSchema,
  type ImportRecipeInput,
  type ImportRecipeOutput,

  // normalize_recipe
  NormalizeIngredientSchema,
  NormalizeUpdatesSchema,
  NormalizeRecipeInputSchema,
  NormalizeRecipeOutputSchema,
  type NormalizeIngredient,
  type NormalizeUpdates,
  type NormalizeRecipeInput,
  type NormalizeRecipeOutput,

  // create_recipe
  CreateIngredientInputSchema,
  CreateRecipeInputSchema,
  CreateRecipeOutputSchema,
  type CreateIngredientInput,
  type CreateRecipeInput,
  type CreateRecipeOutput,
} from './curator.schemas.js';

// Planner Agent Tool Schemas
export {
  // get_preferences
  GetPreferencesInputSchema,
  GetPreferencesOutputSchema,
  type GetPreferencesInput,
  type GetPreferencesOutput,

  // get_week_plan
  GetWeekPlanInputSchema,
  GetWeekPlanOutputSchema,
  EmptySlotSchema,
  type GetWeekPlanInput,
  type GetWeekPlanOutput,
  type EmptySlot,

  // suggest_meals
  MealSlotSchema,
  SuggestionConstraintsSchema,
  SuggestMealsInputSchema,
  SuggestMealsOutputSchema,
  MealSuggestionSchema,
  type MealSlot,
  type SuggestionConstraints,
  type SuggestMealsInput,
  type SuggestMealsOutput,
  type MealSuggestion,

  // set_meal
  SetMealInputSchema,
  SetMealOutputSchema,
  type SetMealInput,
  type SetMealOutput,

  // swap_meal
  SwapMealInputSchema,
  SwapMealOutputSchema,
  RecipeRefSchema,
  type SwapMealInput,
  type SwapMealOutput,
  type RecipeRef,

  // get_swap_alternatives
  GetSwapAlternativesInputSchema,
  GetSwapAlternativesOutputSchema,
  SwapAlternativeSchema,
  type GetSwapAlternativesInput,
  type GetSwapAlternativesOutput,
  type SwapAlternative,

  // generate_grocery_list
  GenerateGroceryListInputSchema,
  GenerateGroceryListOutputSchema,
  GroceryListItemSchema,
  type GenerateGroceryListInput,
  type GenerateGroceryListOutput,
  type GroceryListItem,
} from './planner.schemas.js';
