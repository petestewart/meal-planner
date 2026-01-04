/**
 * Unit tests for agent tool schemas (Zod validation)
 *
 * Tests both valid and invalid inputs for all curator and planner agent tools.
 */

import { test, expect, describe } from 'vitest';

import {
  // Curator schemas
  SearchRecipesInputSchema,
  SearchRecipesOutputSchema,
  GetRecipeInputSchema,
  GetRecipeOutputSchema,
  ImportRecipeInputSchema,
  ImportRecipeOutputSchema,
  NormalizeRecipeInputSchema,
  NormalizeRecipeOutputSchema,
  CreateRecipeInputSchema,
  CreateRecipeOutputSchema,

  // Planner schemas
  GetPreferencesInputSchema,
  GetPreferencesOutputSchema,
  GetWeekPlanInputSchema,
  GetWeekPlanOutputSchema,
  SuggestMealsInputSchema,
  SuggestMealsOutputSchema,
  SetMealInputSchema,
  SetMealOutputSchema,
  SwapMealInputSchema,
  SwapMealOutputSchema,
  GetSwapAlternativesInputSchema,
  GetSwapAlternativesOutputSchema,
  GenerateGroceryListInputSchema,
  GenerateGroceryListOutputSchema,
} from '../src/schemas/index.js';

// Test runner (simple, no dependencies)
interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
}

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

// ============================================================================
// CURATOR TOOL TESTS
// ============================================================================

// --- search_recipes ---

test('search_recipes input: accepts empty object', () => {
  const result = SearchRecipesInputSchema.safeParse({});
  expect(result.success, 'Should accept empty object');
});

test('search_recipes input: accepts query string', () => {
  const result = SearchRecipesInputSchema.safeParse({ query: 'chicken' });
  expect(result.success, 'Should accept query');
});

test('search_recipes input: accepts tags array', () => {
  const result = SearchRecipesInputSchema.safeParse({ tags: ['dinner', 'easy'] });
  expect(result.success, 'Should accept tags');
});

test('search_recipes input: accepts cuisine string', () => {
  const result = SearchRecipesInputSchema.safeParse({ cuisine: 'Italian' });
  expect(result.success, 'Should accept cuisine');
});

test('search_recipes input: accepts limit within range', () => {
  const result = SearchRecipesInputSchema.safeParse({ limit: 50 });
  expect(result.success, 'Should accept valid limit');
});

test('search_recipes input: rejects limit > 100', () => {
  const result = SearchRecipesInputSchema.safeParse({ limit: 150 });
  expect(!result.success, 'Should reject limit > 100');
});

test('search_recipes input: rejects limit <= 0', () => {
  const result = SearchRecipesInputSchema.safeParse({ limit: 0 });
  expect(!result.success, 'Should reject limit <= 0');
});

test('search_recipes output: accepts valid output', () => {
  const result = SearchRecipesOutputSchema.safeParse({
    recipes: [
      { id: 'abc', title: 'Test', cuisine: 'Italian', tags: ['dinner'], prepTimeMinutes: 30, cookTimeMinutes: 45 }
    ],
    total: 1
  });
  expect(result.success, 'Should accept valid output');
});

test('search_recipes output: accepts empty recipes array', () => {
  const result = SearchRecipesOutputSchema.safeParse({ recipes: [], total: 0 });
  expect(result.success, 'Should accept empty results');
});

// --- get_recipe ---

test('get_recipe input: accepts valid id', () => {
  const result = GetRecipeInputSchema.safeParse({ id: 'abc-123' });
  expect(result.success, 'Should accept valid id');
});

test('get_recipe input: rejects empty id', () => {
  const result = GetRecipeInputSchema.safeParse({ id: '' });
  expect(!result.success, 'Should reject empty id');
});

test('get_recipe input: rejects missing id', () => {
  const result = GetRecipeInputSchema.safeParse({});
  expect(!result.success, 'Should reject missing id');
});

test('get_recipe output: accepts valid recipe', () => {
  const result = GetRecipeOutputSchema.safeParse({
    recipe: {
      id: 'abc-123',
      title: 'Test Recipe',
      description: null,
      instructions: 'Step 1...',
      servings: 4,
      prepTimeMinutes: 15,
      cookTimeMinutes: 30,
      sourceUrl: null,
      sourceType: 'manual',
      cuisine: 'Italian',
      difficulty: 'easy',
      createdAt: '2025-01-01 12:00:00',
      updatedAt: '2025-01-01 12:00:00'
    }
  });
  expect(result.success, 'Should accept valid recipe');
});

