/**
 * Integration tests for PlanRepository
 *
 * Tests all CRUD operations against an in-memory SQLite database.
 */

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { PlanRepository } from '../src/repos/plan.repo.js';
import type { Database } from 'better-sqlite3';

// Test utilities
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
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertNotNull<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${message}: expected non-null value`);
  }
}

// Database setup helper
function setupTestDb(): { db: Database; repo: PlanRepository; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const repo = new PlanRepository(db);

  return {
    db,
    repo,
    cleanup: () => closeDb(db),
  };
}

// Helper to create test recipe (needed for plan items with recipe references)
function createTestRecipe(db: Database, title: string): string {
  const id = `recipe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  db.prepare(
    'INSERT INTO recipes (id, title, instructions, servings) VALUES (?, ?, ?, ?)'
  ).run(id, title, 'Test instructions', 4);
  return id;
}

// ============================================
// Weekly Plan Tests
// ============================================

test('can create a weekly plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({
      week: '2025-W02',
      notes: null,
    });

    assertNotNull(plan, 'plan should be created');
    assertEqual(plan.week, '2025-W02', 'week should match');
    assertEqual(plan.status, 'draft', 'default status should be draft');
    assertEqual(plan.notes, null, 'notes should be null');
    assert(plan.id.length > 0, 'id should be generated');
    assert(plan.createdAt.length > 0, 'createdAt should be set');
    assert(plan.updatedAt.length > 0, 'updatedAt should be set');
    assert(Array.isArray(plan.items), 'items should be an array');
    assertEqual(plan.items?.length, 0, 'items should be empty initially');
  } finally {
    cleanup();
  }
});

test('can create a weekly plan with custom status and notes', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({
      week: '2025-W03',
      status: 'active',
      notes: 'Vacation week',
    });

    assertEqual(plan.week, '2025-W03', 'week should match');
    assertEqual(plan.status, 'active', 'status should be active');
    assertEqual(plan.notes, 'Vacation week', 'notes should match');
  } finally {
    cleanup();
  }
});

test('can get plan by ID', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      week: '2025-W04',
      notes: null,
    });

    const fetched = repo.getById(created.id);

    assertNotNull(fetched, 'should find plan');
    assertEqual(fetched.id, created.id, 'id should match');
    assertEqual(fetched.week, '2025-W04', 'week should match');
  } finally {
    cleanup();
  }
});

test('getById returns null for non-existent plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getById('non-existent-id');
    assertEqual(result, null, 'should return null for non-existent plan');
  } finally {
    cleanup();
  }
});

test('can get plan by week', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      week: '2025-W05',
      notes: 'Test notes',
    });

    const fetched = repo.getByWeek('2025-W05');

    assertNotNull(fetched, 'should find plan by week');
    assertEqual(fetched.id, created.id, 'id should match');
    assertEqual(fetched.notes, 'Test notes', 'notes should match');
  } finally {
    cleanup();
  }
});

test('getByWeek returns null for non-existent week', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getByWeek('2099-W99');
    assertEqual(result, null, 'should return null for non-existent week');
  } finally {
    cleanup();
  }
});

test('can list all plans', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({ week: '2025-W01', notes: null });
    repo.create({ week: '2025-W02', notes: null });
    repo.create({ week: '2025-W03', notes: null });

    const plans = repo.list();

    assertEqual(plans.length, 3, 'should have 3 plans');
  } finally {
    cleanup();
  }
});

test('list returns plans ordered by week descending', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({ week: '2025-W01', notes: null });
    repo.create({ week: '2025-W03', notes: null });
    repo.create({ week: '2025-W02', notes: null });

    const plans = repo.list();

    assertEqual(plans[0].week, '2025-W03', 'first should be newest week');
    assertEqual(plans[1].week, '2025-W02', 'second should be middle week');
    assertEqual(plans[2].week, '2025-W01', 'third should be oldest week');
  } finally {
    cleanup();
  }
});

test('can list plans with limit and offset', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    for (let i = 1; i <= 5; i++) {
      repo.create({ week: `2025-W0${i}`, notes: null });
    }

    const page1 = repo.list({ limit: 2 });
    assertEqual(page1.length, 2, 'first page should have 2 plans');

    const page2 = repo.list({ limit: 2, offset: 2 });
    assertEqual(page2.length, 2, 'second page should have 2 plans');

    const page3 = repo.list({ limit: 2, offset: 4 });
    assertEqual(page3.length, 1, 'third page should have 1 plan');
  } finally {
    cleanup();
  }
});

