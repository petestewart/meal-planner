/**
 * Suggestion service - Meal suggestion algorithm
 *
 * Implements the scoring algorithm from PLAN.md Deliverable E (lines 1264-1293).
 * Scores recipes based on:
 * - Favorites boost
 * - Recently made penalty
 * - Cuisine preference match
 * - Time constraint match
 * - Variety rule violations
 *
 * Returns ranked suggestions with reasoning.
 */

import type { Database } from 'better-sqlite3';
import { RecipeRepository, type ListRecipesOptions } from '../repos/recipe.repo.js';
import { PlanRepository } from '../repos/plan.repo.js';
import { PreferenceService } from './preference.service.js';
import type {
  RecipeWithRelations,
  PlanItem,
  MealType,
} from '../models/index.js';

/**
 * Scoring weight constants matching PLAN.md specification.
 */
export const SCORING_WEIGHTS = {
  BASE_SCORE: 1.0,
  FAVORITE_BOOST: 0.3,
  RECENT_PENALTY: 0.5,
  CUISINE_PREFERENCE_BOOST: 0.2,
  TIME_CONSTRAINT_BOOST: 0.1,
  VARIETY_VIOLATION_PENALTY: 0.3,
} as const;

/**
 * Number of days to look back for "recently made" penalty.
 */
export const RECENT_DAYS_THRESHOLD = 14;

/**
 * A reason explaining part of a recipe's score.
 */
export interface SuggestionReason {
  type:
    | 'favorite'
    | 'recent'
    | 'cuisine_match'
    | 'time_match'
    | 'variety_violation'
    | 'base';
  description: string;
  scoreImpact: number;
}

/**
 * A scored recipe suggestion with reasoning.
 */
export interface RecipeSuggestion {
  recipe: RecipeWithRelations;
  score: number;
  reasons: SuggestionReason[];
}

/**
 * Context for scoring a recipe on a specific day/meal.
 */
export interface SuggestionContext {
  /** The target day of week (1=Monday, 7=Sunday) */
  dayOfWeek: number;
  /** The target meal type */
  mealType: MealType;
  /** Recipe IDs that are marked as favorites */
  favoriteRecipeIds?: Set<string>;
  /** Recipes used in recent plans (within RECENT_DAYS_THRESHOLD) */
  recentRecipeIds?: Set<string>;
  /** Maximum prep time in minutes (null = no limit) */
  maxPrepTimeMinutes?: number | null;
  /** Preferred cuisines */
  favoriteCuisines?: string[];
  /** Whether to check variety rules (same cuisine consecutive days) */
  checkVarietyRules?: boolean;
  /** Cuisine from previous day's meal (for variety checking) */
  previousDayCuisine?: string | null;
  /** Cuisine from next day's meal (for variety checking) */
  nextDayCuisine?: string | null;
  /** Recipe used on previous day (for variety checking) */
  previousDayRecipeId?: string | null;
  /** Recipe used on next day (for variety checking) */
  nextDayRecipeId?: string | null;
}

/**
 * Options for getting suggestions.
 */
export interface GetSuggestionsOptions {
  /** Maximum number of suggestions to return */
  limit?: number;
  /** Filter recipes by these options */
  recipeFilters?: ListRecipesOptions;
  /** Recipe IDs to exclude from suggestions */
  excludeRecipeIds?: string[];
  /** The plan ID to get context from (for variety rules) */
  planId?: string;
}

/**
 * Recent meal info for tracking what was made recently.
 */
interface RecentMealInfo {
  recipeId: string;
  cuisine: string | null;
  week: string;
  dayOfWeek: number;
}

export class SuggestionService {
  private recipeRepo: RecipeRepository;
  private planRepo: PlanRepository;
  private prefService: PreferenceService;

  constructor(db: Database) {
    this.recipeRepo = new RecipeRepository(db);
    this.planRepo = new PlanRepository(db);
    this.prefService = new PreferenceService(db);
  }

