/**
 * Planner Agent Tool Handlers
 *
 * Handler functions for planner agent tools that:
 * - Validate inputs using T024 schemas
 * - Call core services (PlanService, GroceryService, PreferenceService, RecipeService)
 * - Audit log all mutations with agent_id
 * - Return outputs matching T024 output schemas
 */

import type { Database } from 'better-sqlite3';
import {
  PlanService,
  GroceryService,
  PreferenceService,
  RecipeService,
  type MealType,
} from '@meals/core';
import {
  GetPreferencesInputSchema,
  GetWeekPlanInputSchema,
  SuggestMealsInputSchema,
  SetMealInputSchema,
  SwapMealInputSchema,
  GetSwapAlternativesInputSchema,
  GenerateGroceryListInputSchema,
  type GetPreferencesInput,
  type GetPreferencesOutput,
  type GetWeekPlanInput,
  type GetWeekPlanOutput,
  type SuggestMealsInput,
  type SuggestMealsOutput,
  type SetMealInput,
  type SetMealOutput,
  type SwapMealInput,
  type SwapMealOutput,
  type GetSwapAlternativesInput,
  type GetSwapAlternativesOutput,
  type GenerateGroceryListInput,
  type GenerateGroceryListOutput,
  type EmptySlot,
  type MealSuggestion,
  type SwapAlternative,
  type GroceryListItem,
} from '../schemas/index.js';

import type { AgentContext, ToolHandler } from './curator.tools.js';

/**
 * Get the actor string for audit logging.
 */
function getActor(context: AgentContext): string {
  return `agent:${context.agentId}`;
}

/**
 * All meal types in the plan.
 */
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

/**
 * Days of the week (1-7, Monday-Sunday).
 */
const DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

// ============================================================================
// 1. get_preferences - Get via PreferenceService.getAllPreferences
// ============================================================================

/**
 * Get all user preferences.
 */
export const getPreferences: ToolHandler<GetPreferencesInput, GetPreferencesOutput> = async (
  input,
  context
) => {
  // Validate input (empty object)
  GetPreferencesInputSchema.parse(input);

  const preferenceService = new PreferenceService(context.db);
  const preferences = preferenceService.getAllPreferences();

  return {
    preferences,
  };
};

// ============================================================================
// 2. get_week_plan - Get plan and calculate empty slots
// ============================================================================

/**
 * Get a weekly plan by ISO week string and calculate empty slots.
 */
export const getWeekPlan: ToolHandler<GetWeekPlanInput, GetWeekPlanOutput> = async (
  input,
  context
) => {
  // Validate input
  const validated = GetWeekPlanInputSchema.parse(input);

  const planService = new PlanService(context.db);
  const plan = planService.getPlanByWeek(validated.week);

  // Calculate filled and empty slots
  const filledSlots: Set<string> = new Set();
  const emptySlots: EmptySlot[] = [];

  if (plan && plan.items) {
    for (const item of plan.items) {
      if (item.recipeId) {
        filledSlots.add(`${item.dayOfWeek}-${item.mealType}`);
      }
    }
  }

  // Calculate all possible slots and find empty ones
  for (const day of DAYS_OF_WEEK) {
    for (const mealType of MEAL_TYPES) {
      const key = `${day}-${mealType}`;
      if (!filledSlots.has(key)) {
        emptySlots.push({
          dayOfWeek: day,
          mealType,
        });
      }
    }
  }

  return {
    plan: plan ?? null,
    filledSlots: filledSlots.size,
    emptySlots,
  };
};

// ============================================================================
// 3. suggest_meals - Return placeholder suggestions (algorithm not implemented)
// ============================================================================

/**
 * Generate meal suggestions for specified slots.
 * NOTE: This returns placeholder suggestions as the algorithm is not yet implemented.
 */
export const suggestMeals: ToolHandler<SuggestMealsInput, SuggestMealsOutput> = async (
  input,
  context
) => {
  // Validate input
  const validated = SuggestMealsInputSchema.parse(input);

  const recipeService = new RecipeService(context.db);

  // Get some recipes to use as placeholders
  const recipes = recipeService.listRecipes({ limit: validated.slots.length * 3 });

  // Generate placeholder suggestions for each slot
  const suggestions: MealSuggestion[] = [];

  for (let i = 0; i < validated.slots.length; i++) {
    const slot = validated.slots[i];
    const recipe = recipes[i % recipes.length];

    if (recipe) {
      suggestions.push({
        dayOfWeek: slot.dayOfWeek,
        mealType: slot.mealType,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        score: 75, // Placeholder score
        reasoning: 'Placeholder suggestion - recommendation algorithm not yet implemented',
      });
    }
  }

  return {
    suggestions,
  };
};

// ============================================================================
// 4. set_meal - Set via PlanService.setMeal
// ============================================================================

/**
 * Set a specific meal in the weekly plan.
 */
export const setMeal: ToolHandler<SetMealInput, SetMealOutput> = async (
  input,
  context
) => {
  // Validate input
  const validated = SetMealInputSchema.parse(input);

  const planService = new PlanService(context.db);
  const actor = getActor(context);

  // Get or create the plan for this week
  let plan = planService.getPlanByWeek(validated.week);
  if (!plan) {
    plan = planService.createPlan(
      { week: validated.week, status: 'draft', notes: null },
      actor
    );
  }

  // Set the meal
  const planItem = planService.setMeal(
    plan.id,
    validated.dayOfWeek,
    validated.mealType,
    validated.recipeId,
    validated.servings,
    undefined, // notes
    actor
  );

  if (!planItem) {
    throw new Error('Failed to set meal');
  }

  return {
    planItem,
  };
};

// ============================================================================
// 5. swap_meal - Swap via PlanService.setMeal with audit of old/new
// ============================================================================

