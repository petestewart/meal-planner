/**
 * Agent Tool Handlers
 *
 * Re-exports all tool handlers for curator and planner agents.
 */

// Import curator handlers
import {
  searchRecipes,
  getRecipe,
  importRecipe,
  normalizeRecipe,
  createRecipe,
  curatorTools,
  type AgentContext,
  type ToolHandler,
  type CuratorToolName,
} from './curator.tools.js';

// Import planner handlers
import {
  getPreferences,
  getWeekPlan,
  suggestMeals,
  setMeal,
  swapMeal,
  getSwapAlternatives,
  generateGroceryList,
  plannerTools,
  type PlannerToolName,
} from './planner.tools.js';

// Re-export curator handlers
export {
  searchRecipes,
  getRecipe,
  importRecipe,
  normalizeRecipe,
  createRecipe,
  curatorTools,
  type AgentContext,
  type ToolHandler,
  type CuratorToolName,
};

// Re-export planner handlers
export {
  getPreferences,
  getWeekPlan,
  suggestMeals,
  setMeal,
  swapMeal,
  getSwapAlternatives,
  generateGroceryList,
  plannerTools,
  type PlannerToolName,
};

/**
 * All tool handlers combined.
 */
export const allTools = {
  // Curator tools
  search_recipes: searchRecipes,
  get_recipe: getRecipe,
  import_recipe: importRecipe,
  normalize_recipe: normalizeRecipe,
  create_recipe: createRecipe,

  // Planner tools
  get_preferences: getPreferences,
  get_week_plan: getWeekPlan,
  suggest_meals: suggestMeals,
  set_meal: setMeal,
  swap_meal: swapMeal,
  get_swap_alternatives: getSwapAlternatives,
  generate_grocery_list: generateGroceryList,
} as const;

export type ToolName = keyof typeof allTools;