test('can list plans filtered by status', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({ week: '2025-W01', status: 'draft', notes: null });
    repo.create({ week: '2025-W02', status: 'active', notes: null });
    repo.create({ week: '2025-W03', status: 'completed', notes: null });
    repo.create({ week: '2025-W04', status: 'draft', notes: null });

    const drafts = repo.list({ status: 'draft' });
    assertEqual(drafts.length, 2, 'should have 2 draft plans');

    const active = repo.list({ status: 'active' });
    assertEqual(active.length, 1, 'should have 1 active plan');

    const completed = repo.list({ status: 'completed' });
    assertEqual(completed.length, 1, 'should have 1 completed plan');
  } finally {
    cleanup();
  }
});

test('can update plan fields', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      week: '2025-W06',
      status: 'draft',
      notes: 'Original notes',
    });

    // Set a known older timestamp to verify update changes it
    const oldTimestamp = '2020-01-01T00:00:00.000Z';
    db.prepare('UPDATE weekly_plans SET updated_at = ? WHERE id = ?').run(
      oldTimestamp,
      created.id
    );

    const updated = repo.update({
      id: created.id,
      notes: 'Updated notes',
      status: 'active',
    });

    assertNotNull(updated, 'should return updated plan');
    assertEqual(updated.notes, 'Updated notes', 'notes should be updated');
    assertEqual(updated.status, 'active', 'status should be updated');
    assertEqual(updated.week, '2025-W06', 'week should be preserved');
    assert(updated.updatedAt !== oldTimestamp, 'updatedAt should change');
  } finally {
    cleanup();
  }
});

test('update returns null for non-existent plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.update({ id: 'non-existent-id', notes: 'New notes' });
    assertEqual(result, null, 'should return null for non-existent plan');
  } finally {
    cleanup();
  }
});

test('can delete plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      week: '2025-W07',
      notes: null,
    });

    const deleted = repo.delete(created.id);
    assertEqual(deleted, true, 'delete should return true');

    const fetched = repo.getById(created.id);
    assertEqual(fetched, null, 'deleted plan should not be found');
  } finally {
    cleanup();
  }
});

test('delete returns false for non-existent plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.delete('non-existent-id');
    assertEqual(result, false, 'delete should return false for non-existent plan');
  } finally {
    cleanup();
  }
});

test('can set plan status', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      week: '2025-W08',
      notes: null,
    });

    assertEqual(created.status, 'draft', 'should start as draft');

    const updated = repo.setStatus(created.id, 'active');
    assertNotNull(updated, 'setStatus should return plan');
    assertEqual(updated.status, 'active', 'status should be active');

    const completed = repo.setStatus(created.id, 'completed');
    assertNotNull(completed, 'setStatus should return plan');
    assertEqual(completed.status, 'completed', 'status should be completed');
  } finally {
    cleanup();
  }
});

test('exists returns true for existing plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      week: '2025-W09',
      notes: null,
    });

    assertEqual(repo.exists(created.id), true, 'should return true for existing plan');
  } finally {
    cleanup();
  }
});

test('exists returns false for non-existent plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    assertEqual(
      repo.exists('non-existent-id'),
      false,
      'should return false for non-existent plan'
    );
  } finally {
    cleanup();
  }
});

test('count returns correct number', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    assertEqual(repo.count(), 0, 'should start with 0 plans');

    repo.create({ week: '2025-W10', notes: null });
    repo.create({ week: '2025-W11', notes: null });

    assertEqual(repo.count(), 2, 'should have 2 plans');
  } finally {
    cleanup();
  }
});

test('count with status filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({ week: '2025-W12', status: 'draft', notes: null });
    repo.create({ week: '2025-W13', status: 'active', notes: null });
    repo.create({ week: '2025-W14', status: 'draft', notes: null });

    assertEqual(repo.count(), 3, 'total count');
    assertEqual(repo.count({ status: 'draft' }), 2, 'draft count');
    assertEqual(repo.count({ status: 'active' }), 1, 'active count');
    assertEqual(repo.count({ status: 'completed' }), 0, 'completed count');
  } finally {
    cleanup();
  }
});

// ============================================
// Plan Item Tests
// ============================================

test('can set a meal', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W15', notes: null });

    const meal = repo.setMeal(plan.id, 1, 'breakfast', recipeId, 2, 'Start the week right');

    assertNotNull(meal, 'meal should be created');
    assertEqual(meal.planId, plan.id, 'planId should match');
    assertEqual(meal.dayOfWeek, 1, 'dayOfWeek should be 1 (Monday)');
    assertEqual(meal.mealType, 'breakfast', 'mealType should be breakfast');
    assertEqual(meal.recipeId, recipeId, 'recipeId should match');
    assertEqual(meal.servings, 2, 'servings should be 2');
    assertEqual(meal.notes, 'Start the week right', 'notes should match');
    assert(meal.id.length > 0, 'id should be generated');
  } finally {
    cleanup();
  }
});

