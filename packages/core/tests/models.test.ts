/**
 * Unit tests for model schemas (Zod validation)
 */

import { test, expect, describe } from 'vitest';
import {
  // Ingredient
  IngredientSchema,
  CreateIngredientSchema,
  // Tag
  TagSchema,
  TagCategoryEnum,
  RecipeTagSchema,
  // Recipe
  RecipeSchema,
  RecipeIngredientSchema,
  CreateRecipeSchema,
  SourceTypeEnum,
  DifficultyEnum,
  RecipeWithRelationsSchema,
  // Plan
  IsoWeekSchema,
  isValidIsoWeek,
  PlanStatusEnum,
  MealTypeEnum,
  DayOfWeekSchema,
  WeeklyPlanSchema,
  CreateWeeklyPlanSchema,
  PlanItemSchema,
  CreatePlanItemSchema,
  WeeklyPlanWithItemsSchema,
} from '../src/models/index.js';

// ==================
// Ingredient Tests
// ==================

describe('IngredientSchema', () => {
  test('valid ingredient passes validation', () => {
    const ingredient = {
      id: 'ing-123',
      name: 'Olive Oil',
      category: 'pantry',
      defaultUnit: 'tbsp',
      storeSection: 'pantry',
    };
    const result = IngredientSchema.safeParse(ingredient);
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Olive Oil');
  });

  test('ingredient with null optional fields passes', () => {
    const ingredient = {
      id: 'ing-123',
      name: 'Salt',
      category: null,
      defaultUnit: null,
      storeSection: null,
    };
    const result = IngredientSchema.safeParse(ingredient);
    expect(result.success).toBe(true);
  });

  test('missing id fails validation', () => {
    const ingredient = {
      name: 'Pepper',
      category: 'spice',
      defaultUnit: 'tsp',
    };
    const result = IngredientSchema.safeParse(ingredient);
    expect(result.success).toBe(false);
  });

  test('empty name fails validation', () => {
    const ingredient = {
      id: 'ing-123',
      name: '',
      category: null,
      defaultUnit: null,
    };
    const result = IngredientSchema.safeParse(ingredient);
    expect(result.success).toBe(false);
    const errors = result.error?.issues.map((i) => i.message) ?? [];
    expect(errors.some((e) => e.includes('required') || e.includes('at least'))).toBe(true);
  });
});

describe('CreateIngredientSchema', () => {
  test('creates ingredient without id', () => {
    const createData = {
      name: 'Garlic',
      category: 'produce',
      defaultUnit: 'clove',
      storeSection: 'produce',
    };
    const result = CreateIngredientSchema.safeParse(createData);
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Garlic');
  });
});

// ==================
// Tag Tests
// ==================

describe('TagCategoryEnum', () => {
  test('validates correct categories', () => {
    const validCategories = ['meal_type', 'dietary', 'cuisine', 'season', 'custom'];
    for (const cat of validCategories) {
      const result = TagCategoryEnum.safeParse(cat);
      expect(result.success).toBe(true);
    }
  });

  test('rejects invalid category', () => {
    const result = TagCategoryEnum.safeParse('invalid_category');
    expect(result.success).toBe(false);
  });
});

describe('TagSchema', () => {
  test('valid tag passes validation', () => {
    const tag = {
      id: 'tag-123',
      name: 'Vegetarian',
      category: 'dietary',
    };
    const result = TagSchema.safeParse(tag);
    expect(result.success).toBe(true);
  });

  test('tag with null category passes', () => {
    const tag = {
      id: 'tag-456',
      name: 'Quick Meals',
      category: null,
    };
    const result = TagSchema.safeParse(tag);
    expect(result.success).toBe(true);
  });

  test('empty name fails validation', () => {
    const tag = {
      id: 'tag-123',
      name: '',
      category: 'custom',
    };
    const result = TagSchema.safeParse(tag);
    expect(result.success).toBe(false);
  });

  test('invalid category type fails', () => {
    const tag = {
      id: 'tag-123',
      name: 'Test',
      category: 'invalid',
    };
    const result = TagSchema.safeParse(tag);
    expect(result.success).toBe(false);
  });
});

