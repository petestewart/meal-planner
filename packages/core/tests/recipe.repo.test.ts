/**
 * Integration tests for RecipeRepository
 *
 * Tests all CRUD operations against an in-memory SQLite database.
 */

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { RecipeRepository } from '../src/repos/recipe.repo.js';
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

function assertNotNull<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${message}: expected non-null value`);
  }
}

// Database setup helper
function setupTestDb(): { db: Database; repo: RecipeRepository; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const repo = new RecipeRepository(db);

  return {
    db,
    repo,
    cleanup: () => closeDb(db),
  };
}

// Helper to create test ingredients
function createTestIngredient(db: Database, name: string, category?: string): string {
  const id = `ing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  db.prepare(
    'INSERT INTO ingredients (id, name, category, default_unit) VALUES (?, ?, ?, ?)'
  ).run(id, name, category ?? null, null);
  return id;
}

// Helper to create test tags
function createTestTag(db: Database, name: string, category?: string): string {
  const id = `tag-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  db.prepare('INSERT INTO tags (id, name, category) VALUES (?, ?, ?)').run(
    id,
    name,
    category ?? null
  );
  return id;
}

// Tests

test('can create a simple recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const recipe = repo.create({
      title: 'Test Recipe',
      instructions: 'Mix ingredients and cook.',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    assertNotNull(recipe, 'recipe should be created');
    assertEqual(recipe.title, 'Test Recipe', 'title should match');
    assertEqual(recipe.instructions, 'Mix ingredients and cook.', 'instructions should match');
    assertEqual(recipe.servings, 4, 'servings should match');
    assert(recipe.id.length > 0, 'id should be generated');
    assert(recipe.createdAt.length > 0, 'createdAt should be set');
    assert(recipe.updatedAt.length > 0, 'updatedAt should be set');
  } finally {
    cleanup();
  }
});

test('can create recipe with all fields', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const recipe = repo.create({
      title: 'Full Recipe',
      description: 'A complete recipe with all fields',
      instructions: 'Step 1. Step 2. Step 3.',
      servings: 6,
      prepTimeMinutes: 15,
      cookTimeMinutes: 30,
      sourceUrl: 'https://example.com/recipe',
      sourceType: 'imported',
      cuisine: 'Italian',
      difficulty: 'medium',
    });

    assertEqual(recipe.title, 'Full Recipe', 'title');
    assertEqual(recipe.description, 'A complete recipe with all fields', 'description');
    assertEqual(recipe.servings, 6, 'servings');
    assertEqual(recipe.prepTimeMinutes, 15, 'prepTimeMinutes');
    assertEqual(recipe.cookTimeMinutes, 30, 'cookTimeMinutes');
    assertEqual(recipe.sourceUrl, 'https://example.com/recipe', 'sourceUrl');
    assertEqual(recipe.sourceType, 'imported', 'sourceType');
    assertEqual(recipe.cuisine, 'Italian', 'cuisine');
    assertEqual(recipe.difficulty, 'medium', 'difficulty');
  } finally {
    cleanup();
  }
});

test('can create recipe with ingredients', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const ingredientId1 = createTestIngredient(db, 'Flour', 'baking');
    const ingredientId2 = createTestIngredient(db, 'Sugar', 'baking');

    const recipe = repo.create(
      {
        title: 'Recipe with Ingredients',
        instructions: 'Mix and bake.',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      [
        { ingredientId: ingredientId1, quantity: 2, unit: 'cups', notes: null, optional: false },
        { ingredientId: ingredientId2, quantity: 1, unit: 'cup', notes: 'optional', optional: true },
      ]
    );

    assertNotNull(recipe.ingredients, 'ingredients should be set');
    assertEqual(recipe.ingredients.length, 2, 'should have 2 ingredients');

    const flour = recipe.ingredients.find((i) => i.ingredientId === ingredientId1);
    assertNotNull(flour, 'should have flour ingredient');
    assertEqual(flour.quantity, 2, 'flour quantity');
    assertEqual(flour.unit, 'cups', 'flour unit');
    assertEqual(flour.optional, false, 'flour optional');

    const sugar = recipe.ingredients.find((i) => i.ingredientId === ingredientId2);
    assertNotNull(sugar, 'should have sugar ingredient');
    assertEqual(sugar.optional, true, 'sugar optional');
  } finally {
    cleanup();
  }
});

test('can create recipe with tags', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const tagId1 = createTestTag(db, 'Dinner', 'meal_type');
    const tagId2 = createTestTag(db, 'Vegetarian', 'dietary');

    const recipe = repo.create(
      {
        title: 'Recipe with Tags',
        instructions: 'Cook it.',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      undefined,
      [tagId1, tagId2]
    );

    assertNotNull(recipe.tagIds, 'tagIds should be set');
    assertEqual(recipe.tagIds.length, 2, 'should have 2 tags');
    assert(recipe.tagIds.includes(tagId1), 'should include dinner tag');
    assert(recipe.tagIds.includes(tagId2), 'should include vegetarian tag');
  } finally {
    cleanup();
  }
});

test('can get recipe by ID', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      title: 'Get Test Recipe',
      instructions: 'Test instructions.',
      servings: 2,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const fetched = repo.getById(created.id);

    assertNotNull(fetched, 'should find recipe');
    assertEqual(fetched.id, created.id, 'id should match');
    assertEqual(fetched.title, 'Get Test Recipe', 'title should match');
  } finally {
    cleanup();
  }
});

test('getById returns null for non-existent recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getById('non-existent-id');
    assertEqual(result, null, 'should return null for non-existent recipe');
  } finally {
    cleanup();
  }
});

test('can list all recipes', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Recipe 1',
      instructions: 'Instructions 1',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });
    repo.create({
      title: 'Recipe 2',
      instructions: 'Instructions 2',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });
    repo.create({
      title: 'Recipe 3',
      instructions: 'Instructions 3',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const recipes = repo.list();

    assertEqual(recipes.length, 3, 'should have 3 recipes');
  } finally {
    cleanup();
  }
});

test('can list recipes with limit and offset', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    // Create 5 recipes
    for (let i = 1; i <= 5; i++) {
      repo.create({
        title: `Recipe ${i}`,
        instructions: `Instructions ${i}`,
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });
    }

    const page1 = repo.list({ limit: 2 });
    assertEqual(page1.length, 2, 'first page should have 2 recipes');

    const page2 = repo.list({ limit: 2, offset: 2 });
    assertEqual(page2.length, 2, 'second page should have 2 recipes');

    const page3 = repo.list({ limit: 2, offset: 4 });
    assertEqual(page3.length, 1, 'third page should have 1 recipe');
  } finally {
    cleanup();
  }
});

test('can list recipes filtered by cuisine', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Italian Pasta',
      instructions: 'Cook pasta',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: 'Italian',
      difficulty: null,
    });
    repo.create({
      title: 'Mexican Tacos',
      instructions: 'Make tacos',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: 'Mexican',
      difficulty: null,
    });

    const italian = repo.list({ cuisine: 'Italian' });
    assertEqual(italian.length, 1, 'should have 1 Italian recipe');
    assertEqual(italian[0].title, 'Italian Pasta', 'should be Italian Pasta');

    const mexican = repo.list({ cuisine: 'Mexican' });
    assertEqual(mexican.length, 1, 'should have 1 Mexican recipe');
  } finally {
    cleanup();
  }
});

test('can list recipes filtered by difficulty', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Easy Recipe',
      instructions: 'Simple steps',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: 'easy',
    });
    repo.create({
      title: 'Hard Recipe',
      instructions: 'Complex steps',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: 'hard',
    });

    const easy = repo.list({ difficulty: 'easy' });
    assertEqual(easy.length, 1, 'should have 1 easy recipe');
    assertEqual(easy[0].title, 'Easy Recipe', 'should be Easy Recipe');
  } finally {
    cleanup();
  }
});

test('can list recipes filtered by tags', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const dinnerTag = createTestTag(db, 'Dinner', 'meal_type');
    const veganTag = createTestTag(db, 'Vegan', 'dietary');
    const lunchTag = createTestTag(db, 'Lunch', 'meal_type');

    repo.create(
      {
        title: 'Vegan Dinner',
        instructions: 'Cook vegan',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      undefined,
      [dinnerTag, veganTag]
    );
    repo.create(
      {
        title: 'Regular Dinner',
        instructions: 'Cook regular',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      undefined,
      [dinnerTag]
    );
    repo.create(
      {
        title: 'Vegan Lunch',
        instructions: 'Make vegan lunch',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      undefined,
      [lunchTag, veganTag]
    );

    const dinners = repo.list({ tagIds: [dinnerTag] });
    assertEqual(dinners.length, 2, 'should have 2 dinner recipes');

    const veganDinners = repo.list({ tagIds: [dinnerTag, veganTag] });
    assertEqual(veganDinners.length, 1, 'should have 1 vegan dinner');
    assertEqual(veganDinners[0].title, 'Vegan Dinner', 'should be Vegan Dinner');
  } finally {
    cleanup();
  }
});

test('can update recipe fields', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      title: 'Original Title',
      instructions: 'Original instructions',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    // Set a known older timestamp to verify update changes it
    const oldTimestamp = '2020-01-01T00:00:00.000Z';
    db.prepare('UPDATE recipes SET updated_at = ? WHERE id = ?').run(oldTimestamp, created.id);

    const updated = repo.update({
      id: created.id,
      title: 'Updated Title',
      servings: 6,
      cuisine: 'Thai',
    });

    assertNotNull(updated, 'should return updated recipe');
    assertEqual(updated.title, 'Updated Title', 'title should be updated');
    assertEqual(updated.servings, 6, 'servings should be updated');
    assertEqual(updated.cuisine, 'Thai', 'cuisine should be updated');
    assertEqual(updated.instructions, 'Original instructions', 'instructions should be preserved');
    assert(updated.updatedAt !== oldTimestamp, 'updatedAt should change');
  } finally {
    cleanup();
  }
});

test('can update recipe ingredients', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const ing1 = createTestIngredient(db, 'Ingredient 1');
    const ing2 = createTestIngredient(db, 'Ingredient 2');
    const ing3 = createTestIngredient(db, 'Ingredient 3');

    const created = repo.create(
      {
        title: 'Recipe with Ingredients',
        instructions: 'Cook it',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      [
        { ingredientId: ing1, quantity: 1, unit: 'cup', notes: null, optional: false },
        { ingredientId: ing2, quantity: 2, unit: 'tbsp', notes: null, optional: false },
      ]
    );

    assertEqual(created.ingredients?.length, 2, 'should start with 2 ingredients');

    // Update to new ingredients
    const updated = repo.update(
      { id: created.id },
      [{ ingredientId: ing3, quantity: 3, unit: 'oz', notes: 'new ingredient', optional: true }]
    );

    assertNotNull(updated, 'should return updated recipe');
    assertEqual(updated.ingredients?.length, 1, 'should have 1 ingredient');
    assertEqual(updated.ingredients![0].ingredientId, ing3, 'should have new ingredient');
  } finally {
    cleanup();
  }
});

test('can update recipe tags', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const tag1 = createTestTag(db, 'Tag 1');
    const tag2 = createTestTag(db, 'Tag 2');
    const tag3 = createTestTag(db, 'Tag 3');

    const created = repo.create(
      {
        title: 'Recipe with Tags',
        instructions: 'Cook it',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      undefined,
      [tag1, tag2]
    );

    assertEqual(created.tagIds?.length, 2, 'should start with 2 tags');

    // Update to new tags
    const updated = repo.update({ id: created.id }, undefined, [tag3]);

    assertNotNull(updated, 'should return updated recipe');
    assertEqual(updated.tagIds?.length, 1, 'should have 1 tag');
    assertEqual(updated.tagIds![0], tag3, 'should have new tag');
  } finally {
    cleanup();
  }
});

test('update returns null for non-existent recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.update({ id: 'non-existent-id', title: 'New Title' });
    assertEqual(result, null, 'should return null for non-existent recipe');
  } finally {
    cleanup();
  }
});

test('can delete recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      title: 'Recipe to Delete',
      instructions: 'Will be deleted',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const deleted = repo.delete(created.id);
    assertEqual(deleted, true, 'delete should return true');

    const fetched = repo.getById(created.id);
    assertEqual(fetched, null, 'deleted recipe should not be found');
  } finally {
    cleanup();
  }
});

test('delete returns false for non-existent recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.delete('non-existent-id');
    assertEqual(result, false, 'delete should return false for non-existent recipe');
  } finally {
    cleanup();
  }
});

test('delete cascades to recipe_ingredients', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const ing = createTestIngredient(db, 'Test Ingredient');

    const created = repo.create(
      {
        title: 'Recipe with Ingredient',
        instructions: 'Cook it',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      [{ ingredientId: ing, quantity: 1, unit: 'cup', notes: null, optional: false }]
    );

    // Verify ingredient link exists
    const beforeDelete = db
      .prepare('SELECT COUNT(*) as count FROM recipe_ingredients WHERE recipe_id = ?')
      .get(created.id) as { count: number };
    assertEqual(beforeDelete.count, 1, 'should have 1 recipe ingredient before delete');

    repo.delete(created.id);

    // Verify ingredient link was deleted
    const afterDelete = db
      .prepare('SELECT COUNT(*) as count FROM recipe_ingredients WHERE recipe_id = ?')
      .get(created.id) as { count: number };
    assertEqual(afterDelete.count, 0, 'recipe ingredients should be deleted');
  } finally {
    cleanup();
  }
});

test('delete cascades to recipe_tags', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const tag = createTestTag(db, 'Test Tag');

    const created = repo.create(
      {
        title: 'Recipe with Tag',
        instructions: 'Cook it',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      undefined,
      [tag]
    );

    // Verify tag link exists
    const beforeDelete = db
      .prepare('SELECT COUNT(*) as count FROM recipe_tags WHERE recipe_id = ?')
      .get(created.id) as { count: number };
    assertEqual(beforeDelete.count, 1, 'should have 1 recipe tag before delete');

    repo.delete(created.id);

    // Verify tag link was deleted
    const afterDelete = db
      .prepare('SELECT COUNT(*) as count FROM recipe_tags WHERE recipe_id = ?')
      .get(created.id) as { count: number };
    assertEqual(afterDelete.count, 0, 'recipe tags should be deleted');
  } finally {
    cleanup();
  }
});

test('exists returns true for existing recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      title: 'Existing Recipe',
      instructions: 'Instructions',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    assertEqual(repo.exists(created.id), true, 'should return true for existing recipe');
  } finally {
    cleanup();
  }
});

test('exists returns false for non-existent recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    assertEqual(repo.exists('non-existent-id'), false, 'should return false for non-existent recipe');
  } finally {
    cleanup();
  }
});

test('count returns correct number', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    assertEqual(repo.count(), 0, 'should start with 0 recipes');

    repo.create({
      title: 'Recipe 1',
      instructions: 'Instructions 1',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });
    repo.create({
      title: 'Recipe 2',
      instructions: 'Instructions 2',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    assertEqual(repo.count(), 2, 'should have 2 recipes');
  } finally {
    cleanup();
  }
});

test('count with filters', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const tag = createTestTag(db, 'Vegan', 'dietary');

    repo.create({
      title: 'Italian Recipe',
      instructions: 'Cook',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: 'Italian',
      difficulty: null,
    });
    repo.create(
      {
        title: 'Vegan Italian',
        instructions: 'Cook vegan',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: 'Italian',
        difficulty: null,
      },
      undefined,
      [tag]
    );
    repo.create({
      title: 'Mexican Recipe',
      instructions: 'Make tacos',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: 'Mexican',
      difficulty: null,
    });

    assertEqual(repo.count(), 3, 'total count');
    assertEqual(repo.count({ cuisine: 'Italian' }), 2, 'Italian count');
    assertEqual(repo.count({ tagIds: [tag] }), 1, 'Vegan count');
    assertEqual(repo.count({ cuisine: 'Italian', tagIds: [tag] }), 1, 'Vegan Italian count');
  } finally {
    cleanup();
  }
});

// Run all tests
console.log('Running RecipeRepository integration tests...');
console.log('');
runTests();
