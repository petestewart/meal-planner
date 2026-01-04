/**
 * Integration tests for RecipeRepository
 *
 * Tests all CRUD operations against an in-memory SQLite database.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { RecipeRepository } from '../src/repos/recipe.repo.js';
import type { Database } from 'better-sqlite3';

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

    expect(recipe).toBeDefined();
    expect(recipe.title).toBe('Test Recipe');
    expect(recipe.instructions).toBe('Mix ingredients and cook.');
    expect(recipe.servings).toBe(4);
    expect(recipe.id.length > 0).toBe(true);
    expect(recipe.createdAt.length > 0).toBe(true);
    expect(recipe.updatedAt.length > 0).toBe(true);
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

    expect(recipe.title).toBe('Full Recipe');
    expect(recipe.description).toBe('A complete recipe with all fields');
    expect(recipe.servings).toBe(6);
    expect(recipe.prepTimeMinutes).toBe(15);
    expect(recipe.cookTimeMinutes).toBe(30);
    expect(recipe.sourceUrl).toBe('https://example.com/recipe');
    expect(recipe.sourceType).toBe('imported');
    expect(recipe.cuisine).toBe('Italian');
    expect(recipe.difficulty).toBe('medium');
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

    expect(recipe.ingredients).toBeDefined();
    expect(recipe.ingredients.length).toBe(2);

    const flour = recipe.ingredients.find((i) => i.ingredientId === ingredientId1);
    expect(flour).toBeDefined();
    expect(flour.quantity).toBe(2);
    expect(flour.unit).toBe('cups');
    expect(flour.optional).toBe(false);

    const sugar = recipe.ingredients.find((i) => i.ingredientId === ingredientId2);
    expect(sugar).toBeDefined();
    expect(sugar.optional).toBe(true);
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

    expect(recipe.tagIds).toBeDefined();
    expect(recipe.tagIds.length).toBe(2);
    expect(recipe.tagIds.includes(tagId1)).toBe(true);
    expect(recipe.tagIds.includes(tagId2)).toBe(true);
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

    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);
    expect(fetched.title).toBe('Get Test Recipe');
  } finally {
    cleanup();
  }
});

test('getById returns null for non-existent recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getById('non-existent-id');
    expect(result).toBe(null);
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

    expect(recipes.length).toBe(3);
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
    expect(page1.length).toBe(2);

    const page2 = repo.list({ limit: 2, offset: 2 });
    expect(page2.length).toBe(2);

    const page3 = repo.list({ limit: 2, offset: 4 });
    expect(page3.length).toBe(1);
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
    expect(italian.length).toBe(1);
    expect(italian[0].title).toBe('Italian Pasta');

    const mexican = repo.list({ cuisine: 'Mexican' });
    expect(mexican.length).toBe(1);
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
    expect(easy.length).toBe(1);
    expect(easy[0].title).toBe('Easy Recipe');
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
    expect(dinners.length).toBe(2);

    const veganDinners = repo.list({ tagIds: [dinnerTag, veganTag] });
    expect(veganDinners.length).toBe(1);
    expect(veganDinners[0].title).toBe('Vegan Dinner');
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

    expect(updated).toBeDefined();
    expect(updated.title).toBe('Updated Title');
    expect(updated.servings).toBe(6);
    expect(updated.cuisine).toBe('Thai');
    expect(updated.instructions).toBe('Original instructions');
    expect(updated.updatedAt !== oldTimestamp).toBe(true);
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

    expect(created.ingredients?.length).toBe(2);

    // Update to new ingredients
    const updated = repo.update(
      { id: created.id },
      [{ ingredientId: ing3, quantity: 3, unit: 'oz', notes: 'new ingredient', optional: true }]
    );

    expect(updated).toBeDefined();
    expect(updated.ingredients?.length).toBe(1);
    expect(updated.ingredients![0].ingredientId).toBe(ing3);
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

    expect(created.tagIds?.length).toBe(2);

    // Update to new tags
    const updated = repo.update({ id: created.id }, undefined, [tag3]);

    expect(updated).toBeDefined();
    expect(updated.tagIds?.length).toBe(1);
    expect(updated.tagIds![0]).toBe(tag3);
  } finally {
    cleanup();
  }
});

test('update returns null for non-existent recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.update({ id: 'non-existent-id', title: 'New Title' });
    expect(result).toBe(null);
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
    expect(deleted).toBe(true);

    const fetched = repo.getById(created.id);
    expect(fetched).toBe(null);
  } finally {
    cleanup();
  }
});

test('delete returns false for non-existent recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.delete('non-existent-id');
    expect(result).toBe(false);
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
    expect(beforeDelete.count).toBe(1);

    repo.delete(created.id);

    // Verify ingredient link was deleted
    const afterDelete = db
      .prepare('SELECT COUNT(*) as count FROM recipe_ingredients WHERE recipe_id = ?')
      .get(created.id) as { count: number };
    expect(afterDelete.count).toBe(0);
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
    expect(beforeDelete.count).toBe(1);

    repo.delete(created.id);

    // Verify tag link was deleted
    const afterDelete = db
      .prepare('SELECT COUNT(*) as count FROM recipe_tags WHERE recipe_id = ?')
      .get(created.id) as { count: number };
    expect(afterDelete.count).toBe(0);
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

    expect(repo.exists(created.id)).toBe(true);
  } finally {
    cleanup();
  }
});

test('exists returns false for non-existent recipe', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    expect(repo.exists('non-existent-id')).toBe(false);
  } finally {
    cleanup();
  }
});

test('count returns correct number', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    expect(repo.count()).toBe(0);

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

    expect(repo.count()).toBe(2);
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

    expect(repo.count()).toBe(3);
    expect(repo.count({ cuisine: 'Italian' })).toBe(2);
    expect(repo.count({ tagIds: [tag] })).toBe(1);
    expect(repo.count({ cuisine: 'Italian', tagIds: [tag] })).toBe(1);
  } finally {
    cleanup();
  }
});

// ==================== FTS5 Search Tests ====================

test('FTS search finds recipes by title', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Chicken Parmesan',
      instructions: 'Cook the chicken',
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
      title: 'Beef Stew',
      instructions: 'Cook the beef slowly',
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
      title: 'Grilled Chicken Salad',
      instructions: 'Grill the chicken and add to salad',
      servings: 2,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const results = repo.list({ search: 'chicken' });
    expect(results.length).toBe(2);

    // Verify both chicken recipes are in results
    const titles = results.map(r => r.title);
    expect(titles.includes('Chicken Parmesan')).toBe(true);
    expect(titles.includes('Grilled Chicken Salad')).toBe(true);
  } finally {
    cleanup();
  }
});

test('FTS search finds recipes by description', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Simple Pasta',
      instructions: 'Boil pasta',
      servings: 4,
      description: 'A quick and delicious weeknight dinner',
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });
    repo.create({
      title: 'Complex Risotto',
      instructions: 'Stir constantly',
      servings: 4,
      description: 'Perfect for special occasions',
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const results = repo.list({ search: 'weeknight' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Simple Pasta');
  } finally {
    cleanup();
  }
});

test('FTS search finds recipes by instructions', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Slow Cooker Recipe',
      instructions: 'Place ingredients in slow cooker and simmer for 8 hours',
      servings: 6,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });
    repo.create({
      title: 'Quick Stir Fry',
      instructions: 'Heat wok and cook on high heat for 5 minutes',
      servings: 2,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const results = repo.list({ search: 'simmer' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Slow Cooker Recipe');
  } finally {
    cleanup();
  }
});

test('FTS search returns ranked results by relevance', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    // Recipe with chicken in title only
    repo.create({
      title: 'Beef Stew',
      instructions: 'Cook beef with chicken stock',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });
    // Recipe with chicken appearing multiple times
    repo.create({
      title: 'Chicken Chicken Chicken',
      instructions: 'Chicken recipe with lots of chicken flavor',
      servings: 4,
      description: 'The ultimate chicken dish',
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const results = repo.list({ search: 'chicken' });
    expect(results.length).toBe(2);
    // The recipe with more occurrences of "chicken" should rank higher
    expect(results[0].title).toBe('Chicken Chicken Chicken');
  } finally {
    cleanup();
  }
});

test('FTS search works with cuisine filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Italian Chicken Pasta',
      instructions: 'Cook pasta with chicken',
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
      title: 'Mexican Chicken Tacos',
      instructions: 'Make tacos with chicken',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: 'Mexican',
      difficulty: null,
    });

    const results = repo.list({ search: 'chicken', cuisine: 'Italian' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Italian Chicken Pasta');
  } finally {
    cleanup();
  }
});

test('FTS search works with difficulty filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Easy Chicken',
      instructions: 'Simple chicken recipe',
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
      title: 'Hard Chicken',
      instructions: 'Complex chicken recipe',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: 'hard',
    });

    const results = repo.list({ search: 'chicken', difficulty: 'easy' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Easy Chicken');
  } finally {
    cleanup();
  }
});

test('FTS search works with tag filter', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const veganTag = createTestTag(db, 'Vegan', 'dietary');

    repo.create(
      {
        title: 'Vegan Pasta',
        instructions: 'Cook vegan pasta',
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
      [veganTag]
    );
    repo.create({
      title: 'Regular Pasta',
      instructions: 'Cook pasta with meat',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const results = repo.list({ search: 'pasta', tagIds: [veganTag] });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Vegan Pasta');
  } finally {
    cleanup();
  }
});

test('FTS search returns empty for no matches', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Chicken Recipe',
      instructions: 'Cook chicken',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    const results = repo.list({ search: 'xyz123nonexistent' });
    expect(results.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('FTS count works with search', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      title: 'Chicken One',
      instructions: 'Recipe one',
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
      title: 'Chicken Two',
      instructions: 'Recipe two',
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
      title: 'Beef Recipe',
      instructions: 'Recipe three',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: null,
      difficulty: null,
    });

    expect(repo.count({ search: 'chicken' })).toBe(2);
    expect(repo.count({ search: 'beef' })).toBe(1);
    expect(repo.count({ search: 'nonexistent' })).toBe(0);
  } finally {
    cleanup();
  }
});

test('FTS count works with search and other filters', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const veganTag = createTestTag(db, 'Vegan', 'dietary');

    repo.create({
      title: 'Italian Chicken',
      instructions: 'Italian style',
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
        title: 'Vegan Italian Pasta',
        instructions: 'Contains word chicken stock alternative',
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
      [veganTag]
    );
    repo.create({
      title: 'Mexican Chicken',
      instructions: 'Mexican style',
      servings: 4,
      description: null,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: null,
      sourceType: null,
      cuisine: 'Mexican',
      difficulty: null,
    });

    expect(repo.count({ search: 'chicken', cuisine: 'Italian' })).toBe(2);
    expect(repo.count({ search: 'chicken', tagIds: [veganTag] })).toBe(1);
  } finally {
    cleanup();
  }
});

test('FTS search with limit and offset', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    // Create 5 chicken recipes
    for (let i = 1; i <= 5; i++) {
      repo.create({
        title: `Chicken Recipe ${i}`,
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

    const page1 = repo.list({ search: 'chicken', limit: 2 });
    expect(page1.length).toBe(2);

    const page2 = repo.list({ search: 'chicken', limit: 2, offset: 2 });
    expect(page2.length).toBe(2);

    const page3 = repo.list({ search: 'chicken', limit: 2, offset: 4 });
    expect(page3.length).toBe(1);
  } finally {
    cleanup();
  }
});