// --- import_recipe ---

test('import_recipe input: accepts valid URL', () => {
  const result = ImportRecipeInputSchema.safeParse({ url: 'https://example.com/recipe' });
  expect(result.success, 'Should accept valid URL');
});

test('import_recipe input: rejects invalid URL', () => {
  const result = ImportRecipeInputSchema.safeParse({ url: 'not-a-url' });
  expect(!result.success, 'Should reject invalid URL');
});

test('import_recipe input: rejects missing URL', () => {
  const result = ImportRecipeInputSchema.safeParse({});
  expect(!result.success, 'Should reject missing URL');
});

test('import_recipe output: accepts success with recipe', () => {
  const result = ImportRecipeOutputSchema.safeParse({
    success: true,
    recipe: {
      id: 'abc-123',
      title: 'Imported Recipe',
      description: null,
      instructions: 'Step 1...',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: 'https://example.com/recipe',
      sourceType: 'imported',
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-01 12:00:00',
      updatedAt: '2025-01-01 12:00:00'
    }
  });
  expect(result.success, 'Should accept success with recipe');
});

test('import_recipe output: accepts failure with error', () => {
  const result = ImportRecipeOutputSchema.safeParse({
    success: false,
    error: 'Failed to parse recipe'
  });
  expect(result.success, 'Should accept failure with error');
});

// --- normalize_recipe ---

test('normalize_recipe input: accepts valid id and updates', () => {
  const result = NormalizeRecipeInputSchema.safeParse({
    id: 'abc-123',
    updates: {
      title: 'Updated Title',
      cuisine: 'Mexican',
      difficulty: 'medium'
    }
  });
  expect(result.success, 'Should accept valid input');
});

test('normalize_recipe input: accepts ingredients updates', () => {
  const result = NormalizeRecipeInputSchema.safeParse({
    id: 'abc-123',
    updates: {
      ingredients: [
        { name: 'flour', quantity: 2, unit: 'cups' },
        { name: 'sugar', quantity: 1, unit: 'cup' }
      ]
    }
  });
  expect(result.success, 'Should accept ingredients updates');
});

test('normalize_recipe input: rejects empty id', () => {
  const result = NormalizeRecipeInputSchema.safeParse({
    id: '',
    updates: { title: 'Test' }
  });
  expect(!result.success, 'Should reject empty id');
});

test('normalize_recipe input: rejects invalid difficulty', () => {
  const result = NormalizeRecipeInputSchema.safeParse({
    id: 'abc-123',
    updates: { difficulty: 'super-hard' }
  });
  expect(!result.success, 'Should reject invalid difficulty');
});

// --- create_recipe ---

test('create_recipe input: accepts valid minimal input', () => {
  const result = CreateRecipeInputSchema.safeParse({
    title: 'New Recipe',
    instructions: 'Step 1: Do something',
    ingredients: [{ name: 'salt' }]
  });
  expect(result.success, 'Should accept minimal valid input');
});

test('create_recipe input: accepts full input', () => {
  const result = CreateRecipeInputSchema.safeParse({
    title: 'Full Recipe',
    description: 'A great recipe',
    instructions: 'Step 1: Start\nStep 2: Finish',
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 30,
    ingredients: [
      { name: 'flour', quantity: 2, unit: 'cups', optional: false },
      { name: 'salt', quantity: 1, unit: 'tsp', optional: true }
    ],
    tags: ['dinner', 'easy'],
    cuisine: 'American',
    difficulty: 'easy'
  });
  expect(result.success, 'Should accept full valid input');
});

test('create_recipe input: rejects missing title', () => {
  const result = CreateRecipeInputSchema.safeParse({
    instructions: 'Step 1',
    ingredients: [{ name: 'salt' }]
  });
  expect(!result.success, 'Should reject missing title');
});

test('create_recipe input: rejects missing instructions', () => {
  const result = CreateRecipeInputSchema.safeParse({
    title: 'Test',
    ingredients: [{ name: 'salt' }]
  });
  expect(!result.success, 'Should reject missing instructions');
});

test('create_recipe input: rejects empty ingredients array', () => {
  const result = CreateRecipeInputSchema.safeParse({
    title: 'Test',
    instructions: 'Step 1',
    ingredients: []
  });
  expect(!result.success, 'Should reject empty ingredients');
});

test('create_recipe input: rejects negative prep time', () => {
  const result = CreateRecipeInputSchema.safeParse({
    title: 'Test',
    instructions: 'Step 1',
    ingredients: [{ name: 'salt' }],
    prepTimeMinutes: -5
  });
  expect(!result.success, 'Should reject negative prep time');
});

