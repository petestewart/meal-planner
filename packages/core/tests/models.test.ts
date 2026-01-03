/**
 * Unit tests for model schemas (Zod validation)
 */

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

// Test runner (simple, no dependencies)
interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
}

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

async function runTests(): Promise<void> {
  const results: TestResult[] = [];

  for (const { name, fn } of tests) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`  PASS: ${name}`);
    } catch (error) {
      results.push({ name, passed: false, error: error as Error });
      console.log(`  FAIL: ${name}`);
      console.log(`        ${(error as Error).message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Assertions
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn: () => void, message: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(`Expected function to throw: ${message}`);
  }
}

// ==================
// Ingredient Tests
// ==================

test('IngredientSchema: valid ingredient passes validation', () => {
  const ingredient = {
    id: 'ing-123',
    name: 'Olive Oil',
    category: 'pantry',
    defaultUnit: 'tbsp',
  };
  const result = IngredientSchema.safeParse(ingredient);
  assert(result.success, 'Valid ingredient should pass validation');
  assertEqual(result.data?.name, 'Olive Oil', 'Name should match');
});

test('IngredientSchema: ingredient with null optional fields passes', () => {
  const ingredient = {
    id: 'ing-123',
    name: 'Salt',
    category: null,
    defaultUnit: null,
  };
  const result = IngredientSchema.safeParse(ingredient);
  assert(result.success, 'Ingredient with null optional fields should pass');
});

test('IngredientSchema: missing id fails validation', () => {
  const ingredient = {
    name: 'Pepper',
    category: 'spice',
    defaultUnit: 'tsp',
  };
  const result = IngredientSchema.safeParse(ingredient);
  assert(!result.success, 'Missing id should fail validation');
});

test('IngredientSchema: empty name fails validation', () => {
  const ingredient = {
    id: 'ing-123',
    name: '',
    category: null,
    defaultUnit: null,
  };
  const result = IngredientSchema.safeParse(ingredient);
  assert(!result.success, 'Empty name should fail validation');
  const errors = result.error?.issues.map((i) => i.message) ?? [];
  assert(errors.some((e) => e.includes('required') || e.includes('at least')), 'Should have meaningful error message');
});

test('CreateIngredientSchema: creates ingredient without id', () => {
  const createData = {
    name: 'Garlic',
    category: 'produce',
    defaultUnit: 'clove',
  };
  const result = CreateIngredientSchema.safeParse(createData);
  assert(result.success, 'CreateIngredient should work without id');
  assertEqual(result.data?.name, 'Garlic', 'Name should match');
});

// ==================
// Tag Tests
// ==================

test('TagCategoryEnum: validates correct categories', () => {
  const validCategories = ['meal_type', 'dietary', 'cuisine', 'season', 'custom'];
  for (const cat of validCategories) {
    const result = TagCategoryEnum.safeParse(cat);
    assert(result.success, `Category '${cat}' should be valid`);
  }
});

test('TagCategoryEnum: rejects invalid category', () => {
  const result = TagCategoryEnum.safeParse('invalid_category');
  assert(!result.success, 'Invalid category should fail');
});

test('TagSchema: valid tag passes validation', () => {
  const tag = {
    id: 'tag-123',
    name: 'Vegetarian',
    category: 'dietary',
  };
  const result = TagSchema.safeParse(tag);
  assert(result.success, 'Valid tag should pass validation');
});

test('TagSchema: tag with null category passes', () => {
  const tag = {
    id: 'tag-456',
    name: 'Quick Meals',
    category: null,
  };
  const result = TagSchema.safeParse(tag);
  assert(result.success, 'Tag with null category should pass');
});

test('TagSchema: empty name fails validation', () => {
  const tag = {
    id: 'tag-123',
    name: '',
    category: 'custom',
  };
  const result = TagSchema.safeParse(tag);
  assert(!result.success, 'Empty name should fail');
});

test('TagSchema: invalid category type fails', () => {
  const tag = {
    id: 'tag-123',
    name: 'Test',
    category: 'invalid',
  };
  const result = TagSchema.safeParse(tag);
  assert(!result.success, 'Invalid category should fail');
});

test('RecipeTagSchema: valid recipe-tag junction passes', () => {
  const recipeTag = {
    recipeId: 'recipe-123',
    tagId: 'tag-456',
  };
  const result = RecipeTagSchema.safeParse(recipeTag);
  assert(result.success, 'Valid recipe-tag should pass');
});

test('RecipeTagSchema: missing tagId fails', () => {
  const recipeTag = {
    recipeId: 'recipe-123',
  };
  const result = RecipeTagSchema.safeParse(recipeTag);
  assert(!result.success, 'Missing tagId should fail');
});

// ==================
// Recipe Tests
// ==================

test('SourceTypeEnum: validates correct source types', () => {
  const validTypes = ['manual', 'imported', 'agent_curated'];
  for (const type of validTypes) {
    const result = SourceTypeEnum.safeParse(type);
    assert(result.success, `Source type '${type}' should be valid`);
  }
});

test('DifficultyEnum: validates correct difficulty levels', () => {
  const validLevels = ['easy', 'medium', 'hard'];
  for (const level of validLevels) {
    const result = DifficultyEnum.safeParse(level);
    assert(result.success, `Difficulty '${level}' should be valid`);
  }
});

test('RecipeSchema: valid recipe passes validation', () => {
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
  assert(result.success, 'Valid recipe should pass validation');
  assertEqual(result.data?.title, 'Spaghetti Carbonara', 'Title should match');
  assertEqual(result.data?.servings, 4, 'Servings should match');
});

test('RecipeSchema: recipe with null optional fields passes', () => {
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
  assert(result.success, 'Recipe with null optional fields should pass');
});

test('RecipeSchema: empty title fails validation', () => {
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
  assert(!result.success, 'Empty title should fail');
});

test('RecipeSchema: empty instructions fails validation', () => {
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
  assert(!result.success, 'Empty instructions should fail');
});

test('RecipeSchema: negative servings fails validation', () => {
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
  assert(!result.success, 'Negative servings should fail');
});

test('RecipeSchema: invalid sourceType fails validation', () => {
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
  assert(!result.success, 'Invalid sourceType should fail');
});

test('RecipeSchema: invalid difficulty fails validation', () => {
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
  assert(!result.success, 'Invalid difficulty should fail');
});

test('RecipeSchema: invalid URL fails validation', () => {
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
  assert(!result.success, 'Invalid URL should fail');
});

test('RecipeSchema: empty string sourceUrl transforms to null', () => {
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
  assert(result.success, 'Empty sourceUrl should transform to null');
  assertEqual(result.data?.sourceUrl, null, 'sourceUrl should be null');
});

test('CreateRecipeSchema: creates recipe without id and timestamps', () => {
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
  assert(result.success, 'CreateRecipe should work without id and timestamps');
});

// ==================
// RecipeIngredient Tests
// ==================

test('RecipeIngredientSchema: valid recipe ingredient passes', () => {
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
  assert(result.success, 'Valid recipe ingredient should pass');
  assertEqual(result.data?.quantity, 2.5, 'Quantity should match');
});

test('RecipeIngredientSchema: optional ingredient flag works', () => {
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
  assert(result.success, 'Optional ingredient should pass');
  assertEqual(result.data?.optional, true, 'Optional should be true');
});

test('RecipeIngredientSchema: null quantity and unit passes', () => {
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
  assert(result.success, 'Null quantity and unit should pass (for "to taste" ingredients)');
});

test('RecipeIngredientSchema: negative quantity fails', () => {
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
  assert(!result.success, 'Negative quantity should fail');
});

test('RecipeIngredientSchema: missing recipeId fails', () => {
  const recipeIngredient = {
    id: 'ri-123',
    ingredientId: 'ing-456',
    quantity: 1,
    unit: 'cup',
    notes: null,
    optional: false,
  };
  const result = RecipeIngredientSchema.safeParse(recipeIngredient);
  assert(!result.success, 'Missing recipeId should fail');
});

// ==================
// RecipeWithRelations Tests
// ==================

test('RecipeWithRelationsSchema: recipe with ingredients array passes', () => {
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
  assert(result.success, 'Recipe with relations should pass');
  assertEqual(result.data?.ingredients?.length, 1, 'Should have 1 ingredient');
  assertEqual(result.data?.tagIds?.length, 2, 'Should have 2 tag IDs');
});

test('RecipeWithRelationsSchema: recipe without relations passes', () => {
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
  assert(result.success, 'Recipe without relations should pass (optional arrays)');
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
  assert(!result.success, 'Invalid ingredient should fail');
  const errors = result.error?.issues ?? [];
  assert(errors.length >= 1, 'Should have at least one error');
  const messages = errors.map((e) => e.message);
  assert(
    messages.some((m) => m.toLowerCase().includes('required') || m.toLowerCase().includes('at least')),
    'Error messages should be meaningful'
  );
});

// ==================
// ISO Week Validation Tests
// ==================

test('IsoWeekSchema: valid ISO weeks pass validation', () => {
  const validWeeks = ['2025-W01', '2025-W02', '2025-W52', '2024-W53', '2025-W09', '2025-W10', '2025-W49'];
  for (const week of validWeeks) {
    const result = IsoWeekSchema.safeParse(week);
    assert(result.success, `ISO week '${week}' should be valid`);
  }
});

test('IsoWeekSchema: rejects W00 (invalid week number)', () => {
  const result = IsoWeekSchema.safeParse('2025-W00');
  assert(!result.success, '2025-W00 should be invalid (week 00 does not exist)');
});

test('IsoWeekSchema: rejects W54 (invalid week number)', () => {
  const result = IsoWeekSchema.safeParse('2025-W54');
  assert(!result.success, '2025-W54 should be invalid (max is 53)');
});

test('IsoWeekSchema: rejects missing W prefix', () => {
  const result = IsoWeekSchema.safeParse('2025-01');
  assert(!result.success, '2025-01 should be invalid (missing W)');
});

test('IsoWeekSchema: rejects reversed format', () => {
  const result = IsoWeekSchema.safeParse('W01-2025');
  assert(!result.success, 'W01-2025 should be invalid (wrong order)');
});

test('IsoWeekSchema: rejects lowercase w', () => {
  const result = IsoWeekSchema.safeParse('2025-w01');
  assert(!result.success, '2025-w01 should be invalid (lowercase w)');
});

test('IsoWeekSchema: rejects single digit week', () => {
  const result = IsoWeekSchema.safeParse('2025-W1');
  assert(!result.success, '2025-W1 should be invalid (must be two digits)');
});

test('isValidIsoWeek: helper function validates correctly', () => {
  assert(isValidIsoWeek('2025-W02'), '2025-W02 should be valid');
  assert(isValidIsoWeek('2025-W53'), '2025-W53 should be valid');
  assert(!isValidIsoWeek('2025-W00'), '2025-W00 should be invalid');
  assert(!isValidIsoWeek('2025-W54'), '2025-W54 should be invalid');
  assert(!isValidIsoWeek('invalid'), 'invalid should be invalid');
  assert(!isValidIsoWeek(''), 'empty string should be invalid');
});

// ==================
// Plan Status & Meal Type Tests
// ==================

test('PlanStatusEnum: validates correct statuses', () => {
  const validStatuses = ['draft', 'active', 'completed'];
  for (const status of validStatuses) {
    const result = PlanStatusEnum.safeParse(status);
    assert(result.success, `Status '${status}' should be valid`);
  }
});

test('PlanStatusEnum: rejects invalid status', () => {
  const result = PlanStatusEnum.safeParse('pending');
  assert(!result.success, 'Invalid status should fail');
});

test('MealTypeEnum: validates correct meal types', () => {
  const validTypes = ['breakfast', 'lunch', 'dinner'];
  for (const type of validTypes) {
    const result = MealTypeEnum.safeParse(type);
    assert(result.success, `Meal type '${type}' should be valid`);
  }
});

test('MealTypeEnum: rejects invalid meal type', () => {
  const result = MealTypeEnum.safeParse('snack');
  assert(!result.success, 'Invalid meal type should fail');
});

test('DayOfWeekSchema: validates days 1-7', () => {
  for (let day = 1; day <= 7; day++) {
    const result = DayOfWeekSchema.safeParse(day);
    assert(result.success, `Day ${day} should be valid`);
  }
});

test('DayOfWeekSchema: rejects day 0', () => {
  const result = DayOfWeekSchema.safeParse(0);
  assert(!result.success, 'Day 0 should be invalid');
});

test('DayOfWeekSchema: rejects day 8', () => {
  const result = DayOfWeekSchema.safeParse(8);
  assert(!result.success, 'Day 8 should be invalid');
});

test('DayOfWeekSchema: rejects non-integers', () => {
  const result = DayOfWeekSchema.safeParse(1.5);
  assert(!result.success, 'Non-integer day should be invalid');
});

// ==================
// WeeklyPlan Tests
// ==================

test('WeeklyPlanSchema: valid weekly plan passes validation', () => {
  const plan = {
    id: 'plan-123',
    week: '2025-W02',
    status: 'draft',
    notes: 'New year meal planning',
    createdAt: '2025-01-03 10:00:00',
    updatedAt: '2025-01-03 10:00:00',
  };
  const result = WeeklyPlanSchema.safeParse(plan);
  assert(result.success, 'Valid weekly plan should pass validation');
  assertEqual(result.data?.week, '2025-W02', 'Week should match');
  assertEqual(result.data?.status, 'draft', 'Status should match');
});

test('WeeklyPlanSchema: plan with null notes passes', () => {
  const plan = {
    id: 'plan-123',
    week: '2025-W02',
    status: 'active',
    notes: null,
    createdAt: '2025-01-03T10:00:00Z',
    updatedAt: '2025-01-03T10:00:00Z',
  };
  const result = WeeklyPlanSchema.safeParse(plan);
  assert(result.success, 'Plan with null notes should pass');
});

test('WeeklyPlanSchema: invalid week format fails', () => {
  const plan = {
    id: 'plan-123',
    week: '2025-01',
    status: 'draft',
    notes: null,
    createdAt: '2025-01-03 10:00:00',
    updatedAt: '2025-01-03 10:00:00',
  };
  const result = WeeklyPlanSchema.safeParse(plan);
  assert(!result.success, 'Invalid week format should fail');
});

test('WeeklyPlanSchema: invalid status fails', () => {
  const plan = {
    id: 'plan-123',
    week: '2025-W02',
    status: 'pending',
    notes: null,
    createdAt: '2025-01-03 10:00:00',
    updatedAt: '2025-01-03 10:00:00',
  };
  const result = WeeklyPlanSchema.safeParse(plan);
  assert(!result.success, 'Invalid status should fail');
});

test('WeeklyPlanSchema: missing id fails', () => {
  const plan = {
    week: '2025-W02',
    status: 'draft',
    notes: null,
    createdAt: '2025-01-03 10:00:00',
    updatedAt: '2025-01-03 10:00:00',
  };
  const result = WeeklyPlanSchema.safeParse(plan);
  assert(!result.success, 'Missing id should fail');
});

test('CreateWeeklyPlanSchema: creates plan without id and timestamps', () => {
  const createData = {
    week: '2025-W02',
    status: 'draft',
    notes: 'Test plan',
  };
  const result = CreateWeeklyPlanSchema.safeParse(createData);
  assert(result.success, 'CreateWeeklyPlan should work without id and timestamps');
  assertEqual(result.data?.week, '2025-W02', 'Week should match');
});

test('CreateWeeklyPlanSchema: status defaults to draft', () => {
  const createData = {
    week: '2025-W02',
    notes: null,
  };
  const result = CreateWeeklyPlanSchema.safeParse(createData);
  assert(result.success, 'CreateWeeklyPlan should work with default status');
  assertEqual(result.data?.status, 'draft', 'Status should default to draft');
});

// ==================
// PlanItem Tests
// ==================

test('PlanItemSchema: valid plan item passes validation', () => {
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
  assert(result.success, 'Valid plan item should pass validation');
  assertEqual(result.data?.dayOfWeek, 1, 'Day of week should be 1 (Monday)');
  assertEqual(result.data?.mealType, 'dinner', 'Meal type should match');
});

test('PlanItemSchema: plan item with null recipeId passes', () => {
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
  assert(result.success, 'Plan item with null recipeId should pass');
});

test('PlanItemSchema: plan item with null notes passes', () => {
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
  assert(result.success, 'Plan item with null notes should pass');
});

test('PlanItemSchema: invalid dayOfWeek fails', () => {
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
  assert(!result.success, 'Invalid day of week should fail');
});

test('PlanItemSchema: invalid mealType fails', () => {
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
  assert(!result.success, 'Invalid meal type should fail');
});

test('PlanItemSchema: negative servings fails', () => {
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
  assert(!result.success, 'Negative servings should fail');
});

test('PlanItemSchema: zero servings fails', () => {
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
  assert(!result.success, 'Zero servings should fail');
});

test('PlanItemSchema: missing planId fails', () => {
  const planItem = {
    id: 'item-123',
    recipeId: 'recipe-789',
    dayOfWeek: 1,
    mealType: 'dinner',
    servings: 2,
    notes: null,
  };
  const result = PlanItemSchema.safeParse(planItem);
  assert(!result.success, 'Missing planId should fail');
});

test('CreatePlanItemSchema: creates plan item without id', () => {
  const createData = {
    planId: 'plan-456',
    recipeId: 'recipe-789',
    dayOfWeek: 1,
    mealType: 'dinner',
    servings: 4,
    notes: null,
  };
  const result = CreatePlanItemSchema.safeParse(createData);
  assert(result.success, 'CreatePlanItem should work without id');
});

test('CreatePlanItemSchema: servings defaults to 2', () => {
  const createData = {
    planId: 'plan-456',
    recipeId: 'recipe-789',
    dayOfWeek: 1,
    mealType: 'dinner',
    notes: null,
  };
  const result = CreatePlanItemSchema.safeParse(createData);
  assert(result.success, 'CreatePlanItem should work with default servings');
  assertEqual(result.data?.servings, 2, 'Servings should default to 2');
});

// ==================
// WeeklyPlanWithItems Tests
// ==================

test('WeeklyPlanWithItemsSchema: plan with items array passes', () => {
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
  assert(result.success, 'Plan with items should pass');
  assertEqual(result.data?.items?.length, 2, 'Should have 2 items');
});

test('WeeklyPlanWithItemsSchema: plan without items passes', () => {
  const plan = {
    id: 'plan-123',
    week: '2025-W02',
    status: 'draft',
    notes: null,
    createdAt: '2025-01-03 10:00:00',
    updatedAt: '2025-01-03 10:00:00',
  };
  const result = WeeklyPlanWithItemsSchema.safeParse(plan);
  assert(result.success, 'Plan without items should pass (optional array)');
});

// Run all tests
console.log('Running model schema tests...');
console.log('');
runTests();