  /**
   * Get meal suggestions for a specific day and meal type.
   *
   * Scores all available recipes based on user preferences, recent history,
   * and variety rules, then returns the top suggestions with reasoning.
   */
  getSuggestions(
    dayOfWeek: number,
    mealType: MealType,
    options: GetSuggestionsOptions = {}
  ): RecipeSuggestion[] {
    const { limit = 5, recipeFilters = {}, excludeRecipeIds = [], planId } = options;

    // Get all recipes matching filters
    const recipes = this.recipeRepo.list(recipeFilters);

    // Build suggestion context from preferences and recent history
    const context = this.buildContext(dayOfWeek, mealType, planId);

    // Score each recipe
    const suggestions: RecipeSuggestion[] = [];

    for (const recipe of recipes) {
      // Skip excluded recipes
      if (excludeRecipeIds.includes(recipe.id)) {
        continue;
      }

      const { score, reasons } = this.scoreRecipe(recipe, context);

      suggestions.push({
        recipe,
        score,
        reasons,
      });
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score);

    // Return top N
    return suggestions.slice(0, limit);
  }

  /**
   * Get swap alternatives for a meal slot.
   *
   * Similar to getSuggestions but excludes the current recipe
   * and considers the reason for swap.
   */
  getSwapAlternatives(
    planId: string,
    dayOfWeek: number,
    mealType: MealType,
    currentRecipeId: string,
    reason?: string,
    limit: number = 3
  ): RecipeSuggestion[] {
    // Get current meal to understand what we're swapping from
    const currentMeal = this.planRepo.getMealBySlot(planId, dayOfWeek, mealType);

    // Build base options
    const options: GetSuggestionsOptions = {
      limit,
      excludeRecipeIds: [currentRecipeId],
      planId,
    };

    // If reason mentions "missing ingredients" or "simpler", prefer easier recipes
    if (reason) {
      const lowerReason = reason.toLowerCase();
      if (
        lowerReason.includes('missing ingredients') ||
        lowerReason.includes('simpler') ||
        lowerReason.includes('easier') ||
        lowerReason.includes('quick')
      ) {
        options.recipeFilters = { difficulty: 'easy' };
      }
    }

    return this.getSuggestions(dayOfWeek, mealType, options);
  }

  /**
   * Score a single recipe in the given context.
   *
   * Implements the scoring algorithm from PLAN.md:
   *
   * score = baseScore
   *   + (isFavorite ? favoriteBoost : 0)
   *   - (madeWithinLast2Weeks ? recentPenalty : 0)
   *   + (matchesCuisinePreference ? 0.2 : 0)
   *   + (meetsTimeConstraint ? 0.1 : 0)
   *   - (violatesVarietyRule ? 0.3 : 0)
   */
  scoreRecipe(
    recipe: RecipeWithRelations,
    context: SuggestionContext
  ): { score: number; reasons: SuggestionReason[] } {
    const reasons: SuggestionReason[] = [];
    let score = SCORING_WEIGHTS.BASE_SCORE;

    // Base score reason
    reasons.push({
      type: 'base',
      description: 'Base score for all recipes',
      scoreImpact: SCORING_WEIGHTS.BASE_SCORE,
    });

    // Favorite boost
    if (context.favoriteRecipeIds?.has(recipe.id)) {
      score += SCORING_WEIGHTS.FAVORITE_BOOST;
      reasons.push({
        type: 'favorite',
        description: 'Marked as favorite recipe',
        scoreImpact: SCORING_WEIGHTS.FAVORITE_BOOST,
      });
    }

    // Recent penalty
    if (context.recentRecipeIds?.has(recipe.id)) {
      score -= SCORING_WEIGHTS.RECENT_PENALTY;
      reasons.push({
        type: 'recent',
        description: 'Made within the last 2 weeks',
        scoreImpact: -SCORING_WEIGHTS.RECENT_PENALTY,
      });
    }

    // Cuisine preference match
    if (
      recipe.cuisine &&
      context.favoriteCuisines &&
      context.favoriteCuisines.length > 0
    ) {
      const cuisineLower = recipe.cuisine.toLowerCase();
      const matchesCuisine = context.favoriteCuisines.some(
        (c) => c.toLowerCase() === cuisineLower
      );

      if (matchesCuisine) {
        score += SCORING_WEIGHTS.CUISINE_PREFERENCE_BOOST;
        reasons.push({
          type: 'cuisine_match',
          description: `Matches preferred cuisine: ${recipe.cuisine}`,
          scoreImpact: SCORING_WEIGHTS.CUISINE_PREFERENCE_BOOST,
        });
      }
    }

    // Time constraint match
    if (context.maxPrepTimeMinutes !== undefined && context.maxPrepTimeMinutes !== null) {
      const recipePrepTime = recipe.prepTimeMinutes ?? 0;

      if (recipePrepTime <= context.maxPrepTimeMinutes) {
        score += SCORING_WEIGHTS.TIME_CONSTRAINT_BOOST;
        reasons.push({
          type: 'time_match',
          description: `Prep time (${recipePrepTime} min) within limit (${context.maxPrepTimeMinutes} min)`,
          scoreImpact: SCORING_WEIGHTS.TIME_CONSTRAINT_BOOST,
        });
      }
    }

    // Variety rule violations
    if (context.checkVarietyRules !== false) {
      const varietyViolation = this.checkVarietyViolation(recipe, context);

      if (varietyViolation) {
        score -= SCORING_WEIGHTS.VARIETY_VIOLATION_PENALTY;
        reasons.push({
          type: 'variety_violation',
          description: varietyViolation,
          scoreImpact: -SCORING_WEIGHTS.VARIETY_VIOLATION_PENALTY,
        });
      }
    }

    return { score, reasons };
  }