// ============================================================================
// PLANNER TOOL TESTS
// ============================================================================

// --- get_preferences ---

test('get_preferences input: accepts empty object', () => {
  const result = GetPreferencesInputSchema.safeParse({});
  expect(result.success, 'Should accept empty object');
});

test('get_preferences output: accepts valid preferences', () => {
  const result = GetPreferencesOutputSchema.safeParse({
    preferences: {
      dietaryRestrictions: ['vegetarian'],
      dislikedIngredients: ['cilantro'],
      favoriteCuisines: ['Italian', 'Mexican'],
      defaultServings: 2,
      maxPrepTimeMinutes: 30,
      planningHeuristics: {
        preferVariety: true,
        balanceCuisines: true,
        avoidRepeatInWeek: false
      }
    }
  });
  expect(result.success, 'Should accept valid preferences');
});

// --- get_week_plan ---

test('get_week_plan input: accepts valid ISO week', () => {
  const result = GetWeekPlanInputSchema.safeParse({ week: '2025-W02' });
  expect(result.success, 'Should accept valid ISO week');
});

test('get_week_plan input: rejects invalid week format', () => {
  const result = GetWeekPlanInputSchema.safeParse({ week: '2025-02' });
  expect(!result.success, 'Should reject invalid week format');
});

test('get_week_plan input: rejects week > 53', () => {
  const result = GetWeekPlanInputSchema.safeParse({ week: '2025-W54' });
  expect(!result.success, 'Should reject week > 53');
});

test('get_week_plan output: accepts null plan with empty slots', () => {
  const result = GetWeekPlanOutputSchema.safeParse({
    plan: null,
    filledSlots: 0,
    emptySlots: [
      { dayOfWeek: 1, mealType: 'dinner' },
      { dayOfWeek: 2, mealType: 'dinner' }
    ]
  });
  expect(result.success, 'Should accept null plan');
});

test('get_week_plan output: accepts valid plan with items', () => {
  const result = GetWeekPlanOutputSchema.safeParse({
    plan: {
      id: 'plan-1',
      week: '2025-W02',
      status: 'draft',
      notes: null,
      createdAt: '2025-01-01 12:00:00',
      updatedAt: '2025-01-01 12:00:00',
      items: [
        { id: 'item-1', planId: 'plan-1', recipeId: 'recipe-1', dayOfWeek: 1, mealType: 'dinner', servings: 2, notes: null }
      ]
    },
    filledSlots: 1,
    emptySlots: []
  });
  expect(result.success, 'Should accept valid plan');
});

// --- suggest_meals ---

test('suggest_meals input: accepts valid input', () => {
  const result = SuggestMealsInputSchema.safeParse({
    week: '2025-W02',
    slots: [
      { dayOfWeek: 1, mealType: 'dinner' },
      { dayOfWeek: 2, mealType: 'lunch' }
    ]
  });
  expect(result.success, 'Should accept valid input');
});

test('suggest_meals input: accepts input with constraints', () => {
  const result = SuggestMealsInputSchema.safeParse({
    week: '2025-W02',
    slots: [{ dayOfWeek: 1, mealType: 'dinner' }],
    constraints: {
      maxPrepTime: 30,
      cuisines: ['Italian', 'Mexican'],
      excludeRecipes: ['recipe-1'],
      preferVariety: true,
      considerPantry: false
    }
  });
  expect(result.success, 'Should accept constraints');
});

test('suggest_meals input: rejects empty slots array', () => {
  const result = SuggestMealsInputSchema.safeParse({
    week: '2025-W02',
    slots: []
  });
  expect(!result.success, 'Should reject empty slots');
});

test('suggest_meals input: rejects invalid dayOfWeek', () => {
  const result = SuggestMealsInputSchema.safeParse({
    week: '2025-W02',
    slots: [{ dayOfWeek: 8, mealType: 'dinner' }]
  });
  expect(!result.success, 'Should reject dayOfWeek > 7');
});

test('suggest_meals output: accepts valid suggestions', () => {
  const result = SuggestMealsOutputSchema.safeParse({
    suggestions: [
      {
        dayOfWeek: 1,
        mealType: 'dinner',
        recipeId: 'recipe-1',
        recipeTitle: 'Pasta Carbonara',
        score: 85,
        reasoning: 'Matches your preference for Italian food'
      }
    ]
  });
  expect(result.success, 'Should accept valid suggestions');
});

// --- set_meal ---

