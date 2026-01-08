/**
 * Integration tests for PlanRepository
 *
 * Tests all CRUD operations against an in-memory SQLite database.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { PlanRepository } from '../src/repos/plan.repo.js';
import type { Database } from 'better-sqlite3';

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

    expect(plan).toBeDefined();
    expect(plan.week).toBe('2025-W02');
    expect(plan.status).toBe('draft');
    expect(plan.notes).toBe(null);
    expect(plan.id.length > 0).toBe(true);
    expect(plan.createdAt.length > 0).toBe(true);
    expect(plan.updatedAt.length > 0).toBe(true);
    expect(Array.isArray(plan.items)).toBe(true);
    expect(plan.items?.length).toBe(0);
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

    expect(plan.week).toBe('2025-W03');
    expect(plan.status).toBe('active');
    expect(plan.notes).toBe('Vacation week');
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

    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);
    expect(fetched.week).toBe('2025-W04');
  } finally {
    cleanup();
  }
});

test('getById returns null for non-existent plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getById('non-existent-id');
    expect(result).toBe(null);
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

    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);
    expect(fetched.notes).toBe('Test notes');
  } finally {
    cleanup();
  }
});

test('getByWeek returns null for non-existent week', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getByWeek('2099-W99');
    expect(result).toBe(null);
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

    expect(plans.length).toBe(3);
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

    expect(plans[0].week).toBe('2025-W03');
    expect(plans[1].week).toBe('2025-W02');
    expect(plans[2].week).toBe('2025-W01');
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
    expect(page1.length).toBe(2);

    const page2 = repo.list({ limit: 2, offset: 2 });
    expect(page2.length).toBe(2);

    const page3 = repo.list({ limit: 2, offset: 4 });
    expect(page3.length).toBe(1);
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
    expect(drafts.length).toBe(2);

    const active = repo.list({ status: 'active' });
    expect(active.length).toBe(1);

    const completed = repo.list({ status: 'completed' });
    expect(completed.length).toBe(1);
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

    expect(updated).toBeDefined();
    expect(updated.notes).toBe('Updated notes');
    expect(updated.status).toBe('active');
    expect(updated.week).toBe('2025-W06');
    expect(updated.updatedAt !== oldTimestamp).toBe(true);
  } finally {
    cleanup();
  }
});

test('update returns null for non-existent plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.update({ id: 'non-existent-id', notes: 'New notes' });
    expect(result).toBe(null);
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
    expect(deleted).toBe(true);

    const fetched = repo.getById(created.id);
    expect(fetched).toBe(null);
  } finally {
    cleanup();
  }
});

test('delete returns false for non-existent plan', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.delete('non-existent-id');
    expect(result).toBe(false);
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

    expect(created.status).toBe('draft');

    const updated = repo.setStatus(created.id, 'active');
    expect(updated).toBeDefined();
    expect(updated.status).toBe('active');

    const completed = repo.setStatus(created.id, 'completed');
    expect(completed).toBeDefined();
    expect(completed.status).toBe('completed');
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

    expect(repo.exists(created.id)).toBe(true);
  } finally {
    cleanup();
  }
});

test('exists returns false for non-existent plan', () => {
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

    repo.create({ week: '2025-W10', notes: null });
    repo.create({ week: '2025-W11', notes: null });

    expect(repo.count()).toBe(2);
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

    expect(repo.count()).toBe(3);
    expect(repo.count({ status: 'draft' })).toBe(2);
    expect(repo.count({ status: 'active' })).toBe(1);
    expect(repo.count({ status: 'completed' })).toBe(0);
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

    expect(meal).toBeDefined();
    expect(meal.planId).toBe(plan.id);
    expect(meal.dayOfWeek).toBe(1);
    expect(meal.mealType).toBe('breakfast');
    expect(meal.recipeId).toBe(recipeId);
    expect(meal.servings).toBe(2);
    expect(meal.notes).toBe('Start the week right');
    expect(meal.id.length > 0).toBe(true);
  } finally {
    cleanup();
  }
});

test('can set a meal without recipe (null recipeId)', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W16', notes: null });

    const meal = repo.setMeal(plan.id, 3, 'lunch', null, 1, 'Leftovers');

    expect(meal).toBeDefined();
    expect(meal.recipeId).toBe(null);
    expect(meal.servings).toBe(1);
    expect(meal.notes).toBe('Leftovers');
  } finally {
    cleanup();
  }
});

test('setMeal uses default servings when not specified', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W17', notes: null });

    const meal = repo.setMeal(plan.id, 5, 'dinner', null);

    expect(meal.servings).toBe(2);
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

    expect(updated.id).toBe(initialId);
    expect(updated.recipeId).toBe(recipe2);
    expect(updated.servings).toBe(6);
    expect(updated.notes).toBe('Updated');

    // Verify only one item exists
    const meals = repo.getMeals(plan.id);
    expect(meals.length).toBe(1);
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
    expect(removed).toBe(true);

    const meal = repo.getMealBySlot(plan.id, 2, 'lunch');
    expect(meal).toBe(null);
  } finally {
    cleanup();
  }
});

test('removeMeal returns false for non-existent meal', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W20', notes: null });

    const result = repo.removeMeal(plan.id, 7, 'dinner');
    expect(result).toBe(false);
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

    expect(meals.length).toBe(4);
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

    expect(meals[0].dayOfWeek).toBe(1);
    expect(meals[0].mealType).toBe('breakfast');
    expect(meals[1].dayOfWeek).toBe(1);
    expect(meals[1].mealType).toBe('lunch');
    expect(meals[2].dayOfWeek).toBe(2);
    expect(meals[2].mealType).toBe('breakfast');
    expect(meals[3].dayOfWeek).toBe(2);
    expect(meals[3].mealType).toBe('dinner');
  } finally {
    cleanup();
  }
});

test('getMeals returns empty array for plan with no meals', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W23', notes: null });

    const meals = repo.getMeals(plan.id);

    expect(meals.length).toBe(0);
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

    expect(meal).toBeDefined();
    expect(meal.dayOfWeek).toBe(3);
    expect(meal.mealType).toBe('dinner');
    expect(meal.notes).toBe('Special dinner');
  } finally {
    cleanup();
  }
});

test('getMealBySlot returns null for empty slot', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const plan = repo.create({ week: '2025-W25', notes: null });

    const meal = repo.getMealBySlot(plan.id, 5, 'lunch');

    expect(meal).toBe(null);
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

    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);
    expect(fetched.dayOfWeek).toBe(6);
  } finally {
    cleanup();
  }
});

test('getMealById returns null for non-existent meal', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const meal = repo.getMealById('non-existent-id');
    expect(meal).toBe(null);
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
    expect(beforeDelete.count).toBe(3);

    repo.delete(plan.id);

    // Verify items were deleted
    const afterDelete = db
      .prepare('SELECT COUNT(*) as count FROM plan_items WHERE plan_id = ?')
      .get(plan.id) as { count: number };
    expect(afterDelete.count).toBe(0);
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

    expect(fetched).toBeDefined();
    expect(fetched.items).toBeDefined();
    expect(fetched.items.length).toBe(2);
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

    expect(fetched).toBeDefined();
    expect(fetched.items).toBeDefined();
    expect(fetched.items.length).toBe(1);
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

    expect(plans.length).toBe(2);

    const fetchedPlan1 = plans.find((p) => p.id === plan1.id);
    const fetchedPlan2 = plans.find((p) => p.id === plan2.id);

    expect(fetchedPlan1).toBeDefined();
    expect(fetchedPlan2).toBeDefined();
    expect(fetchedPlan1.items?.length).toBe(1);
    expect(fetchedPlan2.items?.length).toBe(2);
  } finally {
    cleanup();
  }
});

// ============================================
// Plan Completion Tests
// ============================================

describe('Plan Completion', () => {
  test('completePlan marks plan as completed', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const plan = repo.create({ week: '2025-W50', notes: null });

      const completed = repo.completePlan(plan.id);

      expect(completed).not.toBeNull();
      expect(completed!.status).toBe('completed');
      expect(completed!.completedAt).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  test('completePlan returns null for already completed plan', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const plan = repo.create({ week: '2025-W51', notes: null });
      repo.completePlan(plan.id);

      // Try to complete again
      const result = repo.completePlan(plan.id);

      expect(result).toBeNull();
    } finally {
      cleanup();
    }
  });

  test('completePlan returns null for non-existent plan', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const result = repo.completePlan('non-existent-id');
      expect(result).toBeNull();
    } finally {
      cleanup();
    }
  });

  test('getCompletedPlans returns completed plans', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      // Create and complete some plans
      const plan1 = repo.create({ week: '2025-W40', notes: null });
      const plan2 = repo.create({ week: '2025-W41', notes: null });
      const plan3 = repo.create({ week: '2025-W42', notes: null });

      repo.completePlan(plan1.id);
      repo.completePlan(plan2.id);
      // plan3 is not completed

      const completed = repo.getCompletedPlans();

      expect(completed.length).toBe(2);
      expect(completed.every((p) => p.completedAt !== null)).toBe(true);
    } finally {
      cleanup();
    }
  });

  test('getCompletedPlans respects limit', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const plan1 = repo.create({ week: '2025-W43', notes: null });
      const plan2 = repo.create({ week: '2025-W44', notes: null });
      const plan3 = repo.create({ week: '2025-W45', notes: null });

      repo.completePlan(plan1.id);
      repo.completePlan(plan2.id);
      repo.completePlan(plan3.id);

      const completed = repo.getCompletedPlans(2);

      expect(completed.length).toBe(2);
    } finally {
      cleanup();
    }
  });

  test('markMealAsMade sets wasMade flag', () => {
    const { db, repo, cleanup } = setupTestDb();
    try {
      const recipe = createTestRecipe(db, 'Test Recipe');
      const plan = repo.create({ week: '2025-W46', notes: null });
      repo.setMeal(plan.id, 1, 'dinner', recipe);

      const updated = repo.markMealAsMade(plan.id, 1, 'dinner', true);

      expect(updated).not.toBeNull();
      expect(updated!.wasMade).toBe(true);
    } finally {
      cleanup();
    }
  });

  test('markMealAsMade can unset wasMade flag', () => {
    const { db, repo, cleanup } = setupTestDb();
    try {
      const recipe = createTestRecipe(db, 'Test Recipe');
      const plan = repo.create({ week: '2025-W47', notes: null });
      repo.setMeal(plan.id, 1, 'dinner', recipe);
      repo.markMealAsMade(plan.id, 1, 'dinner', true);

      const updated = repo.markMealAsMade(plan.id, 1, 'dinner', false);

      expect(updated).not.toBeNull();
      expect(updated!.wasMade).toBe(false);
    } finally {
      cleanup();
    }
  });

  test('markMealAsMade returns null for non-existent meal', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const plan = repo.create({ week: '2025-W48', notes: null });

      const result = repo.markMealAsMade(plan.id, 1, 'dinner', true);

      expect(result).toBeNull();
    } finally {
      cleanup();
    }
  });

  test('getMadeMeals returns meals marked as made', () => {
    const { db, repo, cleanup } = setupTestDb();
    try {
      const recipe = createTestRecipe(db, 'Test Recipe');
      const plan = repo.create({ week: '2025-W49', notes: null });
      repo.setMeal(plan.id, 1, 'breakfast', recipe);
      repo.setMeal(plan.id, 1, 'lunch', recipe);
      repo.setMeal(plan.id, 1, 'dinner', recipe);

      repo.markMealAsMade(plan.id, 1, 'breakfast', true);
      repo.markMealAsMade(plan.id, 1, 'dinner', true);
      repo.completePlan(plan.id);

      const madeMeals = repo.getMadeMeals();

      expect(madeMeals.length).toBe(2);
      expect(madeMeals.every((m) => m.wasMade)).toBe(true);
    } finally {
      cleanup();
    }
  });

  test('getMadeMeals respects limit', () => {
    const { db, repo, cleanup } = setupTestDb();
    try {
      const recipe = createTestRecipe(db, 'Test Recipe');
      const plan = repo.create({ week: '2025-W52', notes: null });
      repo.setMeal(plan.id, 1, 'breakfast', recipe);
      repo.setMeal(plan.id, 1, 'lunch', recipe);
      repo.setMeal(plan.id, 1, 'dinner', recipe);

      repo.markMealAsMade(plan.id, 1, 'breakfast', true);
      repo.markMealAsMade(plan.id, 1, 'lunch', true);
      repo.markMealAsMade(plan.id, 1, 'dinner', true);
      repo.completePlan(plan.id);

      const madeMeals = repo.getMadeMeals(2);

      expect(madeMeals.length).toBe(2);
    } finally {
      cleanup();
    }
  });

  test('getRecentlyMadeRecipeIds returns recipe IDs from made meals', () => {
    const { db, repo, cleanup } = setupTestDb();
    try {
      const recipe1 = createTestRecipe(db, 'Recipe 1');
      const recipe2 = createTestRecipe(db, 'Recipe 2');
      const plan = repo.create({ week: '2025-W53', notes: null });
      repo.setMeal(plan.id, 1, 'breakfast', recipe1);
      repo.setMeal(plan.id, 1, 'lunch', recipe2);
      repo.setMeal(plan.id, 1, 'dinner', recipe1);

      repo.markMealAsMade(plan.id, 1, 'breakfast', true);
      repo.markMealAsMade(plan.id, 1, 'dinner', true);
      // lunch not made
      repo.completePlan(plan.id);

      const recipeIds = repo.getRecentlyMadeRecipeIds(30);

      expect(recipeIds.length).toBe(1); // recipe1 appears twice but should be distinct
      expect(recipeIds).toContain(recipe1);
      expect(recipeIds).not.toContain(recipe2);
    } finally {
      cleanup();
    }
  });
});