  /**
   * Check if a recipe violates variety rules.
   *
   * Variety rules (from PLAN.md):
   * - avoidSameCuisineConsecutiveDays: No same cuisine on consecutive days
   * - avoidSameProteinConsecutiveDays: No same protein on consecutive days (future)
   * - maxRepeatRecipePerWeek: Max 1 repeat recipe per week
   *
   * Returns a description of the violation, or null if no violation.
   */
  private checkVarietyViolation(
    recipe: RecipeWithRelations,
    context: SuggestionContext
  ): string | null {
    const heuristics = this.prefService.getPlanningHeuristics();

    // Check same cuisine consecutive days
    if (heuristics.preferVariety && recipe.cuisine) {
      const cuisineLower = recipe.cuisine.toLowerCase();

      if (context.previousDayCuisine?.toLowerCase() === cuisineLower) {
        return `Same cuisine (${recipe.cuisine}) as previous day`;
      }

      if (context.nextDayCuisine?.toLowerCase() === cuisineLower) {
        return `Same cuisine (${recipe.cuisine}) as next day`;
      }
    }

    // Check same recipe consecutive days
    if (heuristics.preferVariety) {
      if (context.previousDayRecipeId === recipe.id) {
        return 'Same recipe as previous day';
      }

      if (context.nextDayRecipeId === recipe.id) {
        return 'Same recipe as next day';
      }
    }

    // Note: maxRepeatRecipePerWeek and protein tracking would require
    // additional context about the full week's plan, which could be
    // added in a future enhancement.

    return null;
  }