describe('RecipeTagSchema', () => {
  test('valid recipe-tag junction passes', () => {
    const recipeTag = {
      recipeId: 'recipe-123',
      tagId: 'tag-456',
    };
    const result = RecipeTagSchema.safeParse(recipeTag);
    expect(result.success).toBe(true);
  });

  test('missing tagId fails', () => {
    const recipeTag = {
      recipeId: 'recipe-123',
    };
    const result = RecipeTagSchema.safeParse(recipeTag);
    expect(result.success).toBe(false);
  });
});

// ==================
// Recipe Tests
// ==================

describe('SourceTypeEnum', () => {
  test('validates correct source types', () => {
    const validTypes = ['manual', 'imported', 'agent_curated'];
    for (const type of validTypes) {
      const result = SourceTypeEnum.safeParse(type);
      expect(result.success).toBe(true);
    }
  });
});

describe('DifficultyEnum', () => {
  test('validates correct difficulty levels', () => {
    const validLevels = ['easy', 'medium', 'hard'];
    for (const level of validLevels) {
      const result = DifficultyEnum.safeParse(level);
      expect(result.success).toBe(true);
    }
  });
});

describe('RecipeSchema', () => {
  test('valid recipe passes validation', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Spaghetti Carbonara',
      description: 'Classic Italian pasta dish',
      instructions: '1. Cook pasta\n2. Fry bacon\n3. Mix eggs and cheese\n4. Combine',
      servings: 4,
      prepTimeMinutes: 15,
      cookTimeMinutes: 20,
      sourceUrl: 'https://example.com/carbonara',
      sourceType: 'imported',
      cuisine: 'Italian',
      difficulty: 'medium',
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('Spaghetti Carbonara');
    expect(result.data?.servings).toBe(4);
  });

  test('recipe with null optional fields passes', () => {
    const recipe = {
      id: 'recipe-456',
      title: 'Simple Toast',
      description: null,
      instructions: 'Toast the bread',
      servings: 1,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03T10:00:00Z',
      updatedAt: '2025-01-03T10:00:00Z',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(true);
  });

  test('empty title fails validation', () => {
    const recipe = {
      id: 'recipe-123',
      title: '',
      description: null,
      instructions: 'Do something',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(false);
  });

  test('empty instructions fails validation', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Test Recipe',
      description: null,
      instructions: '',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(false);
  });

  test('negative servings fails validation', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Test Recipe',
      description: null,
      instructions: 'Do something',
      servings: -1,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(false);
  });

  test('invalid sourceType fails validation', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Test Recipe',
      description: null,
      instructions: 'Do something',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: 'invalid_source',
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(false);
  });

  test('invalid difficulty fails validation', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Test Recipe',
      description: null,
      instructions: 'Do something',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: 'super_hard',
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(false);
  });

  test('invalid URL fails validation', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Test Recipe',
      description: null,
      instructions: 'Do something',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: 'not-a-url',
      sourceType: null,
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(false);
  });

  test('empty string sourceUrl transforms to null', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Test Recipe',
      description: null,
      instructions: 'Do something',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: '',
      sourceType: null,
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(true);
    expect(result.data?.sourceUrl).toBe(null);
  });
});

describe('CreateRecipeSchema', () => {
  test('creates recipe without id and timestamps', () => {
    const createData = {
      title: 'New Recipe',
      description: 'A delicious new recipe',
      instructions: 'Follow these steps',
      servings: 4,
      prepTimeMinutes: 10,
      cookTimeMinutes: 30,
      sourceUrl: null,
      sourceType: 'manual',
      cuisine: 'American',
      difficulty: 'easy',
    };
    const result = CreateRecipeSchema.safeParse(createData);
    expect(result.success).toBe(true);
  });
});

// ==================
// RecipeIngredient Tests
// ==================