/**
 * Swap a meal with a different recipe.
 */
export const swapMeal: ToolHandler<SwapMealInput, SwapMealOutput> = async (
  input,
  context
) => {
  // Validate input
  const validated = SwapMealInputSchema.parse(input);

  const planService = new PlanService(context.db);
  const recipeService = new RecipeService(context.db);
  const actor = getActor(context);

  // Get the plan for this week
  const plan = planService.getPlanByWeek(validated.week);
  if (!plan) {
    throw new Error(`No plan found for week '${validated.week}'`);
  }

  // Find the existing meal in this slot
  const existingItem = plan.items?.find(
    (item) =>
      item.dayOfWeek === validated.dayOfWeek && item.mealType === validated.mealType
  );

  if (!existingItem || !existingItem.recipeId) {
    throw new Error(
      `No meal found at day ${validated.dayOfWeek}, ${validated.mealType} to swap`
    );
  }

  // Get the old recipe details
  const oldRecipe = recipeService.getRecipe(existingItem.recipeId);
  if (!oldRecipe) {
    throw new Error(`Old recipe '${existingItem.recipeId}' not found`);
  }

  // Get the new recipe details
  const newRecipe = recipeService.getRecipe(validated.newRecipeId);
  if (!newRecipe) {
    throw new Error(`New recipe '${validated.newRecipeId}' not found`);
  }

  // Perform the swap by setting the new recipe
  // The audit log will include the reason in the metadata
  const planItem = planService.setMeal(
    plan.id,
    validated.dayOfWeek,
    validated.mealType,
    validated.newRecipeId,
    existingItem.servings, // Keep the same servings
    validated.reason, // Use reason as notes for audit trail
    actor
  );

  if (!planItem) {
    throw new Error('Failed to swap meal');
  }

  return {
    oldRecipe: {
      id: oldRecipe.id,
      title: oldRecipe.title,
    },
    newRecipe: {
      id: newRecipe.id,
      title: newRecipe.title,
    },
    planItem,
  };
};

// ============================================================================
// 6. get_swap_alternatives - Return placeholder alternatives
// ============================================================================

/**
 * Get alternative recipes for swapping a meal.
 * NOTE: Returns placeholder alternatives as the algorithm is not yet implemented.
 */
export const getSwapAlternatives: ToolHandler<
  GetSwapAlternativesInput,
  GetSwapAlternativesOutput
> = async (input, context) => {
  // Validate input
  const validated = GetSwapAlternativesInputSchema.parse(input);

  const planService = new PlanService(context.db);
  const recipeService = new RecipeService(context.db);

  // Get the plan for this week
  const plan = planService.getPlanByWeek(validated.week);
  if (!plan) {
    throw new Error(`No plan found for week '${validated.week}'`);
  }

  // Find the current meal in this slot
  const currentItem = plan.items?.find(
    (item) =>
      item.dayOfWeek === validated.dayOfWeek && item.mealType === validated.mealType
  );

  if (!currentItem || !currentItem.recipeId) {
    throw new Error(
      `No meal found at day ${validated.dayOfWeek}, ${validated.mealType}`
    );
  }

  // Get the current recipe
  const currentRecipe = recipeService.getRecipe(currentItem.recipeId);
  if (!currentRecipe) {
    throw new Error(`Current recipe '${currentItem.recipeId}' not found`);
  }

  // Get some other recipes as alternatives (excluding current)
  const count = validated.count ?? 3;
  const allRecipes = recipeService.listRecipes({ limit: count + 5 });
  const otherRecipes = allRecipes.filter((r) => r.id !== currentItem.recipeId);

  // Generate placeholder alternatives
  const alternatives: SwapAlternative[] = otherRecipes.slice(0, count).map((recipe) => ({
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    reasoning: 'Placeholder alternative - recommendation algorithm not yet implemented',
    score: Math.floor(Math.random() * 30) + 60, // Random score 60-90
  }));

  return {
    currentRecipe: {
      id: currentRecipe.id,
      title: currentRecipe.title,
    },
    alternatives,
  };
};

// ============================================================================
// 7. generate_grocery_list - Generate via GroceryService.generateList
// ============================================================================

/**
 * Generate a grocery list for a weekly plan.
 */
export const generateGroceryList: ToolHandler<
  GenerateGroceryListInput,
  GenerateGroceryListOutput
> = async (input, context) => {
  // Validate input
  const validated = GenerateGroceryListInputSchema.parse(input);

  const groceryService = new GroceryService(context.db);

  // Generate the grocery list
  const groceryList = groceryService.generateList(validated.week);

  if (!groceryList) {
    // Return empty list if no plan exists
    return {
      items: [],
      totalItems: 0,
    };
  }

  // Convert grocery groups to flat item list
  const items: GroceryListItem[] = [];

  for (const group of groceryList.groups) {
    for (const item of group.items) {
      items.push({
        ingredient: item.ingredient,
        quantity: item.totalQuantity,
        unit: item.unit,
        category: group.name,
        recipes: item.recipes,
      });
    }
  }

  // Note: excludePantry is not yet implemented in GroceryService
  // Would filter out pantry items if enabled
  if (validated.excludePantry) {
    // Placeholder: would need PantryService integration
  }

  return {
    items,
    totalItems: items.length,
  };
};

/**
 * All planner tool handlers.
 */
export const plannerTools = {
  get_preferences: getPreferences,
  get_week_plan: getWeekPlan,
  suggest_meals: suggestMeals,
  set_meal: setMeal,
  swap_meal: swapMeal,
  get_swap_alternatives: getSwapAlternatives,
  generate_grocery_list: generateGroceryList,
} as const;

export type PlannerToolName = keyof typeof plannerTools;
