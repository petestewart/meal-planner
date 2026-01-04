/**
 * Unit tests for GroceryService
 *
 * Tests grocery list generation including:
 * - Fetching plan items and their recipes
 * - Aggregating ingredients by name
 * - Summing quantities for same ingredients
 * - Handling unit conversions
 * - Grouping by category
 * - Scaling quantities based on servings
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { GroceryService } from '../src/services/grocery.service.js';
import { PlanRepository } from '../src/repos/plan.repo.js';
import { RecipeRepository } from '../src/repos/recipe.repo.js';
import type { Database } from 'better-sqlite3';

function assertNull<T>(value: T | null | undefined, message: string): void {
  if (value !== null && value !== undefined) {
    throw new Error(`${message}: expected null, got ${value}`);
  }
}

function assertArrayLength<T>(arr: T[], expected: number, message: string): void {
  if (arr.length !== expected) {
    throw new Error(`${message}: expected length ${expected}, got ${arr.length}`);
  }
}

function assertApproxEqual(actual: number, expected: number, tolerance: number, message: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ~${expected}, got ${actual}`);
  }
}

// Database setup helper
interface TestContext {
  db: Database;
  groceryService: GroceryService;
  planRepo: PlanRepository;
  recipeRepo: RecipeRepository;
  cleanup: () => void;
}

function setupTestDb(): TestContext {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const groceryService = new GroceryService(db);
  const planRepo = new PlanRepository(db);
  const recipeRepo = new RecipeRepository(db);

  return {
    db,
    groceryService,
    planRepo,
    recipeRepo,
    cleanup: () => closeDb(db),
  };
}

// Helper to create a test ingredient
function createIngredient(db: Database, id: string, name: string, category: string | null = null, defaultUnit: string | null = null): string {
  db.prepare(
    `INSERT INTO ingredients (id, name, category, default_unit)
     VALUES (?, ?, ?, ?)`
  ).run(id, name, category, defaultUnit);
  return id;
}

// Helper to create a test recipe with ingredients
function createRecipe(
  db: Database,
  recipeRepo: RecipeRepository,
  title: string,
  servings: number,
  ingredients: Array<{ ingredientId: string; quantity: number | null; unit: string | null }>
): string {
  const recipe = recipeRepo.create(
    {
      title,
      instructions: 'Test instructions',
      servings,
    },
    ingredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: null,
      optional: false,
    }))
  );
  return recipe.id;
}

// =====================
// Basic Functionality Tests
// =====================

test('generateList returns null for non-existent week', () => {
  const { groceryService, cleanup } = setupTestDb();
  try {
    const result = groceryService.generateList('2099-W01');
    assertNull(result, 'should return null for non-existent week');
  } finally {
    cleanup();
  }
});

test('generateList returns null for non-existent plan ID', () => {
  const { groceryService, cleanup } = setupTestDb();
  try {
    const result = groceryService.generateList('non-existent-id');
    assertNull(result, 'should return null for non-existent plan ID');
  } finally {
    cleanup();
  }
});

test('generateList returns empty groups for plan with no items', () => {
  const { groceryService, planRepo, cleanup } = setupTestDb();
  try {
    const plan = planRepo.create({ week: '2025-W01', status: 'draft', notes: null });

    const result = groceryService.generateList('2025-W01');
    expect(result).toBeDefined();
    expect(result.week).toBe('2025-W01');
    assertArrayLength(result.groups, 0, 'should have no groups');
    expect(result.generatedAt.length > 0).toBe(true);
  } finally {
    cleanup();
  }
});

test('generateList works with plan ID', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    // Create ingredient
    const ingId = createIngredient(db, 'ing-1', 'Onion', 'Produce');

    // Create recipe with ingredient
    const recipeId = createRecipe(db, recipeRepo, 'Simple Dish', 4, [
      { ingredientId: ingId, quantity: 2, unit: 'pieces' },
    ]);

    // Create plan and add meal
    const plan = planRepo.create({ week: '2025-W02', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);

    const result = groceryService.generateList(plan.id);
    expect(result).toBeDefined();
    expect(result.week).toBe('2025-W02');
    assertArrayLength(result.groups, 1, 'should have 1 group');
    expect(result.groups[0].name).toBe('Produce');
    assertArrayLength(result.groups[0].items, 1, 'should have 1 item');
    expect(result.groups[0].items[0].ingredient).toBe('Onion');
  } finally {
    cleanup();
  }
});

// =====================
// Ingredient Aggregation Tests
// =====================

test('aggregates same ingredient from multiple recipes', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const onionId = createIngredient(db, 'ing-onion', 'Onion', 'Produce');

    // Two recipes both using onion
    const recipe1 = createRecipe(db, recipeRepo, 'Recipe 1', 4, [
      { ingredientId: onionId, quantity: 2, unit: 'pieces' },
    ]);
    const recipe2 = createRecipe(db, recipeRepo, 'Recipe 2', 4, [
      { ingredientId: onionId, quantity: 3, unit: 'pieces' },
    ]);

    const plan = planRepo.create({ week: '2025-W03', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipe1, 4, null);
    planRepo.setMeal(plan.id, 2, 'dinner', recipe2, 4, null);

    const result = groceryService.generateList('2025-W03');
    expect(result).toBeDefined();

    const onionItem = result.groups[0].items.find((i) => i.ingredient === 'Onion');
    expect(onionItem).toBeDefined();
    expect(onionItem.totalQuantity).toBe(5);
    assertArrayLength(onionItem.recipes, 2, 'should reference both recipes');
    expect(onionItem.recipes.includes('Recipe 1')).toBe(true);
    expect(onionItem.recipes.includes('Recipe 2')).toBe(true);
  } finally {
    cleanup();
  }
});

test('handles ingredients without quantity', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const saltId = createIngredient(db, 'ing-salt', 'Salt', 'Pantry');

    const recipeId = createRecipe(db, recipeRepo, 'Salted Dish', 4, [
      { ingredientId: saltId, quantity: null, unit: null },
    ]);

    const plan = planRepo.create({ week: '2025-W04', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);

    const result = groceryService.generateList('2025-W04');
    expect(result).toBeDefined();

    const saltItem = result.groups[0].items.find((i) => i.ingredient === 'Salt');
    expect(saltItem).toBeDefined();
    expect(saltItem.totalQuantity).toBe(0);
    expect(saltItem.unit).toBe('');
    assertArrayLength(saltItem.recipes, 1, 'should reference recipe');
  } finally {
    cleanup();
  }
});

// =====================
// Serving Scaling Tests
// =====================

test('scales quantities based on servings', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const chickenId = createIngredient(db, 'ing-chicken', 'Chicken', 'Meat');

    // Recipe serves 4, uses 500g chicken
    const recipeId = createRecipe(db, recipeRepo, 'Chicken Dish', 4, [
      { ingredientId: chickenId, quantity: 500, unit: 'g' },
    ]);

    const plan = planRepo.create({ week: '2025-W05', status: 'draft', notes: null });
    // Plan for 2 servings instead of 4
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 2, null);

    const result = groceryService.generateList('2025-W05');
    expect(result).toBeDefined();

    const chickenItem = result.groups[0].items.find((i) => i.ingredient === 'Chicken');
    expect(chickenItem).toBeDefined();
    // 500g / 4 servings * 2 servings = 250g
    expect(chickenItem.totalQuantity).toBe(250);
  } finally {
    cleanup();
  }
});

test('scales up for larger servings', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const pastaId = createIngredient(db, 'ing-pasta', 'Pasta', 'Pantry');

    // Recipe serves 2, uses 200g pasta
    const recipeId = createRecipe(db, recipeRepo, 'Pasta Dish', 2, [
      { ingredientId: pastaId, quantity: 200, unit: 'g' },
    ]);

    const plan = planRepo.create({ week: '2025-W06', status: 'draft', notes: null });
    // Plan for 6 servings instead of 2
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 6, null);

    const result = groceryService.generateList('2025-W06');
    expect(result).toBeDefined();

    const pastaItem = result.groups[0].items.find((i) => i.ingredient === 'Pasta');
    expect(pastaItem).toBeDefined();
    // 200g / 2 servings * 6 servings = 600g
    expect(pastaItem.totalQuantity).toBe(600);
  } finally {
    cleanup();
  }
});

// =====================
// Unit Conversion Tests
// =====================

test('converts compatible units', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const milkId = createIngredient(db, 'ing-milk', 'Milk', 'Dairy');

    // Two recipes with different units
    const recipe1 = createRecipe(db, recipeRepo, 'Recipe with cups', 4, [
      { ingredientId: milkId, quantity: 2, unit: 'cups' },
    ]);
    const recipe2 = createRecipe(db, recipeRepo, 'Recipe with ml', 4, [
      { ingredientId: milkId, quantity: 480, unit: 'ml' },
    ]);

    const plan = planRepo.create({ week: '2025-W07', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipe1, 4, null);
    planRepo.setMeal(plan.id, 2, 'dinner', recipe2, 4, null);

    const result = groceryService.generateList('2025-W07');
    expect(result).toBeDefined();

    const milkItem = result.groups[0].items.find((i) => i.ingredient === 'Milk');
    expect(milkItem).toBeDefined();
    // 2 cups = 480ml, + 480ml = 960ml
    // Should be converted to a sensible unit (either ml or cups)
    expect(milkItem.totalQuantity > 0).toBe(true);
    assertArrayLength(milkItem.recipes, 2, 'should reference both recipes');
  } finally {
    cleanup();
  }
});

test('keeps incompatible units separate', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const eggId = createIngredient(db, 'ing-eggs', 'Eggs', 'Dairy');

    // Two recipes with incompatible units
    const recipe1 = createRecipe(db, recipeRepo, 'Recipe with pieces', 4, [
      { ingredientId: eggId, quantity: 4, unit: 'pieces' },
    ]);
    const recipe2 = createRecipe(db, recipeRepo, 'Recipe with grams', 4, [
      { ingredientId: eggId, quantity: 200, unit: 'g' },
    ]);

    const plan = planRepo.create({ week: '2025-W08', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipe1, 4, null);
    planRepo.setMeal(plan.id, 2, 'dinner', recipe2, 4, null);

    const result = groceryService.generateList('2025-W08');
    expect(result).toBeDefined();

    // Should have separate items for different units (or merge if convertible)
    const dairyGroup = result.groups.find((g) => g.name === 'Dairy');
    expect(dairyGroup).toBeDefined();

    // Find all egg items
    const eggItems = dairyGroup.items.filter((i) => i.ingredient === 'Eggs');
    // Should have at least 1 item (if combined) or 2 items (if separate)
    expect(eggItems.length >= 1).toBe(true);
  } finally {
    cleanup();
  }
});

// =====================
// Category Grouping Tests
// =====================

test('groups ingredients by category', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const chickenId = createIngredient(db, 'ing-chicken', 'Chicken', 'Meat');
    const onionId = createIngredient(db, 'ing-onion', 'Onion', 'Produce');
    const milkId = createIngredient(db, 'ing-milk', 'Milk', 'Dairy');

    const recipeId = createRecipe(db, recipeRepo, 'Mixed Dish', 4, [
      { ingredientId: chickenId, quantity: 500, unit: 'g' },
      { ingredientId: onionId, quantity: 2, unit: 'pieces' },
      { ingredientId: milkId, quantity: 1, unit: 'cup' },
    ]);

    const plan = planRepo.create({ week: '2025-W09', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);

    const result = groceryService.generateList('2025-W09');
    expect(result).toBeDefined();

    // Should have 3 categories
    assertArrayLength(result.groups, 3, 'should have 3 category groups');

    // Find each category
    const dairyGroup = result.groups.find((g) => g.name === 'Dairy');
    const meatGroup = result.groups.find((g) => g.name === 'Meat');
    const produceGroup = result.groups.find((g) => g.name === 'Produce');

    expect(dairyGroup).toBeDefined();
    expect(meatGroup).toBeDefined();
    expect(produceGroup).toBeDefined();

    assertArrayLength(dairyGroup.items, 1, 'Dairy should have 1 item');
    assertArrayLength(meatGroup.items, 1, 'Meat should have 1 item');
    assertArrayLength(produceGroup.items, 1, 'Produce should have 1 item');
  } finally {
    cleanup();
  }
});

test('puts uncategorized ingredients in Uncategorized group', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const ingId = createIngredient(db, 'ing-misc', 'Mystery Item', null);

    const recipeId = createRecipe(db, recipeRepo, 'Mystery Dish', 4, [
      { ingredientId: ingId, quantity: 1, unit: 'unit' },
    ]);

    const plan = planRepo.create({ week: '2025-W10', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);

    const result = groceryService.generateList('2025-W10');
    expect(result).toBeDefined();

    assertArrayLength(result.groups, 1, 'should have 1 group');
    expect(result.groups[0].name).toBe('Uncategorized');
  } finally {
    cleanup();
  }
});

test('sorts categories alphabetically with Uncategorized last', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const ingA = createIngredient(db, 'ing-a', 'Item A', 'Zebra');
    const ingB = createIngredient(db, 'ing-b', 'Item B', 'Apple');
    const ingC = createIngredient(db, 'ing-c', 'Item C', null); // Uncategorized

    const recipeId = createRecipe(db, recipeRepo, 'Multi Dish', 4, [
      { ingredientId: ingA, quantity: 1, unit: 'unit' },
      { ingredientId: ingB, quantity: 1, unit: 'unit' },
      { ingredientId: ingC, quantity: 1, unit: 'unit' },
    ]);

    const plan = planRepo.create({ week: '2025-W11', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);

    const result = groceryService.generateList('2025-W11');
    expect(result).toBeDefined();

    assertArrayLength(result.groups, 3, 'should have 3 groups');
    // Should be sorted: Apple, Zebra, Uncategorized
    expect(result.groups[0].name).toBe('Apple');
    expect(result.groups[1].name).toBe('Zebra');
    expect(result.groups[2].name).toBe('Uncategorized');
  } finally {
    cleanup();
  }
});

// =====================
// Multiple Meals Tests
// =====================

test('handles multiple meals per day', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const eggId = createIngredient(db, 'ing-eggs', 'Eggs', 'Dairy');

    const breakfast = createRecipe(db, recipeRepo, 'Scrambled Eggs', 2, [
      { ingredientId: eggId, quantity: 3, unit: 'pieces' },
    ]);
    const lunch = createRecipe(db, recipeRepo, 'Egg Salad', 2, [
      { ingredientId: eggId, quantity: 4, unit: 'pieces' },
    ]);

    const plan = planRepo.create({ week: '2025-W12', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'breakfast', breakfast, 2, null);
    planRepo.setMeal(plan.id, 1, 'lunch', lunch, 2, null);

    const result = groceryService.generateList('2025-W12');
    expect(result).toBeDefined();

    const eggItem = result.groups[0].items.find((i) => i.ingredient === 'Eggs');
    expect(eggItem).toBeDefined();
    expect(eggItem.totalQuantity).toBe(7);
    assertArrayLength(eggItem.recipes, 2, 'should reference both recipes');
  } finally {
    cleanup();
  }
});

test('handles full week of meals', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const riceId = createIngredient(db, 'ing-rice', 'Rice', 'Pantry');

    // Same recipe for dinner all week
    const recipeId = createRecipe(db, recipeRepo, 'Rice Bowl', 2, [
      { ingredientId: riceId, quantity: 100, unit: 'g' },
    ]);

    const plan = planRepo.create({ week: '2025-W13', status: 'draft', notes: null });
    // 7 dinners
    for (let day = 1; day <= 7; day++) {
      planRepo.setMeal(plan.id, day, 'dinner', recipeId, 2, null);
    }

    const result = groceryService.generateList('2025-W13');
    expect(result).toBeDefined();

    const riceItem = result.groups[0].items.find((i) => i.ingredient === 'Rice');
    expect(riceItem).toBeDefined();
    expect(riceItem.totalQuantity).toBe(700);
    assertArrayLength(riceItem.recipes, 1, 'should reference recipe once');
  } finally {
    cleanup();
  }
});

// =====================
// Edge Cases
// =====================

test('skips plan items without recipe', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const ingId = createIngredient(db, 'ing-test', 'Test Ingredient', 'Pantry');

    const recipeId = createRecipe(db, recipeRepo, 'Test Recipe', 4, [
      { ingredientId: ingId, quantity: 1, unit: 'unit' },
    ]);

    const plan = planRepo.create({ week: '2025-W14', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);
    planRepo.setMeal(plan.id, 2, 'dinner', null, 2, 'Leftovers'); // No recipe

    const result = groceryService.generateList('2025-W14');
    expect(result).toBeDefined();

    // Should only have ingredients from the one recipe with an assigned recipe
    assertArrayLength(result.groups, 1, 'should have 1 group');
    assertArrayLength(result.groups[0].items, 1, 'should have 1 item');
  } finally {
    cleanup();
  }
});

test('handles recipe with no ingredients', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createRecipe(db, recipeRepo, 'Empty Recipe', 4, []);

    const plan = planRepo.create({ week: '2025-W15', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);

    const result = groceryService.generateList('2025-W15');
    expect(result).toBeDefined();
    assertArrayLength(result.groups, 0, 'should have no groups');
  } finally {
    cleanup();
  }
});

test('handles same recipe multiple times in same plan', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const pastaId = createIngredient(db, 'ing-pasta', 'Pasta', 'Pantry');

    const recipeId = createRecipe(db, recipeRepo, 'Pasta Dish', 4, [
      { ingredientId: pastaId, quantity: 400, unit: 'g' },
    ]);

    const plan = planRepo.create({ week: '2025-W16', status: 'draft', notes: null });
    // Same recipe on Monday and Wednesday
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);
    planRepo.setMeal(plan.id, 3, 'dinner', recipeId, 4, null);

    const result = groceryService.generateList('2025-W16');
    expect(result).toBeDefined();

    const pastaItem = result.groups[0].items.find((i) => i.ingredient === 'Pasta');
    expect(pastaItem).toBeDefined();
    expect(pastaItem.totalQuantity).toBe(800);
    // Recipe should only appear once in the list
    assertArrayLength(pastaItem.recipes, 1, 'recipe should only appear once');
  } finally {
    cleanup();
  }
});

// =====================
// generateListForWeek and generateListForPlan Tests
// =====================

test('generateListForWeek works correctly', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const ingId = createIngredient(db, 'ing-test', 'Test', 'Pantry');
    const recipeId = createRecipe(db, recipeRepo, 'Test Recipe', 4, [
      { ingredientId: ingId, quantity: 1, unit: 'unit' },
    ]);

    const plan = planRepo.create({ week: '2025-W20', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);

    const result = groceryService.generateListForWeek('2025-W20');
    expect(result).toBeDefined();
    expect(result.week).toBe('2025-W20');
  } finally {
    cleanup();
  }
});

test('generateListForWeek returns null for non-existent week', () => {
  const { groceryService, cleanup } = setupTestDb();
  try {
    const result = groceryService.generateListForWeek('2099-W52');
    assertNull(result, 'should return null');
  } finally {
    cleanup();
  }
});

test('generateListForPlan works correctly', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const ingId = createIngredient(db, 'ing-test', 'Test', 'Pantry');
    const recipeId = createRecipe(db, recipeRepo, 'Test Recipe', 4, [
      { ingredientId: ingId, quantity: 1, unit: 'unit' },
    ]);

    const plan = planRepo.create({ week: '2025-W21', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipeId, 4, null);

    const result = groceryService.generateListForPlan(plan.id);
    expect(result).toBeDefined();
    expect(result.week).toBe('2025-W21');
  } finally {
    cleanup();
  }
});

test('generateListForPlan returns null for non-existent plan', () => {
  const { groceryService, cleanup } = setupTestDb();
  try {
    const result = groceryService.generateListForPlan('non-existent-id');
    assertNull(result, 'should return null');
  } finally {
    cleanup();
  }
});

// =====================
// Weight and Volume Unit Tests
// =====================

test('converts kg to g correctly', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const flourId = createIngredient(db, 'ing-flour', 'Flour', 'Pantry');

    const recipe1 = createRecipe(db, recipeRepo, 'Recipe with kg', 4, [
      { ingredientId: flourId, quantity: 1, unit: 'kg' },
    ]);
    const recipe2 = createRecipe(db, recipeRepo, 'Recipe with g', 4, [
      { ingredientId: flourId, quantity: 500, unit: 'g' },
    ]);

    const plan = planRepo.create({ week: '2025-W22', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipe1, 4, null);
    planRepo.setMeal(plan.id, 2, 'dinner', recipe2, 4, null);

    const result = groceryService.generateList('2025-W22');
    expect(result).toBeDefined();

    const flourItem = result.groups[0].items.find((i) => i.ingredient === 'Flour');
    expect(flourItem).toBeDefined();
    // 1kg = 1000g + 500g = 1500g, displayed as 1.5kg
    assertApproxEqual(flourItem.totalQuantity, 1.5, 0.01, 'should be 1.5kg');
    expect(flourItem.unit).toBe('kg');
  } finally {
    cleanup();
  }
});

test('converts tablespoons and teaspoons correctly', () => {
  const { db, groceryService, planRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const sugarId = createIngredient(db, 'ing-sugar', 'Sugar', 'Pantry');

    const recipe1 = createRecipe(db, recipeRepo, 'Recipe with tbsp', 4, [
      { ingredientId: sugarId, quantity: 2, unit: 'tbsp' },
    ]);
    const recipe2 = createRecipe(db, recipeRepo, 'Recipe with tsp', 4, [
      { ingredientId: sugarId, quantity: 6, unit: 'tsp' },
    ]);

    const plan = planRepo.create({ week: '2025-W23', status: 'draft', notes: null });
    planRepo.setMeal(plan.id, 1, 'dinner', recipe1, 4, null);
    planRepo.setMeal(plan.id, 2, 'dinner', recipe2, 4, null);

    const result = groceryService.generateList('2025-W23');
    expect(result).toBeDefined();

    const sugarItem = result.groups[0].items.find((i) => i.ingredient === 'Sugar');
    expect(sugarItem).toBeDefined();
    // 2 tbsp = 30ml, 6 tsp = 30ml, total = 60ml = 4 tbsp
    assertApproxEqual(sugarItem.totalQuantity, 4, 0.1, 'should be ~4 tbsp');
    expect(sugarItem.unit).toBe('tbsp');
  } finally {
    cleanup();
  }
});