describe('RecipeIngredientSchema', () => {
  test('valid recipe ingredient passes', () => {
    const recipeIngredient = {
      id: 'ri-123',
      recipeId: 'recipe-123',
      ingredientId: 'ing-456',
      quantity: 2.5,
      unit: 'cups',
      notes: 'finely chopped',
      optional: false,
    };
    const result = RecipeIngredientSchema.safeParse(recipeIngredient);
    expect(result.success).toBe(true);
    expect(result.data?.quantity).toBe(2.5);
  });

  test('optional ingredient flag works', () => {
    const recipeIngredient = {
      id: 'ri-123',
      recipeId: 'recipe-123',
      ingredientId: 'ing-456',
      quantity: 1,
      unit: 'tbsp',
      notes: null,
      optional: true,
    };
    const result = RecipeIngredientSchema.safeParse(recipeIngredient);
    expect(result.success).toBe(true);
    expect(result.data?.optional).toBe(true);
  });

  test('null quantity and unit passes', () => {
    const recipeIngredient = {
      id: 'ri-123',
      recipeId: 'recipe-123',
      ingredientId: 'ing-456',
      quantity: null,
      unit: null,
      notes: 'to taste',
      optional: false,
    };
    const result = RecipeIngredientSchema.safeParse(recipeIngredient);
    expect(result.success).toBe(true);
  });

  test('negative quantity fails', () => {
    const recipeIngredient = {
      id: 'ri-123',
      recipeId: 'recipe-123',
      ingredientId: 'ing-456',
      quantity: -1,
      unit: 'cups',
      notes: null,
      optional: false,
    };
    const result = RecipeIngredientSchema.safeParse(recipeIngredient);
    expect(result.success).toBe(false);
  });

  test('missing recipeId fails', () => {
    const recipeIngredient = {
      id: 'ri-123',
      ingredientId: 'ing-456',
      quantity: 1,
      unit: 'cup',
      notes: null,
      optional: false,
    };
    const result = RecipeIngredientSchema.safeParse(recipeIngredient);
    expect(result.success).toBe(false);
  });
});

// ==================
// RecipeWithRelations Tests
// ==================

describe('RecipeWithRelationsSchema', () => {
  test('recipe with ingredients array passes', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Test Recipe',
      description: null,
      instructions: 'Do something',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
      ingredients: [
        {
          id: 'ri-1',
          recipeId: 'recipe-123',
          ingredientId: 'ing-1',
          quantity: 2,
          unit: 'cups',
          notes: null,
          optional: false,
        },
      ],
      tagIds: ['tag-1', 'tag-2'],
    };
    const result = RecipeWithRelationsSchema.safeParse(recipe);
    expect(result.success).toBe(true);
    expect(result.data?.ingredients?.length).toBe(1);
    expect(result.data?.tagIds?.length).toBe(2);
  });

  test('recipe without relations passes', () => {
    const recipe = {
      id: 'recipe-123',
      title: 'Test Recipe',
      description: null,
      instructions: 'Do something',
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = RecipeWithRelationsSchema.safeParse(recipe);
    expect(result.success).toBe(true);
  });
});

// ==================
// Error Message Tests
// ==================

test('Schema errors contain meaningful messages', () => {
  const invalidIngredient = {
    id: '',
    name: '',
    category: null,
    defaultUnit: null,
  };
  const result = IngredientSchema.safeParse(invalidIngredient);
  expect(result.success).toBe(false);
  const errors = result.error?.issues ?? [];
  expect(errors.length).toBeGreaterThanOrEqual(1);
  const messages = errors.map((e) => e.message);
  expect(
    messages.some((m) => m.toLowerCase().includes('required') || m.toLowerCase().includes('at least'))
  ).toBe(true);
});

// ==================
// ISO Week Validation Tests
// ==================

describe('IsoWeekSchema', () => {
  test('valid ISO weeks pass validation', () => {
    const validWeeks = ['2025-W01', '2025-W02', '2025-W52', '2024-W53', '2025-W09', '2025-W10', '2025-W49'];
    for (const week of validWeeks) {
      const result = IsoWeekSchema.safeParse(week);
      expect(result.success).toBe(true);
    }
  });

  test('rejects W00 (invalid week number)', () => {
    const result = IsoWeekSchema.safeParse('2025-W00');
    expect(result.success).toBe(false);
  });

  test('rejects W54 (invalid week number)', () => {
    const result = IsoWeekSchema.safeParse('2025-W54');
    expect(result.success).toBe(false);
  });

  test('rejects missing W prefix', () => {
    const result = IsoWeekSchema.safeParse('2025-01');
    expect(result.success).toBe(false);
  });

  test('rejects reversed format', () => {
    const result = IsoWeekSchema.safeParse('W01-2025');
    expect(result.success).toBe(false);
  });

  test('rejects lowercase w', () => {
    const result = IsoWeekSchema.safeParse('2025-w01');
    expect(result.success).toBe(false);
  });

  test('rejects single digit week', () => {
    const result = IsoWeekSchema.safeParse('2025-W1');
    expect(result.success).toBe(false);
  });
});

