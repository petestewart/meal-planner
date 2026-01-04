/**
 * Unit tests for agent tool handlers
 *
 * Tests that tool handlers correctly:
 * - Validate inputs using T024 schemas
 * - Call core services correctly
 * - Audit log all mutations with agent_id
 * - Return outputs matching T024 output schemas
 */

import { test, expect, describe } from 'vitest';

import type { Database } from 'better-sqlite3';
import { getDb, closeDb, migrate, getDefaultMigrationsDir } from '@meals/core';
import {
  // Curator tools
  searchRecipes,
  getRecipe,
  createRecipe,
  normalizeRecipe,

  // Planner tools
  getPreferences,
  getWeekPlan,
  setMeal,
  generateGroceryList,

  // Types
  type AgentContext,
} from '../src/index.js';

// Database setup helper
function setupTestDb(): { db: Database; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());

  return {
    db,
    cleanup: () => closeDb(db),
  };
}

// Create agent context
function createContext(db: Database, agentId: 'curator' | 'planner' = 'curator'): AgentContext {
  return {
    agentId,
    sessionId: `test-session-${Date.now()}`,
    db,
  };
}

// Helper to get audit entries for an entity
function getAuditEntries(db: Database, entityId: string) {
  return db
    .prepare('SELECT * FROM audit_log WHERE entity_id = ? ORDER BY timestamp DESC')
    .all(entityId) as Array<{
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: string | null;
  }>;
}