test('can set a meal without recipe (null recipeId)', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W16', notes: null });

    const meal = repo.setMeal(plan.id, 3, 'lunch', null, 1, 'Leftovers');

    assertNotNull(meal, 'meal should be created');
    assertEqual(meal.recipeId, null, 'recipeId should be null');
    assertEqual(meal.servings, 1, 'servings should be 1');
    assertEqual(meal.notes, 'Leftovers', 'notes should match');
  } finally {
    cleanup();
  }
});

test('setMeal uses default servings when not specified', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W17', notes: null });

    const meal = repo.setMeal(plan.id, 5, 'dinner', null);

    assertEqual(meal.servings, 2, 'servings should default to 2');
  } finally {
    cleanup();
  }
});

test('setMeal updates existing meal at same slot (upsert behavior)', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe1 = createTestRecipe(db, 'Recipe 1');
    const recipe2 = createTestRecipe(db, 'Recipe 2');
    const plan = repo.create({ week: '2025-W18', notes: null });

    // Set initial meal
    const initial = repo.setMeal(plan.id, 1, 'dinner', recipe1, 4, 'Original');
    const initialId = initial.id;

    // Update same slot with different recipe
    const updated = repo.setMeal(plan.id, 1, 'dinner', recipe2, 6, 'Updated');

    assertEqual(updated.id, initialId, 'should preserve the same ID');
    assertEqual(updated.recipeId, recipe2, 'recipeId should be updated');
    assertEqual(updated.servings, 6, 'servings should be updated');
    assertEqual(updated.notes, 'Updated', 'notes should be updated');

    // Verify only one item exists
    const meals = repo.getMeals(plan.id);
    assertEqual(meals.length, 1, 'should still have only one meal');
  } finally {
    cleanup();
  }
});

test('can remove a meal', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W19', notes: null });

    repo.setMeal(plan.id, 2, 'lunch', recipeId);

    const removed = repo.removeMeal(plan.id, 2, 'lunch');
    assertEqual(removed, true, 'removeMeal should return true');

    const meal = repo.getMealBySlot(plan.id, 2, 'lunch');
    assertEqual(meal, null, 'meal should be removed');
  } finally {
    cleanup();
  }
});

test('removeMeal returns false for non-existent meal', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W20', notes: null });

    const result = repo.removeMeal(plan.id, 7, 'dinner');
    assertEqual(result, false, 'removeMeal should return false for non-existent meal');
  } finally {
    cleanup();
  }
});

test('can get all meals for a plan', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W21', notes: null });

    repo.setMeal(plan.id, 1, 'breakfast', recipe);
    repo.setMeal(plan.id, 1, 'lunch', recipe);
    repo.setMeal(plan.id, 1, 'dinner', recipe);
    repo.setMeal(plan.id, 2, 'breakfast', recipe);

    const meals = repo.getMeals(plan.id);

    assertEqual(meals.length, 4, 'should have 4 meals');
  } finally {
    cleanup();
  }
});

test('getMeals returns meals in correct order (day, then meal type)', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W22', notes: null });

    // Add meals in random order
    repo.setMeal(plan.id, 2, 'dinner', recipe);
    repo.setMeal(plan.id, 1, 'lunch', recipe);
    repo.setMeal(plan.id, 2, 'breakfast', recipe);
    repo.setMeal(plan.id, 1, 'breakfast', recipe);

    const meals = repo.getMeals(plan.id);

    assertEqual(meals[0].dayOfWeek, 1, 'first meal day');
    assertEqual(meals[0].mealType, 'breakfast', 'first meal type');
    assertEqual(meals[1].dayOfWeek, 1, 'second meal day');
    assertEqual(meals[1].mealType, 'lunch', 'second meal type');
    assertEqual(meals[2].dayOfWeek, 2, 'third meal day');
    assertEqual(meals[2].mealType, 'breakfast', 'third meal type');
    assertEqual(meals[3].dayOfWeek, 2, 'fourth meal day');
    assertEqual(meals[3].mealType, 'dinner', 'fourth meal type');
  } finally {
    cleanup();
  }
});

test('getMeals returns empty array for plan with no meals', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W23', notes: null });

    const meals = repo.getMeals(plan.id);

    assertEqual(meals.length, 0, 'should return empty array');
  } finally {
    cleanup();
  }
});