describe('isValidIsoWeek', () => {
  test('helper function validates correctly', () => {
    expect(isValidIsoWeek('2025-W02')).toBe(true);
    expect(isValidIsoWeek('2025-W53')).toBe(true);
    expect(isValidIsoWeek('2025-W00')).toBe(false);
    expect(isValidIsoWeek('2025-W54')).toBe(false);
    expect(isValidIsoWeek('invalid')).toBe(false);
    expect(isValidIsoWeek('')).toBe(false);
  });
});

// ==================
// Plan Status & Meal Type Tests
// ==================

describe('PlanStatusEnum', () => {
  test('validates correct statuses', () => {
    const validStatuses = ['draft', 'active', 'completed'];
    for (const status of validStatuses) {
      const result = PlanStatusEnum.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  test('rejects invalid status', () => {
    const result = PlanStatusEnum.safeParse('pending');
    expect(result.success).toBe(false);
  });
});

describe('MealTypeEnum', () => {
  test('validates correct meal types', () => {
    const validTypes = ['breakfast', 'lunch', 'dinner'];
    for (const type of validTypes) {
      const result = MealTypeEnum.safeParse(type);
      expect(result.success).toBe(true);
    }
  });

  test('rejects invalid meal type', () => {
    const result = MealTypeEnum.safeParse('snack');
    expect(result.success).toBe(false);
  });
});

describe('DayOfWeekSchema', () => {
  test('validates days 1-7', () => {
    for (let day = 1; day <= 7; day++) {
      const result = DayOfWeekSchema.safeParse(day);
      expect(result.success).toBe(true);
    }
  });

  test('rejects day 0', () => {
    const result = DayOfWeekSchema.safeParse(0);
    expect(result.success).toBe(false);
  });

  test('rejects day 8', () => {
    const result = DayOfWeekSchema.safeParse(8);
    expect(result.success).toBe(false);
  });

  test('rejects non-integers', () => {
    const result = DayOfWeekSchema.safeParse(1.5);
    expect(result.success).toBe(false);
  });
});

// ==================
// WeeklyPlan Tests
// ==================

describe('WeeklyPlanSchema', () => {
  test('valid weekly plan passes validation', () => {
    const plan = {
      id: 'plan-123',
      week: '2025-W02',
      status: 'draft',
      notes: 'New year meal planning',
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = WeeklyPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
    expect(result.data?.week).toBe('2025-W02');
    expect(result.data?.status).toBe('draft');
  });

  test('plan with null notes passes', () => {
    const plan = {
      id: 'plan-123',
      week: '2025-W02',
      status: 'active',
      notes: null,
      createdAt: '2025-01-03T10:00:00Z',
      updatedAt: '2025-01-03T10:00:00Z',
    };
    const result = WeeklyPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  test('invalid week format fails', () => {
    const plan = {
      id: 'plan-123',
      week: '2025-01',
      status: 'draft',
      notes: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = WeeklyPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  test('invalid status fails', () => {
    const plan = {
      id: 'plan-123',
      week: '2025-W02',
      status: 'pending',
      notes: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = WeeklyPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  test('missing id fails', () => {
    const plan = {
      week: '2025-W02',
      status: 'draft',
      notes: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = WeeklyPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });
});

describe('CreateWeeklyPlanSchema', () => {
  test('creates plan without id and timestamps', () => {
    const createData = {
      week: '2025-W02',
      status: 'draft',
      notes: 'Test plan',
    };
    const result = CreateWeeklyPlanSchema.safeParse(createData);
    expect(result.success).toBe(true);
    expect(result.data?.week).toBe('2025-W02');
  });

  test('status defaults to draft', () => {
    const createData = {
      week: '2025-W02',
      notes: null,
    };
    const result = CreateWeeklyPlanSchema.safeParse(createData);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('draft');
  });
});

// ==================
// PlanItem Tests
// ==================

describe('PlanItemSchema', () => {
  test('valid plan item passes validation', () => {
    const planItem = {
      id: 'item-123',
      planId: 'plan-456',
      recipeId: 'recipe-789',
      dayOfWeek: 1,
      mealType: 'dinner',
      servings: 4,
      notes: 'Double the sauce',
    };
    const result = PlanItemSchema.safeParse(planItem);
    expect(result.success).toBe(true);
    expect(result.data?.dayOfWeek).toBe(1);
    expect(result.data?.mealType).toBe('dinner');
  });

  test('plan item with null recipeId passes', () => {
    const planItem = {
      id: 'item-123',
      planId: 'plan-456',
      recipeId: null,
      dayOfWeek: 3,
      mealType: 'lunch',
      servings: 2,
      notes: 'Eating out',
    };
    const result = PlanItemSchema.safeParse(planItem);
    expect(result.success).toBe(true);
  });

  test('plan item with null notes passes', () => {
    const planItem = {
      id: 'item-123',
      planId: 'plan-456',
      recipeId: 'recipe-789',
      dayOfWeek: 7,
      mealType: 'breakfast',
      servings: 2,
      notes: null,
    };
    const result = PlanItemSchema.safeParse(planItem);
    expect(result.success).toBe(true);
  });

  test('invalid dayOfWeek fails', () => {
    const planItem = {
      id: 'item-123',
      planId: 'plan-456',
      recipeId: 'recipe-789',
      dayOfWeek: 8,
      mealType: 'dinner',
      servings: 2,
      notes: null,
    };
    const result = PlanItemSchema.safeParse(planItem);
    expect(result.success).toBe(false);
  });

  test('invalid mealType fails', () => {
    const planItem = {
      id: 'item-123',
      planId: 'plan-456',
      recipeId: 'recipe-789',
      dayOfWeek: 1,
      mealType: 'brunch',
      servings: 2,
      notes: null,
    };
    const result = PlanItemSchema.safeParse(planItem);
    expect(result.success).toBe(false);
  });

  test('negative servings fails', () => {
    const planItem = {
      id: 'item-123',
      planId: 'plan-456',
      recipeId: 'recipe-789',
      dayOfWeek: 1,
      mealType: 'dinner',
      servings: -1,
      notes: null,
    };
    const result = PlanItemSchema.safeParse(planItem);
    expect(result.success).toBe(false);
  });

  test('zero servings fails', () => {
    const planItem = {
      id: 'item-123',
      planId: 'plan-456',
      recipeId: 'recipe-789',
      dayOfWeek: 1,
      mealType: 'dinner',
      servings: 0,
      notes: null,
    };
    const result = PlanItemSchema.safeParse(planItem);
    expect(result.success).toBe(false);
  });

  test('missing planId fails', () => {
    const planItem = {
      id: 'item-123',
      recipeId: 'recipe-789',
      dayOfWeek: 1,
      mealType: 'dinner',
      servings: 2,
      notes: null,
    };
    const result = PlanItemSchema.safeParse(planItem);
    expect(result.success).toBe(false);
  });
});

describe('CreatePlanItemSchema', () => {
  test('creates plan item without id', () => {
    const createData = {
      planId: 'plan-456',
      recipeId: 'recipe-789',
      dayOfWeek: 1,
      mealType: 'dinner',
      servings: 4,
      notes: null,
    };
    const result = CreatePlanItemSchema.safeParse(createData);
    expect(result.success).toBe(true);
  });

  test('servings defaults to 2', () => {
    const createData = {
      planId: 'plan-456',
      recipeId: 'recipe-789',
      dayOfWeek: 1,
      mealType: 'dinner',
      notes: null,
    };
    const result = CreatePlanItemSchema.safeParse(createData);
    expect(result.success).toBe(true);
    expect(result.data?.servings).toBe(2);
  });
});

// ==================
// WeeklyPlanWithItems Tests
// ==================

describe('WeeklyPlanWithItemsSchema', () => {
  test('plan with items array passes', () => {
    const plan = {
      id: 'plan-123',
      week: '2025-W02',
      status: 'active',
      notes: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
      items: [
        {
          id: 'item-1',
          planId: 'plan-123',
          recipeId: 'recipe-1',
          dayOfWeek: 1,
          mealType: 'dinner',
          servings: 4,
          notes: null,
        },
        {
          id: 'item-2',
          planId: 'plan-123',
          recipeId: 'recipe-2',
          dayOfWeek: 2,
          mealType: 'lunch',
          servings: 2,
          notes: 'Leftover night',
        },
      ],
    };
    const result = WeeklyPlanWithItemsSchema.safeParse(plan);
    expect(result.success).toBe(true);
    expect(result.data?.items?.length).toBe(2);
  });

  test('plan without items passes', () => {
    const plan = {
      id: 'plan-123',
      week: '2025-W02',
      status: 'draft',
      notes: null,
      createdAt: '2025-01-03 10:00:00',
      updatedAt: '2025-01-03 10:00:00',
    };
    const result = WeeklyPlanWithItemsSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });
});