// Helper to create test ingredients
function createTestIngredient(
  db: Database,
  name: string,
  category?: string
): string {
  const id = `ing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  db.prepare(
    'INSERT INTO ingredients (id, name, category, default_unit) VALUES (?, ?, ?, ?)'
  ).run(id, name, category ?? null, null);
  return id;
}

// ============================================================================
// CURATOR TOOL TESTS
// ============================================================================

test('searchRecipes: returns empty array when no recipes exist', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');
    const result = await searchRecipes({}, context);

    expect(result.recipes.length).toBe(0);
    expect(result.total).toBe(0);
  } finally {
    cleanup();
  }
});

test('searchRecipes: returns recipes matching query', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    // Create a recipe first
    await createRecipe(
      {
        title: 'Pasta Carbonara',
        instructions: 'Cook pasta with bacon and eggs',
        ingredients: [{ name: 'pasta' }],
      },
      context
    );

    const result = await searchRecipes({ cuisine: undefined }, context);

    expect(result.recipes.length).toBe(1);
    expect(result.recipes[0].title).toBe('Pasta Carbonara');
  } finally {
    cleanup();
  }
});

test('searchRecipes: respects limit parameter', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    // Create multiple recipes
    for (let i = 0; i < 5; i++) {
      await createRecipe(
        {
          title: `Recipe ${i}`,
          instructions: 'Instructions',
          ingredients: [{ name: 'ingredient' }],
        },
        context
      );
    }

    const result = await searchRecipes({ limit: 2 }, context);

    expect(result.recipes.length).toBe(2);
    // Note: total reflects total matching recipes, not the limited subset
    expect(result.total).toBe(5);
  } finally {
    cleanup();
  }
});

test('searchRecipes: validates input schema', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    // Invalid limit should throw
    let threw = false;
    try {
      await searchRecipes({ limit: 150 } as any, context);
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);
  } finally {
    cleanup();
  }
});

test('getRecipe: returns recipe by ID', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    const created = await createRecipe(
      {
        title: 'Test Recipe',
        instructions: 'Test instructions',
        ingredients: [{ name: 'test ingredient' }],
      },
      context
    );

    const result = await getRecipe({ id: created.recipe.id }, context);

    expect(result.recipe.title).toBe('Test Recipe');
    expect(result.recipe.id).toBe(created.recipe.id);
  } finally {
    cleanup();
  }
});

test('getRecipe: throws for non-existent recipe', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    let threw = false;
    try {
      await getRecipe({ id: 'non-existent' }, context);
    } catch (e) {
      threw = true;
      expect((e as Error).message.includes('not found')).toBe(true);
    }

    expect(threw).toBe(true);
  } finally {
    cleanup();
  }
});

test('getRecipe: validates input schema', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    let threw = false;
    try {
      await getRecipe({ id: '' }, context);
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);
  } finally {
    cleanup();
  }
});

test('createRecipe: creates recipe and logs to audit with agent actor', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    const result = await createRecipe(
      {
        title: 'New Recipe',
        instructions: 'Step 1: Do something',
        ingredients: [{ name: 'salt' }],
        servings: 4,
        cuisine: 'Italian',
      },
      context
    );

    expect(result.recipe).toBeDefined();
    expect(result.recipe.title).toBe('New Recipe');
    expect(result.recipe.cuisine).toBe('Italian');
    expect(result.recipe.sourceType).toBe('agent_curated');

    // Check audit log
    const auditEntries = getAuditEntries(db, result.recipe.id);
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].actor).toBe('agent:curator');
    expect(auditEntries[0].action).toBe('create');
  } finally {
    cleanup();
  }
});

test('createRecipe: validates required fields', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    let threw = false;
    try {
      await createRecipe(
        {
          title: '',
          instructions: 'Test',
          ingredients: [{ name: 'salt' }],
        } as any,
        context
      );
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);
  } finally {
    cleanup();
  }
});

test('normalizeRecipe: updates recipe and logs to audit', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    // Create a recipe first
    const created = await createRecipe(
      {
        title: 'Original Title',
        instructions: 'Original instructions',
        ingredients: [{ name: 'flour' }],
      },
      context
    );

    // Normalize it
    const result = await normalizeRecipe(
      {
        id: created.recipe.id,
        updates: {
          title: 'Normalized Title',
          cuisine: 'French',
          difficulty: 'medium',
        },
      },
      context
    );

    expect(result.recipe.title).toBe('Normalized Title');
    expect(result.recipe.cuisine).toBe('French');
    expect(result.recipe.difficulty).toBe('medium');

    // Check audit log
    const auditEntries = getAuditEntries(db, created.recipe.id);
    expect(auditEntries.length).toBe(2);
    expect(auditEntries[0].actor).toBe('agent:curator');
    expect(auditEntries[0].action).toBe('update');
  } finally {
    cleanup();
  }
});

test('normalizeRecipe: throws for non-existent recipe', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    let threw = false;
    try {
      await normalizeRecipe(
        {
          id: 'non-existent',
          updates: { title: 'New Title' },
        },
        context
      );
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);
  } finally {
    cleanup();
  }
});

// ============================================================================
// PLANNER TOOL TESTS
// ============================================================================

test('getPreferences: returns default preferences', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'planner');

    const result = await getPreferences({}, context);

    expect(result.preferences).toBeDefined();
    expect(Array.isArray(result.preferences.dietaryRestrictions)).toBe(true);
    expect(typeof result.preferences.defaultServings === 'number').toBe(true);
  } finally {
    cleanup();
  }
});

test('getWeekPlan: returns null plan for non-existent week', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'planner');

    const result = await getWeekPlan({ week: '2025-W01' }, context);

    expect(result.plan).toBe(null);
    expect(result.filledSlots).toBe(0);
    expect(result.emptySlots.length).toBe(21);
  } finally {
    cleanup();
  }
});

test('getWeekPlan: validates week format', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'planner');

    let threw = false;
    try {
      await getWeekPlan({ week: 'invalid' }, context);
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);
  } finally {
    cleanup();
  }
});

test('setMeal: creates plan and sets meal with audit logging', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const curatorContext = createContext(db, 'curator');
    const plannerContext = createContext(db, 'planner');

    // Create a recipe first
    const recipe = await createRecipe(
      {
        title: 'Test Meal',
        instructions: 'Cook it',
        ingredients: [{ name: 'something' }],
      },
      curatorContext
    );

    // Set the meal
    const result = await setMeal(
      {
        week: '2025-W01',
        dayOfWeek: 1,
        mealType: 'dinner',
        recipeId: recipe.recipe.id,
        servings: 4,
      },
      plannerContext
    );

    expect(result.planItem).toBeDefined();
    expect(result.planItem.recipeId).toBe(recipe.recipe.id);
    expect(result.planItem.dayOfWeek).toBe(1);
    expect(result.planItem.mealType).toBe('dinner');
    expect(result.planItem.servings).toBe(4);

    // Check audit log for plan item
    const auditEntries = getAuditEntries(db, result.planItem.id);
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].actor).toBe('agent:planner');
  } finally {
    cleanup();
  }
});

test('setMeal: validates input schema', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'planner');

    let threw = false;
    try {
      await setMeal(
        {
          week: '2025-W01',
          dayOfWeek: 8, // Invalid day
          mealType: 'dinner',
          recipeId: 'some-id',
        },
        context
      );
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);
  } finally {
    cleanup();
  }
});

test('generateGroceryList: returns empty list for non-existent plan', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'planner');

    const result = await generateGroceryList({ week: '2025-W01' }, context);

    expect(result.items.length).toBe(0);
    expect(result.totalItems).toBe(0);
  } finally {
    cleanup();
  }
});

test('generateGroceryList: validates week format', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'planner');

    let threw = false;
    try {
      await generateGroceryList({ week: '2025-W54' }, context);
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);
  } finally {
    cleanup();
  }
});

test('generateGroceryList: returns aggregated items for plan with meals', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const curatorContext = createContext(db, 'curator');
    const plannerContext = createContext(db, 'planner');

    // Create ingredient
    const ingredientId = createTestIngredient(db, 'Chicken', 'Meat');

    // Create a recipe with a real ingredient
    db.prepare(`
      INSERT INTO recipes (id, title, instructions, servings, created_at, updated_at)
      VALUES ('recipe-1', 'Chicken Dinner', 'Cook chicken', 4, datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, notes, optional)
      VALUES ('ri-1', 'recipe-1', ?, 500, 'g', null, 0)
    `).run(ingredientId);

    // Set the meal
    await setMeal(
      {
        week: '2025-W02',
        dayOfWeek: 1,
        mealType: 'dinner',
        recipeId: 'recipe-1',
        servings: 4,
      },
      plannerContext
    );

    const result = await generateGroceryList({ week: '2025-W02' }, plannerContext);

    expect(result.items.length > 0).toBe(true);
    expect(result.totalItems).toBe(result.items.length);
  } finally {
    cleanup();
  }
});

// ============================================================================
// AGENT ACTOR FORMAT TESTS
// ============================================================================

test('curator agent uses agent:curator actor format', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const context = createContext(db, 'curator');

    const result = await createRecipe(
      {
        title: 'Curator Recipe',
        instructions: 'Instructions',
        ingredients: [{ name: 'test' }],
      },
      context
    );

    const auditEntries = getAuditEntries(db, result.recipe.id);
    expect(auditEntries[0].actor).toBe('agent:curator');
  } finally {
    cleanup();
  }
});

test('planner agent uses agent:planner actor format', async () => {
  const { db, cleanup } = setupTestDb();
  try {
    const curatorContext = createContext(db, 'curator');
    const plannerContext = createContext(db, 'planner');

    // Create a recipe as curator
    const recipe = await createRecipe(
      {
        title: 'Planner Recipe',
        instructions: 'Instructions',
        ingredients: [{ name: 'test' }],
      },
      curatorContext
    );

    // Set meal as planner
    const result = await setMeal(
      {
        week: '2025-W03',
        dayOfWeek: 2,
        mealType: 'lunch',
        recipeId: recipe.recipe.id,
      },
      plannerContext
    );

    const auditEntries = getAuditEntries(db, result.planItem.id);
    expect(auditEntries[0].actor).toBe('agent:planner');
  } finally {
    cleanup();
  }
});