  /**
   * Build suggestion context from preferences and recent plan history.
   */
  private buildContext(
    dayOfWeek: number,
    mealType: MealType,
    planId?: string
  ): SuggestionContext {
    const context: SuggestionContext = {
      dayOfWeek,
      mealType,
      favoriteRecipeIds: new Set<string>(),
      recentRecipeIds: new Set<string>(),
      maxPrepTimeMinutes: this.prefService.getMaxPrepTimeMinutes(),
      favoriteCuisines: this.prefService.getFavoriteCuisines(),
      checkVarietyRules: true,
    };

    // Get recently made recipes (meals that were actually cooked, not just planned)
    // This provides more accurate history than just planned meals
    const recentlyMadeRecipeIds = this.planRepo.getRecentlyMadeRecipeIds(RECENT_DAYS_THRESHOLD);
    for (const recipeId of recentlyMadeRecipeIds) {
      context.recentRecipeIds!.add(recipeId);
    }

    // Also include planned meals from recent plans as a fallback
    // (for cases where plans haven't been completed yet)
    const recentMeals = this.getRecentMeals(mealType);

    for (const meal of recentMeals) {
      if (meal.recipeId) {
        context.recentRecipeIds!.add(meal.recipeId);
      }
    }

    // Get adjacent day context if we have a plan
    if (planId) {
      const plan = this.planRepo.getById(planId);

      if (plan?.items) {
        // Find previous day's meal
        const prevDayOfWeek = dayOfWeek === 1 ? 7 : dayOfWeek - 1;
        const prevMeal = plan.items.find(
          (item) => item.dayOfWeek === prevDayOfWeek && item.mealType === mealType
        );

        if (prevMeal?.recipeId) {
          context.previousDayRecipeId = prevMeal.recipeId;

          // Get the recipe to check cuisine
          const prevRecipe = this.recipeRepo.getById(prevMeal.recipeId);
          if (prevRecipe) {
            context.previousDayCuisine = prevRecipe.cuisine;
          }
        }

        // Find next day's meal
        const nextDayOfWeek = dayOfWeek === 7 ? 1 : dayOfWeek + 1;
        const nextMeal = plan.items.find(
          (item) => item.dayOfWeek === nextDayOfWeek && item.mealType === mealType
        );

        if (nextMeal?.recipeId) {
          context.nextDayRecipeId = nextMeal.recipeId;

          // Get the recipe to check cuisine
          const nextRecipe = this.recipeRepo.getById(nextMeal.recipeId);
          if (nextRecipe) {
            context.nextDayCuisine = nextRecipe.cuisine;
          }
        }
      }
    }

    // Get favorite recipe IDs from the is_favorite column
    const favoriteIds = this.recipeRepo.listFavoriteIds();
    for (const id of favoriteIds) {
      context.favoriteRecipeIds!.add(id);
    }

    return context;
  }

  /**
   * Get meals from recent plans (within RECENT_DAYS_THRESHOLD).
   */
  private getRecentMeals(mealType?: MealType): RecentMealInfo[] {
    const recentMeals: RecentMealInfo[] = [];

    // Get recent plans (limit to last 4 weeks to be safe)
    const plans = this.planRepo.list({ limit: 4 });

    // Calculate the cutoff date (2 weeks ago)
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - RECENT_DAYS_THRESHOLD * 24 * 60 * 60 * 1000);

    for (const plan of plans) {
      // Parse the week to check if it's within range
      // ISO week format: YYYY-Www
      const weekDate = this.isoWeekToDate(plan.week);

      if (weekDate && weekDate >= cutoffDate) {
        for (const item of plan.items ?? []) {
          // Filter by meal type if specified
          if (mealType && item.mealType !== mealType) {
            continue;
          }

          if (item.recipeId) {
            const recipe = this.recipeRepo.getById(item.recipeId);

            recentMeals.push({
              recipeId: item.recipeId,
              cuisine: recipe?.cuisine ?? null,
              week: plan.week,
              dayOfWeek: item.dayOfWeek,
            });
          }
        }
      }
    }

    return recentMeals;
  }

  /**
   * Convert ISO week string to a Date (Monday of that week).
   */
  private isoWeekToDate(isoWeek: string): Date | null {
    const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);

    if (!match) {
      return null;
    }

    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    // January 4th is always in week 1 of the ISO year
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = jan4.getDay() || 7; // Convert Sunday=0 to 7

    // Get Monday of week 1
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - jan4DayOfWeek + 1);

    // Add weeks
    const targetMonday = new Date(week1Monday);
    targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);

    return targetMonday;
  }

  /**
   * Check if a day is a weekday (Monday-Friday).
   */
  isWeekday(dayOfWeek: number): boolean {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * Check if a day is a weekend (Saturday-Sunday).
   */
  isWeekend(dayOfWeek: number): boolean {
    return dayOfWeek === 6 || dayOfWeek === 7;
  }
}
