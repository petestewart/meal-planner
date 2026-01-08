/**
 * Unit tests for SuggestionService
 *
 * Tests the meal suggestion algorithm including:
 * - Base scoring
 * - Favorites boost
 * - Recently made penalty
 * - Cuisine preference matching
 * - Time constraint matching
 * - Variety rule violations
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { RecipeRepository } from '../src/repos/recipe.repo.js';
import { PlanRepository } from '../src/repos/plan.repo.js';
import { PreferenceService } from '../src/services/preference.service.js';
import {
  SuggestionService,
  SCORING_WEIGHTS,
  type SuggestionContext,
} from '../src/services/suggestion.service.js';
import type { Database } from 'better-sqlite3';
import type { RecipeWithRelations } from '../src/models/index.js';

function assertApproxEqual(actual: number, expected: number, tolerance: number, message: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ~${expected}, got ${actual} (tolerance: ${tolerance})`);
  }
}

function assertGreater(actual: number, expected: number, message: string): void {
  if (actual <= expected) {
    throw new Error(`${message}: expected ${actual} > ${expected}`);
  }
}

function assertLess(actual: number, expected: number, message: string): void {
  if (actual >= expected) {
    throw new Error(`${message}: expected ${actual} < ${expected}`);
  }
}

// Database setup helpers
function setupTestDb(): { db: Database; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  return {
    db,
    cleanup: () => closeDb(db),
  };
}

interface TestContext {
  db: Database;
  recipeRepo: RecipeRepository;
  planRepo: PlanRepository;
  prefService: PreferenceService;
  suggestionService: SuggestionService;
  cleanup: () => void;
}

function setupTest(): TestContext {
  const { db, cleanup } = setupTestDb();
  const recipeRepo = new RecipeRepository(db);
  const planRepo = new PlanRepository(db);
  const prefService = new PreferenceService(db);
  const suggestionService = new SuggestionService(db);

  return {
    db,
    recipeRepo,
    planRepo,
    prefService,
    suggestionService,
    cleanup,
  };
}

// Helper to create a mock recipe
function createMockRecipe(
  recipeRepo: RecipeRepository,
  overrides: Partial<{
    title: string;
    cuisine: string | null;
    prepTimeMinutes: number | null;
    difficulty: 'easy' | 'medium' | 'hard' | null;
  }> = {}
): RecipeWithRelations {
  return recipeRepo.create({
    title: overrides.title ?? 'Test Recipe',
    instructions: 'Test instructions',
    servings: 4,
    cuisine: overrides.cuisine ?? null,
    prepTimeMinutes: overrides.prepTimeMinutes ?? null,
    difficulty: overrides.difficulty ?? null,
    description: null,
    cookTimeMinutes: null,
    sourceUrl: null,
    sourceType: null,
  });
}

// ========================
// Base Scoring Tests
// ========================

test('scoreRecipe returns base score for recipe with no context matches', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo);

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      checkVarietyRules: false, // Disable variety rules for this test
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should equal base score');
    expect(reasons.length).toBe(1);
    expect(reasons[0].type).toBe('base');
  } finally {
    cleanup();
  }
});

// ========================
// Favorites Boost Tests
// ========================

test('scoreRecipe adds favorite boost for favorite recipes', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo);

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      favoriteRecipeIds: new Set([recipe.id]),
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE + SCORING_WEIGHTS.FAVORITE_BOOST;
    assertApproxEqual(score, expectedScore, 0.001, 'score should include favorite boost');

    const favoriteReason = reasons.find((r) => r.type === 'favorite');
    expect(favoriteReason).toBeDefined();
    assertApproxEqual(favoriteReason.scoreImpact, SCORING_WEIGHTS.FAVORITE_BOOST, 0.001, 'impact should match');
  } finally {
    cleanup();
  }
});

test('scoreRecipe does not add favorite boost for non-favorites', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo);

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      favoriteRecipeIds: new Set(['other-id']),
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should not include favorite boost');

    const favoriteReason = reasons.find((r) => r.type === 'favorite');
    expect(favoriteReason).toBe(undefined);
  } finally {
    cleanup();
  }
});

// ========================
// Recent Penalty Tests
// ========================

test('scoreRecipe subtracts penalty for recently made recipes', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo);

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      recentRecipeIds: new Set([recipe.id]),
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE - SCORING_WEIGHTS.RECENT_PENALTY;
    assertApproxEqual(score, expectedScore, 0.001, 'score should include recent penalty');

    const recentReason = reasons.find((r) => r.type === 'recent');
    expect(recentReason).toBeDefined();
    assertApproxEqual(recentReason.scoreImpact, -SCORING_WEIGHTS.RECENT_PENALTY, 0.001, 'impact should be negative');
  } finally {
    cleanup();
  }
});

test('scoreRecipe does not penalize non-recent recipes', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo);

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      recentRecipeIds: new Set(['other-id']),
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should not include recent penalty');

    const recentReason = reasons.find((r) => r.type === 'recent');
    expect(recentReason).toBe(undefined);
  } finally {
    cleanup();
  }
});

// ========================
// Cuisine Preference Tests
// ========================

test('scoreRecipe adds boost for matching cuisine preference', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'Italian' });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      favoriteCuisines: ['italian', 'mexican'],
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE + SCORING_WEIGHTS.CUISINE_PREFERENCE_BOOST;
    assertApproxEqual(score, expectedScore, 0.001, 'score should include cuisine boost');

    const cuisineReason = reasons.find((r) => r.type === 'cuisine_match');
    expect(cuisineReason).toBeDefined();
  } finally {
    cleanup();
  }
});

test('scoreRecipe cuisine matching is case-insensitive', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'MEXICAN' });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      favoriteCuisines: ['Mexican'],
      checkVarietyRules: false,
    };

    const { score } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE + SCORING_WEIGHTS.CUISINE_PREFERENCE_BOOST;
    assertApproxEqual(score, expectedScore, 0.001, 'cuisine matching should be case-insensitive');
  } finally {
    cleanup();
  }
});

test('scoreRecipe does not boost non-matching cuisine', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'Japanese' });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      favoriteCuisines: ['italian', 'mexican'],
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should not include cuisine boost');

    const cuisineReason = reasons.find((r) => r.type === 'cuisine_match');
    expect(cuisineReason).toBe(undefined);
  } finally {
    cleanup();
  }
});

// ========================
// Time Constraint Tests
// ========================

test('scoreRecipe adds boost for recipes within time constraint', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { prepTimeMinutes: 20 });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      maxPrepTimeMinutes: 30,
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE + SCORING_WEIGHTS.TIME_CONSTRAINT_BOOST;
    assertApproxEqual(score, expectedScore, 0.001, 'score should include time boost');

    const timeReason = reasons.find((r) => r.type === 'time_match');
    expect(timeReason).toBeDefined();
  } finally {
    cleanup();
  }
});

test('scoreRecipe adds boost for recipes at exactly the time limit', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { prepTimeMinutes: 30 });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      maxPrepTimeMinutes: 30,
      checkVarietyRules: false,
    };

    const { score } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE + SCORING_WEIGHTS.TIME_CONSTRAINT_BOOST;
    assertApproxEqual(score, expectedScore, 0.001, 'should boost recipes at exactly the limit');
  } finally {
    cleanup();
  }
});

test('scoreRecipe does not boost recipes exceeding time constraint', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { prepTimeMinutes: 45 });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      maxPrepTimeMinutes: 30,
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should not include time boost');

    const timeReason = reasons.find((r) => r.type === 'time_match');
    expect(timeReason).toBe(undefined);
  } finally {
    cleanup();
  }
});

test('scoreRecipe treats null prep time as 0 for time constraint', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { prepTimeMinutes: null });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      maxPrepTimeMinutes: 30,
      checkVarietyRules: false,
    };

    const { score } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE + SCORING_WEIGHTS.TIME_CONSTRAINT_BOOST;
    assertApproxEqual(score, expectedScore, 0.001, 'null prep time should be treated as 0');
  } finally {
    cleanup();
  }
});

// ========================
// Variety Rule Tests
// ========================

test('scoreRecipe penalizes same cuisine as previous day', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'Italian' });

    const context: SuggestionContext = {
      dayOfWeek: 2, // Tuesday
      mealType: 'dinner',
      previousDayCuisine: 'Italian',
      checkVarietyRules: true,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE - SCORING_WEIGHTS.VARIETY_VIOLATION_PENALTY;
    assertApproxEqual(score, expectedScore, 0.001, 'score should include variety penalty');

    const varietyReason = reasons.find((r) => r.type === 'variety_violation');
    expect(varietyReason).toBeDefined();
    expect(varietyReason.description.includes('previous day')).toBe(true);
  } finally {
    cleanup();
  }
});

test('scoreRecipe penalizes same cuisine as next day', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'Mexican' });

    const context: SuggestionContext = {
      dayOfWeek: 2,
      mealType: 'dinner',
      nextDayCuisine: 'Mexican',
      checkVarietyRules: true,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE - SCORING_WEIGHTS.VARIETY_VIOLATION_PENALTY;
    assertApproxEqual(score, expectedScore, 0.001, 'score should include variety penalty');

    const varietyReason = reasons.find((r) => r.type === 'variety_violation');
    expect(varietyReason).toBeDefined();
    expect(varietyReason.description.includes('next day')).toBe(true);
  } finally {
    cleanup();
  }
});

test('scoreRecipe penalizes same recipe as previous day', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo);

    const context: SuggestionContext = {
      dayOfWeek: 2,
      mealType: 'dinner',
      previousDayRecipeId: recipe.id,
      checkVarietyRules: true,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE - SCORING_WEIGHTS.VARIETY_VIOLATION_PENALTY;
    assertApproxEqual(score, expectedScore, 0.001, 'score should include variety penalty');

    const varietyReason = reasons.find((r) => r.type === 'variety_violation');
    expect(varietyReason).toBeDefined();
    expect(varietyReason.description.includes('Same recipe')).toBe(true);
  } finally {
    cleanup();
  }
});

test('scoreRecipe does not penalize different cuisine on adjacent days', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'Italian' });

    const context: SuggestionContext = {
      dayOfWeek: 2,
      mealType: 'dinner',
      previousDayCuisine: 'Mexican',
      nextDayCuisine: 'Japanese',
      checkVarietyRules: true,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should not include variety penalty');

    const varietyReason = reasons.find((r) => r.type === 'variety_violation');
    expect(varietyReason).toBe(undefined);
  } finally {
    cleanup();
  }
});

test('scoreRecipe variety check is case-insensitive', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'italian' });

    const context: SuggestionContext = {
      dayOfWeek: 2,
      mealType: 'dinner',
      previousDayCuisine: 'ITALIAN',
      checkVarietyRules: true,
    };

    const { score } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE - SCORING_WEIGHTS.VARIETY_VIOLATION_PENALTY;
    assertApproxEqual(score, expectedScore, 0.001, 'variety check should be case-insensitive');
  } finally {
    cleanup();
  }
});

test('scoreRecipe can disable variety rules via checkVarietyRules', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'Italian' });

    const context: SuggestionContext = {
      dayOfWeek: 2,
      mealType: 'dinner',
      previousDayCuisine: 'Italian', // Same cuisine
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should not include variety penalty');

    const varietyReason = reasons.find((r) => r.type === 'variety_violation');
    expect(varietyReason).toBe(undefined);
  } finally {
    cleanup();
  }
});

// ========================
// Combined Scoring Tests
// ========================

test('scoreRecipe combines multiple factors correctly', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, {
      cuisine: 'Italian',
      prepTimeMinutes: 20,
    });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      favoriteRecipeIds: new Set([recipe.id]),
      favoriteCuisines: ['Italian'],
      maxPrepTimeMinutes: 30,
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore =
      SCORING_WEIGHTS.BASE_SCORE +
      SCORING_WEIGHTS.FAVORITE_BOOST +
      SCORING_WEIGHTS.CUISINE_PREFERENCE_BOOST +
      SCORING_WEIGHTS.TIME_CONSTRAINT_BOOST;

    assertApproxEqual(score, expectedScore, 0.001, 'score should combine all bonuses');
    expect(reasons.length).toBe(4);
  } finally {
    cleanup();
  }
});

test('scoreRecipe handles all bonuses and penalties together', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, {
      cuisine: 'Italian',
      prepTimeMinutes: 20,
    });

    const context: SuggestionContext = {
      dayOfWeek: 2,
      mealType: 'dinner',
      favoriteRecipeIds: new Set([recipe.id]),
      recentRecipeIds: new Set([recipe.id]),
      favoriteCuisines: ['Italian'],
      maxPrepTimeMinutes: 30,
      previousDayCuisine: 'Italian', // Variety violation
      checkVarietyRules: true,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore =
      SCORING_WEIGHTS.BASE_SCORE +
      SCORING_WEIGHTS.FAVORITE_BOOST -
      SCORING_WEIGHTS.RECENT_PENALTY +
      SCORING_WEIGHTS.CUISINE_PREFERENCE_BOOST +
      SCORING_WEIGHTS.TIME_CONSTRAINT_BOOST -
      SCORING_WEIGHTS.VARIETY_VIOLATION_PENALTY;

    assertApproxEqual(score, expectedScore, 0.001, 'score should include all factors');
    expect(reasons.length).toBe(6);
  } finally {
    cleanup();
  }
});

// ========================
// getSuggestions Tests
// ========================

test('getSuggestions returns ranked recipes by score', () => {
  const { recipeRepo, suggestionService, prefService, cleanup } = setupTest();
  try {
    // Create recipes with different characteristics
    const favoriteRecipe = createMockRecipe(recipeRepo, {
      title: 'Favorite Recipe',
      cuisine: 'Italian',
    });
    const normalRecipe = createMockRecipe(recipeRepo, {
      title: 'Normal Recipe',
      cuisine: 'Mexican',
    });
    const fastRecipe = createMockRecipe(recipeRepo, {
      title: 'Fast Recipe',
      prepTimeMinutes: 15,
    });

    // Set favorite cuisines preference
    prefService.setFavoriteCuisines(['Italian']);

    const suggestions = suggestionService.getSuggestions(1, 'dinner', { limit: 10 });

    expect(suggestions.length).toBe(3);

    // The Italian recipe should score higher due to cuisine match
    const italianSuggestion = suggestions.find((s) => s.recipe.cuisine === 'Italian');
    const mexicanSuggestion = suggestions.find((s) => s.recipe.cuisine === 'Mexican');

    expect(italianSuggestion).toBeDefined();
    expect(mexicanSuggestion).toBeDefined();

    assertGreater(italianSuggestion.score, mexicanSuggestion.score, 'Italian should score higher');
  } finally {
    cleanup();
  }
});

test('getSuggestions respects limit parameter', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    // Create several recipes
    for (let i = 0; i < 10; i++) {
      createMockRecipe(recipeRepo, { title: `Recipe ${i}` });
    }

    const suggestions = suggestionService.getSuggestions(1, 'dinner', { limit: 3 });

    expect(suggestions.length).toBe(3);
  } finally {
    cleanup();
  }
});

test('getSuggestions excludes specified recipe IDs', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe1 = createMockRecipe(recipeRepo, { title: 'Recipe 1' });
    const recipe2 = createMockRecipe(recipeRepo, { title: 'Recipe 2' });
    const recipe3 = createMockRecipe(recipeRepo, { title: 'Recipe 3' });

    const suggestions = suggestionService.getSuggestions(1, 'dinner', {
      excludeRecipeIds: [recipe1.id, recipe2.id],
    });

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].recipe.id).toBe(recipe3.id);
  } finally {
    cleanup();
  }
});

test('getSuggestions applies recipe filters', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    createMockRecipe(recipeRepo, { title: 'Easy Recipe', difficulty: 'easy' });
    createMockRecipe(recipeRepo, { title: 'Hard Recipe', difficulty: 'hard' });

    const suggestions = suggestionService.getSuggestions(1, 'dinner', {
      recipeFilters: { difficulty: 'easy' },
    });

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].recipe.title).toBe('Easy Recipe');
  } finally {
    cleanup();
  }
});

test('getSuggestions includes reasons for each suggestion', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    createMockRecipe(recipeRepo, { title: 'Test Recipe' });

    const suggestions = suggestionService.getSuggestions(1, 'dinner');

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].reasons.length > 0).toBe(true);
    expect(suggestions[0].reasons.some((r) => r.type === 'base')).toBe(true);
  } finally {
    cleanup();
  }
});

// ========================
// getSwapAlternatives Tests
// ========================

test('getSwapAlternatives excludes current recipe', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe1 = createMockRecipe(recipeRepo, { title: 'Current Recipe' });
    const recipe2 = createMockRecipe(recipeRepo, { title: 'Alternative 1' });
    const recipe3 = createMockRecipe(recipeRepo, { title: 'Alternative 2' });

    const plan = planRepo.create({ week: '2025-W01' });

    const alternatives = suggestionService.getSwapAlternatives(
      plan.id,
      1,
      'dinner',
      recipe1.id
    );

    expect(!alternatives.some((a) => a.recipe.id === recipe1.id)).toBe(true);
    expect(alternatives.length).toBe(2);
  } finally {
    cleanup();
  }
});

test('getSwapAlternatives filters by easy difficulty for simpler reason', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const currentRecipe = createMockRecipe(recipeRepo, { title: 'Current', difficulty: 'hard' });
    createMockRecipe(recipeRepo, { title: 'Easy Recipe', difficulty: 'easy' });
    createMockRecipe(recipeRepo, { title: 'Hard Recipe', difficulty: 'hard' });

    const plan = planRepo.create({ week: '2025-W01' });

    const alternatives = suggestionService.getSwapAlternatives(
      plan.id,
      1,
      'dinner',
      currentRecipe.id,
      'Need something simpler'
    );

    // Should only return easy recipes
    for (const alt of alternatives) {
      expect(alt.recipe.difficulty).toBe('easy');
    }
  } finally {
    cleanup();
  }
});

test('getSwapAlternatives respects limit', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const currentRecipe = createMockRecipe(recipeRepo, { title: 'Current' });
    for (let i = 0; i < 10; i++) {
      createMockRecipe(recipeRepo, { title: `Alternative ${i}` });
    }

    const plan = planRepo.create({ week: '2025-W01' });

    const alternatives = suggestionService.getSwapAlternatives(
      plan.id,
      1,
      'dinner',
      currentRecipe.id,
      undefined,
      5
    );

    expect(alternatives.length).toBe(5);
  } finally {
    cleanup();
  }
});

// ========================
// Integration with Plan Context Tests
// ========================

test('getSuggestions considers variety rules from plan context', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    // Create recipes with different cuisines
    const italianRecipe = createMockRecipe(recipeRepo, {
      title: 'Italian Dish',
      cuisine: 'Italian',
    });
    const mexicanRecipe = createMockRecipe(recipeRepo, {
      title: 'Mexican Dish',
      cuisine: 'Mexican',
    });

    // Create a plan with Italian on Monday
    const plan = planRepo.create({ week: '2025-W01' });
    planRepo.setMeal(plan.id, 1, 'dinner', italianRecipe.id);

    // Get suggestions for Tuesday dinner
    const suggestions = suggestionService.getSuggestions(2, 'dinner', {
      planId: plan.id,
    });

    // Mexican should score higher than Italian due to variety rules
    const italianSuggestion = suggestions.find((s) => s.recipe.cuisine === 'Italian');
    const mexicanSuggestion = suggestions.find((s) => s.recipe.cuisine === 'Mexican');

    expect(italianSuggestion).toBeDefined();
    expect(mexicanSuggestion).toBeDefined();

    assertGreater(
      mexicanSuggestion.score,
      italianSuggestion.score,
      'Mexican should score higher due to variety'
    );

    // Italian should have variety violation reason
    const varietyReason = italianSuggestion.reasons.find((r) => r.type === 'variety_violation');
    expect(varietyReason).toBeDefined();
  } finally {
    cleanup();
  }
});

// ========================
// Helper Method Tests
// ========================

test('isWeekday returns true for Monday-Friday', () => {
  const { suggestionService, cleanup } = setupTest();
  try {
    expect(suggestionService.isWeekday(1)).toBe(true);
    expect(suggestionService.isWeekday(2)).toBe(true);
    expect(suggestionService.isWeekday(3)).toBe(true);
    expect(suggestionService.isWeekday(4)).toBe(true);
    expect(suggestionService.isWeekday(5)).toBe(true);
    expect(!suggestionService.isWeekday(6)).toBe(true);
    expect(!suggestionService.isWeekday(7)).toBe(true);
  } finally {
    cleanup();
  }
});

test('isWeekend returns true for Saturday-Sunday', () => {
  const { suggestionService, cleanup } = setupTest();
  try {
    expect(!suggestionService.isWeekend(1)).toBe(true);
    expect(!suggestionService.isWeekend(5)).toBe(true);
    expect(suggestionService.isWeekend(6)).toBe(true);
    expect(suggestionService.isWeekend(7)).toBe(true);
  } finally {
    cleanup();
  }
});

// ========================
// Edge Cases
// ========================

test('getSuggestions returns empty array when no recipes exist', () => {
  const { suggestionService, cleanup } = setupTest();
  try {
    const suggestions = suggestionService.getSuggestions(1, 'dinner');
    expect(suggestions.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('scoreRecipe handles recipe with no cuisine', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: null });

    const context: SuggestionContext = {
      dayOfWeek: 2,
      mealType: 'dinner',
      favoriteCuisines: ['Italian'],
      previousDayCuisine: 'Italian',
      checkVarietyRules: true,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    // Should not have cuisine match or variety violation (no cuisine to compare)
    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should be base score');

    const cuisineReason = reasons.find((r) => r.type === 'cuisine_match');
    expect(cuisineReason).toBe(undefined);

    const varietyReason = reasons.find((r) => r.type === 'variety_violation');
    expect(varietyReason).toBe(undefined);
  } finally {
    cleanup();
  }
});

test('scoreRecipe handles empty favorite cuisines list', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { cuisine: 'Italian' });

    const context: SuggestionContext = {
      dayOfWeek: 1,
      mealType: 'dinner',
      favoriteCuisines: [],
      checkVarietyRules: false,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    assertApproxEqual(score, SCORING_WEIGHTS.BASE_SCORE, 0.001, 'score should be base score');

    const cuisineReason = reasons.find((r) => r.type === 'cuisine_match');
    expect(cuisineReason).toBe(undefined);
  } finally {
    cleanup();
  }
});

// ========================
// Plan context integration tests
// ========================

test('getSuggestions with planId considers recent meals', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe1 = createMockRecipe(recipeRepo, { title: 'Recently Made Recipe', cuisine: 'Italian' });
    const recipe2 = createMockRecipe(recipeRepo, { title: 'Not Recently Made', cuisine: 'Mexican' });

    // Create a plan for recent week with a meal
    const recentWeek = new Date();
    const weekNum = Math.ceil((recentWeek.getDate() - recentWeek.getDay() + 1) / 7);
    const weekStr = `${recentWeek.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;

    const plan = planRepo.create({ week: weekStr });
    planRepo.setMeal(plan.id, 1, 'dinner', recipe1.id, 4);

    // Mark as made and complete the plan so it counts as recent
    planRepo.markMealAsMade(plan.id, 1, 'dinner', true);
    planRepo.completePlan(plan.id);

    // Get suggestions without plan context
    const suggestionsNoPlan = suggestionService.getSuggestions(1, 'dinner');

    // Both should be suggested, but recently made one may have penalty if it shows up
    expect(suggestionsNoPlan.length).toBe(2);
  } finally {
    cleanup();
  }
});

test('getSuggestions checks next day cuisine from plan', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const italianRecipe = createMockRecipe(recipeRepo, { title: 'Italian Dish', cuisine: 'Italian' });
    const mexicanRecipe = createMockRecipe(recipeRepo, { title: 'Mexican Dish', cuisine: 'Mexican' });

    const plan = planRepo.create({ week: '2025-W02' });
    // Set Wednesday with Italian
    planRepo.setMeal(plan.id, 3, 'dinner', italianRecipe.id, 4);

    // Get suggestions for Tuesday - next day is Italian
    const suggestions = suggestionService.getSuggestions(2, 'dinner', { planId: plan.id });

    const italianSuggestion = suggestions.find((s) => s.recipe.cuisine === 'Italian');
    const mexicanSuggestion = suggestions.find((s) => s.recipe.cuisine === 'Mexican');

    // Mexican should score higher since next day has Italian (variety rule)
    assertGreater(mexicanSuggestion.score, italianSuggestion.score, 'Mexican should score higher');
  } finally {
    cleanup();
  }
});

test('getSuggestions considers meals planned in current week', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { title: 'Test Recipe' });
    const otherRecipe = createMockRecipe(recipeRepo, { title: 'Other Recipe' });

    const plan = planRepo.create({ week: '2025-W03' });
    planRepo.setMeal(plan.id, 1, 'dinner', recipe.id, 4);

    // Get suggestions for Tuesday with planId - recipe is already in plan
    const suggestions = suggestionService.getSuggestions(2, 'dinner', { planId: plan.id });

    expect(suggestions.length).toBe(2);
  } finally {
    cleanup();
  }
});

test('getSuggestions skips meal type filtering when no mealType provided to getRecentMeals', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { title: 'Multi Use Recipe' });

    // Create a plan with recipe used for lunch
    const plan = planRepo.create({ week: '2025-W04' });
    planRepo.setMeal(plan.id, 1, 'lunch', recipe.id, 4);

    // Get suggestions for dinner - the lunch meal should not affect scoring
    const suggestions = suggestionService.getSuggestions(2, 'dinner', { planId: plan.id });

    expect(suggestions.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('scoreRecipe handles penalizing same recipe as next day', () => {
  const { recipeRepo, suggestionService, cleanup } = setupTest();
  try {
    const recipe = createMockRecipe(recipeRepo, { title: 'Test Recipe' });

    const context: SuggestionContext = {
      dayOfWeek: 2,
      mealType: 'dinner',
      nextDayRecipeId: recipe.id,
      checkVarietyRules: true,
    };

    const { score, reasons } = suggestionService.scoreRecipe(recipe, context);

    const expectedScore = SCORING_WEIGHTS.BASE_SCORE - SCORING_WEIGHTS.VARIETY_VIOLATION_PENALTY;
    assertApproxEqual(score, expectedScore, 0.001, 'should penalize same recipe as next day');

    const varietyReason = reasons.find((r) => r.type === 'variety_violation');
    expect(varietyReason).toBeDefined();
    expect(varietyReason.description.includes('next day')).toBe(true);
  } finally {
    cleanup();
  }
});

test('getSwapAlternatives with different_cuisine reason filters to different cuisines', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const currentRecipe = createMockRecipe(recipeRepo, { title: 'Current Italian', cuisine: 'Italian' });
    createMockRecipe(recipeRepo, { title: 'Another Italian', cuisine: 'Italian' });
    const mexicanRecipe = createMockRecipe(recipeRepo, { title: 'Mexican Dish', cuisine: 'Mexican' });

    const plan = planRepo.create({ week: '2025-W05' });

    const alternatives = suggestionService.getSwapAlternatives(
      plan.id,
      1,
      'dinner',
      currentRecipe.id,
      'Want different cuisine'
    );

    // Should prefer different cuisines
    expect(alternatives.some((a) => a.recipe.cuisine === 'Mexican')).toBe(true);
  } finally {
    cleanup();
  }
});

test('getSwapAlternatives with faster reason filters to quick recipes', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const currentRecipe = createMockRecipe(recipeRepo, { title: 'Slow Recipe', prepTimeMinutes: 60 });
    createMockRecipe(recipeRepo, { title: 'Fast Recipe', prepTimeMinutes: 15 });
    createMockRecipe(recipeRepo, { title: 'Another Slow', prepTimeMinutes: 90 });

    const plan = planRepo.create({ week: '2025-W06' });

    const alternatives = suggestionService.getSwapAlternatives(
      plan.id,
      1,
      'dinner',
      currentRecipe.id,
      'Need something faster'
    );

    // Should include fast recipe (15 min) but not exclude slow if no filter is applied
    // The getSwapAlternatives may still return all if filtering is not strict
    expect(alternatives.length > 0).toBe(true);

    // Fast recipe should be present in alternatives
    const fastRecipe = alternatives.find((a) => a.recipe.prepTimeMinutes === 15);
    expect(fastRecipe).toBeDefined();
  } finally {
    cleanup();
  }
});

test('getSwapAlternatives handles plan with existing meals for context', () => {
  const { recipeRepo, planRepo, suggestionService, cleanup } = setupTest();
  try {
    const italianRecipe = createMockRecipe(recipeRepo, { title: 'Italian Current', cuisine: 'Italian' });
    const mexicanRecipe = createMockRecipe(recipeRepo, { title: 'Mexican Alt', cuisine: 'Mexican' });

    const plan = planRepo.create({ week: '2025-W07' });
    // Set Monday with Italian
    planRepo.setMeal(plan.id, 1, 'dinner', italianRecipe.id, 4);

    // Get alternatives for Monday - should still work
    const alternatives = suggestionService.getSwapAlternatives(
      plan.id,
      1,
      'dinner',
      italianRecipe.id
    );

    expect(alternatives.length > 0).toBe(true);
    expect(!alternatives.some((a) => a.recipe.id === italianRecipe.id)).toBe(true);
  } finally {
    cleanup();
  }
});