test('can get meal by slot', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W24', notes: null });

    repo.setMeal(plan.id, 3, 'dinner', recipe, 4, 'Special dinner');

    const meal = repo.getMealBySlot(plan.id, 3, 'dinner');

    assertNotNull(meal, 'should find meal');
    assertEqual(meal.dayOfWeek, 3, 'dayOfWeek should match');
    assertEqual(meal.mealType, 'dinner', 'mealType should match');
    assertEqual(meal.notes, 'Special dinner', 'notes should match');
  } finally {
    cleanup();
  }
});

test('getMealBySlot returns null for empty slot', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W25', notes: null });

    const meal = repo.getMealBySlot(plan.id, 5, 'lunch');

    assertEqual(meal, null, 'should return null for empty slot');
  } finally {
    cleanup();
  }
});

test('can get meal by ID', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W26', notes: null });

    const created = repo.setMeal(plan.id, 6, 'breakfast', recipe);

    const fetched = repo.getMealById(created.id);

    assertNotNull(fetched, 'should find meal by ID');
    assertEqual(fetched.id, created.id, 'id should match');
    assertEqual(fetched.dayOfWeek, 6, 'dayOfWeek should match');
  } finally {
    cleanup();
  }
});

test('getMealById returns null for non-existent meal', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const meal = repo.getMealById('non-existent-id');
    assertEqual(meal, null, 'should return null for non-existent meal');
  } finally {
    cleanup();
  }
});

test('delete plan cascades to plan items', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W27', notes: null });

    repo.setMeal(plan.id, 1, 'breakfast', recipe);
    repo.setMeal(plan.id, 1, 'lunch', recipe);
    repo.setMeal(plan.id, 1, 'dinner', recipe);

    // Verify items exist
    const beforeDelete = db
      .prepare('SELECT COUNT(*) as count FROM plan_items WHERE plan_id = ?')
      .get(plan.id) as { count: number };
    assertEqual(beforeDelete.count, 3, 'should have 3 plan items before delete');

    repo.delete(plan.id);

    // Verify items were deleted
    const afterDelete = db
      .prepare('SELECT COUNT(*) as count FROM plan_items WHERE plan_id = ?')
      .get(plan.id) as { count: number };
    assertEqual(afterDelete.count, 0, 'plan items should be deleted via cascade');
  } finally {
    cleanup();
  }
});

test('getById includes items', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W28', notes: null });

    repo.setMeal(plan.id, 1, 'breakfast', recipe);
    repo.setMeal(plan.id, 1, 'dinner', recipe);

    const fetched = repo.getById(plan.id);

    assertNotNull(fetched, 'should find plan');
    assertNotNull(fetched.items, 'items should be included');
    assertEqual(fetched.items.length, 2, 'should have 2 items');
  } finally {
    cleanup();
  }
});

test('getByWeek includes items', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe = createTestRecipe(db, 'Test Recipe');
    const plan = repo.create({ week: '2025-W29', notes: null });

    repo.setMeal(plan.id, 7, 'lunch', recipe);

    const fetched = repo.getByWeek('2025-W29');

    assertNotNull(fetched, 'should find plan');
    assertNotNull(fetched.items, 'items should be included');
    assertEqual(fetched.items.length, 1, 'should have 1 item');
  } finally {
    cleanup();
  }
});

test('list includes items for each plan', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const recipe = createTestRecipe(db, 'Test Recipe');

    const plan1 = repo.create({ week: '2025-W30', notes: null });
    repo.setMeal(plan1.id, 1, 'breakfast', recipe);

    const plan2 = repo.create({ week: '2025-W31', notes: null });
    repo.setMeal(plan2.id, 1, 'breakfast', recipe);
    repo.setMeal(plan2.id, 1, 'lunch', recipe);

    const plans = repo.list();

    assertEqual(plans.length, 2, 'should have 2 plans');

    const fetchedPlan1 = plans.find((p) => p.id === plan1.id);
    const fetchedPlan2 = plans.find((p) => p.id === plan2.id);

    assertNotNull(fetchedPlan1, 'should find plan1');
    assertNotNull(fetchedPlan2, 'should find plan2');
    assertEqual(fetchedPlan1.items?.length, 1, 'plan1 should have 1 item');
    assertEqual(fetchedPlan2.items?.length, 2, 'plan2 should have 2 items');
  } finally {
    cleanup();
  }
});

// Run all tests
console.log('Running PlanRepository integration tests...');
console.log('');
runTests();