test('set_meal input: accepts valid input', () => {
  const result = SetMealInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'dinner',
    recipeId: 'recipe-1'
  });
  expect(result.success, 'Should accept valid input');
});

test('set_meal input: accepts input with servings', () => {
  const result = SetMealInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'lunch',
    recipeId: 'recipe-1',
    servings: 4
  });
  expect(result.success, 'Should accept servings');
});

test('set_meal input: rejects empty recipeId', () => {
  const result = SetMealInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'dinner',
    recipeId: ''
  });
  expect(!result.success, 'Should reject empty recipeId');
});

test('set_meal input: rejects invalid mealType', () => {
  const result = SetMealInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'snack',
    recipeId: 'recipe-1'
  });
  expect(!result.success, 'Should reject invalid mealType');
});

// --- swap_meal ---

test('swap_meal input: accepts valid input', () => {
  const result = SwapMealInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'dinner',
    reason: 'Missing ingredients',
    newRecipeId: 'recipe-2'
  });
  expect(result.success, 'Should accept valid input');
});

test('swap_meal input: rejects missing reason', () => {
  const result = SwapMealInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'dinner',
    newRecipeId: 'recipe-2'
  });
  expect(!result.success, 'Should reject missing reason');
});

test('swap_meal input: rejects empty reason', () => {
  const result = SwapMealInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'dinner',
    reason: '',
    newRecipeId: 'recipe-2'
  });
  expect(!result.success, 'Should reject empty reason');
});

test('swap_meal output: accepts valid output', () => {
  const result = SwapMealOutputSchema.safeParse({
    oldRecipe: { id: 'recipe-1', title: 'Old Recipe' },
    newRecipe: { id: 'recipe-2', title: 'New Recipe' },
    planItem: {
      id: 'item-1',
      planId: 'plan-1',
      recipeId: 'recipe-2',
      dayOfWeek: 1,
      mealType: 'dinner',
      servings: 2,
      notes: null
    }
  });
  expect(result.success, 'Should accept valid output');
});

// --- get_swap_alternatives ---

test('get_swap_alternatives input: accepts minimal input', () => {
  const result = GetSwapAlternativesInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'dinner'
  });
  expect(result.success, 'Should accept minimal input');
});

test('get_swap_alternatives input: accepts input with reason and count', () => {
  const result = GetSwapAlternativesInputSchema.safeParse({
    week: '2025-W02',
    dayOfWeek: 1,
    mealType: 'dinner',
    reason: 'Not in the mood',
    count: 5
  });
  expect(result.success, 'Should accept reason and count');
});

test('get_swap_alternatives output: accepts valid output', () => {
  const result = GetSwapAlternativesOutputSchema.safeParse({
    currentRecipe: { id: 'recipe-1', title: 'Current Recipe' },
    alternatives: [
      { recipeId: 'recipe-2', recipeTitle: 'Alt 1', reasoning: 'Similar prep time', score: 90 },
      { recipeId: 'recipe-3', recipeTitle: 'Alt 2', reasoning: 'Different cuisine', score: 75 }
    ]
  });
  expect(result.success, 'Should accept valid output');
});

// --- generate_grocery_list ---

test('generate_grocery_list input: accepts valid week', () => {
  const result = GenerateGroceryListInputSchema.safeParse({ week: '2025-W02' });
  expect(result.success, 'Should accept valid week');
});

test('generate_grocery_list input: accepts excludePantry flag', () => {
  const result = GenerateGroceryListInputSchema.safeParse({
    week: '2025-W02',
    excludePantry: true
  });
  expect(result.success, 'Should accept excludePantry');
});

test('generate_grocery_list input: rejects invalid week', () => {
  const result = GenerateGroceryListInputSchema.safeParse({ week: '2025-W00' });
  expect(!result.success, 'Should reject invalid week');
});

test('generate_grocery_list output: accepts valid output', () => {
  const result = GenerateGroceryListOutputSchema.safeParse({
    items: [
      { ingredient: 'Chicken breast', quantity: 1.5, unit: 'kg', category: 'Meat', recipes: ['Recipe 1', 'Recipe 2'] },
      { ingredient: 'Onion', quantity: 4, unit: 'whole', category: 'Produce', recipes: ['Recipe 1'] }
    ],
    totalItems: 2
  });
  expect(result.success, 'Should accept valid output');
});

test('generate_grocery_list output: accepts empty list', () => {
  const result = GenerateGroceryListOutputSchema.safeParse({
    items: [],
    totalItems: 0
  });
  expect(result.success, 'Should accept empty list');
});

