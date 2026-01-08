/**
 * Integration tests for RecipeModificationRepository
 *
 * Tests all CRUD operations against an in-memory SQLite database.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { RecipeModificationRepository } from '../src/repos/recipe-modification.repo.js';
import { RecipeRepository } from '../src/repos/recipe.repo.js';
import type { Database } from 'better-sqlite3';

// Database setup helper
function setupTestDb(): {
  db: Database;
  modRepo: RecipeModificationRepository;
  recipeRepo: RecipeRepository;
  cleanup: () => void;
} {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const modRepo = new RecipeModificationRepository(db);
  const recipeRepo = new RecipeRepository(db);

  return {
    db,
    modRepo,
    recipeRepo,
    cleanup: () => closeDb(db),
  };
}

// Helper to create a test recipe
function createTestRecipe(repo: RecipeRepository, title: string): string {
  const recipe = repo.create({
    title,
    instructions: 'Test instructions',
    servings: 4,
    description: null,
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    sourceUrl: null,
    sourceType: null,
    cuisine: null,
    difficulty: null,
  });
  return recipe.id;
}

// ==================== Basic CRUD Tests ====================

test('getByRecipeId returns null for recipe without modifications', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');
    const result = modRepo.getByRecipeId(recipeId);
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('upsert creates new modification', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    const mod = modRepo.upsert({
      recipeId,
      userNotes: 'My personal notes',
      ingredientOverrides: [{ original: 'butter', replacement: 'olive oil' }],
      instructionNotes: 'Add more garlic',
    });

    expect(mod).toBeDefined();
    expect(mod.id.length).toBeGreaterThan(0);
    expect(mod.recipeId).toBe(recipeId);
    expect(mod.userNotes).toBe('My personal notes');
    expect(mod.ingredientOverrides).toEqual([{ original: 'butter', replacement: 'olive oil' }]);
    expect(mod.instructionNotes).toBe('Add more garlic');
    expect(mod.createdAt).toBeDefined();
    expect(mod.updatedAt).toBeDefined();
  } finally {
    cleanup();
  }
});

test('upsert updates existing modification', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    // Create initial modification
    const created = modRepo.upsert({
      recipeId,
      userNotes: 'Initial notes',
    });

    // Update it
    const updated = modRepo.upsert({
      recipeId,
      userNotes: 'Updated notes',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.userNotes).toBe('Updated notes');
  } finally {
    cleanup();
  }
});

test('upsert only updates provided fields', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    // Create with all fields
    modRepo.upsert({
      recipeId,
      userNotes: 'Notes',
      ingredientOverrides: [{ original: 'a', replacement: 'b' }],
      instructionNotes: 'Instructions',
    });

    // Update only userNotes
    const updated = modRepo.upsert({
      recipeId,
      userNotes: 'New notes',
    });

    expect(updated.userNotes).toBe('New notes');
    expect(updated.ingredientOverrides).toEqual([{ original: 'a', replacement: 'b' }]);
    expect(updated.instructionNotes).toBe('Instructions');
  } finally {
    cleanup();
  }
});

test('upsert can set fields to null', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    // Create with notes
    modRepo.upsert({
      recipeId,
      userNotes: 'Some notes',
    });

    // Set to null
    const updated = modRepo.upsert({
      recipeId,
      userNotes: null,
    });

    expect(updated.userNotes).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== setUserNotes Tests ====================

test('setUserNotes creates modification with notes', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    const mod = modRepo.setUserNotes(recipeId, 'My notes');

    expect(mod.recipeId).toBe(recipeId);
    expect(mod.userNotes).toBe('My notes');
  } finally {
    cleanup();
  }
});

test('setUserNotes updates existing notes', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.setUserNotes(recipeId, 'Initial notes');
    const updated = modRepo.setUserNotes(recipeId, 'Updated notes');

    expect(updated.userNotes).toBe('Updated notes');
  } finally {
    cleanup();
  }
});

test('setUserNotes can clear notes', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.setUserNotes(recipeId, 'Some notes');
    const updated = modRepo.setUserNotes(recipeId, null);

    expect(updated.userNotes).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== Ingredient Override Tests ====================

test('addIngredientOverride creates modification with override', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    const mod = modRepo.addIngredientOverride(recipeId, 'butter', 'margarine');

    expect(mod.ingredientOverrides).toEqual([{ original: 'butter', replacement: 'margarine' }]);
  } finally {
    cleanup();
  }
});

test('addIngredientOverride adds to existing overrides', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.addIngredientOverride(recipeId, 'butter', 'margarine');
    const mod = modRepo.addIngredientOverride(recipeId, 'milk', 'oat milk');

    expect(mod.ingredientOverrides.length).toBe(2);
    expect(mod.ingredientOverrides).toContainEqual({ original: 'butter', replacement: 'margarine' });
    expect(mod.ingredientOverrides).toContainEqual({ original: 'milk', replacement: 'oat milk' });
  } finally {
    cleanup();
  }
});

test('addIngredientOverride replaces existing override for same ingredient', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.addIngredientOverride(recipeId, 'butter', 'margarine');
    const mod = modRepo.addIngredientOverride(recipeId, 'butter', 'coconut oil');

    expect(mod.ingredientOverrides.length).toBe(1);
    expect(mod.ingredientOverrides[0]).toEqual({ original: 'butter', replacement: 'coconut oil' });
  } finally {
    cleanup();
  }
});

test('addIngredientOverride is case-insensitive for replacement', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.addIngredientOverride(recipeId, 'Butter', 'margarine');
    const mod = modRepo.addIngredientOverride(recipeId, 'BUTTER', 'olive oil');

    // Should replace the existing override
    expect(mod.ingredientOverrides.length).toBe(1);
    expect(mod.ingredientOverrides[0].replacement).toBe('olive oil');
  } finally {
    cleanup();
  }
});

test('removeIngredientOverride removes override', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.addIngredientOverride(recipeId, 'butter', 'margarine');
    modRepo.addIngredientOverride(recipeId, 'milk', 'oat milk');
    const mod = modRepo.removeIngredientOverride(recipeId, 'butter');

    expect(mod?.ingredientOverrides.length).toBe(1);
    expect(mod?.ingredientOverrides[0]).toEqual({ original: 'milk', replacement: 'oat milk' });
  } finally {
    cleanup();
  }
});

test('removeIngredientOverride is case-insensitive', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.addIngredientOverride(recipeId, 'Butter', 'margarine');
    const mod = modRepo.removeIngredientOverride(recipeId, 'BUTTER');

    expect(mod?.ingredientOverrides.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('removeIngredientOverride returns null for non-existent modification', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');
    const result = modRepo.removeIngredientOverride(recipeId, 'butter');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('clearIngredientOverrides clears all overrides', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.addIngredientOverride(recipeId, 'butter', 'margarine');
    modRepo.addIngredientOverride(recipeId, 'milk', 'oat milk');
    modRepo.addIngredientOverride(recipeId, 'cream', 'coconut cream');

    const mod = modRepo.clearIngredientOverrides(recipeId);

    expect(mod?.ingredientOverrides).toEqual([]);
  } finally {
    cleanup();
  }
});

test('clearIngredientOverrides returns null for non-existent modification', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');
    const result = modRepo.clearIngredientOverrides(recipeId);
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== delete Tests ====================

test('delete removes modification', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.upsert({
      recipeId,
      userNotes: 'Notes to delete',
    });

    const deleted = modRepo.delete(recipeId);

    expect(deleted).toBe(true);
    expect(modRepo.getByRecipeId(recipeId)).toBeNull();
  } finally {
    cleanup();
  }
});

test('delete returns false for non-existent modification', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');
    const result = modRepo.delete(recipeId);
    expect(result).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== hasModifications Tests ====================

test('hasModifications returns true when modifications exist', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

    modRepo.upsert({
      recipeId,
      userNotes: 'Some notes',
    });

    expect(modRepo.hasModifications(recipeId)).toBe(true);
  } finally {
    cleanup();
  }
});

test('hasModifications returns false when no modifications', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');
    expect(modRepo.hasModifications(recipeId)).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== listAll Tests ====================

test('listAll returns all modifications', () => {
  const { modRepo, recipeRepo, cleanup } = setupTestDb();
  try {
    const recipe1 = createTestRecipe(recipeRepo, 'Recipe 1');
    const recipe2 = createTestRecipe(recipeRepo, 'Recipe 2');
    const recipe3 = createTestRecipe(recipeRepo, 'Recipe 3');

    modRepo.upsert({ recipeId: recipe1, userNotes: 'Notes 1' });
    modRepo.upsert({ recipeId: recipe2, userNotes: 'Notes 2' });
    modRepo.upsert({ recipeId: recipe3, userNotes: 'Notes 3' });

    const all = modRepo.listAll();

    expect(all.length).toBe(3);
  } finally {
    cleanup();
  }
});

test('listAll returns modifications sorted by updatedAt descending', () => {
  const { modRepo, recipeRepo, db, cleanup } = setupTestDb();
  try {
    const recipe1 = createTestRecipe(recipeRepo, 'Recipe 1');
    const recipe2 = createTestRecipe(recipeRepo, 'Recipe 2');
    const recipe3 = createTestRecipe(recipeRepo, 'Recipe 3');

    modRepo.upsert({ recipeId: recipe1, userNotes: 'Notes 1' });
    modRepo.upsert({ recipeId: recipe2, userNotes: 'Notes 2' });
    modRepo.upsert({ recipeId: recipe3, userNotes: 'Notes 3' });

    // Set specific timestamps
    db.prepare('UPDATE recipe_modifications SET updated_at = ? WHERE recipe_id = ?')
      .run('2024-01-01T00:00:00.000Z', recipe1);
    db.prepare('UPDATE recipe_modifications SET updated_at = ? WHERE recipe_id = ?')
      .run('2024-01-03T00:00:00.000Z', recipe2);
    db.prepare('UPDATE recipe_modifications SET updated_at = ? WHERE recipe_id = ?')
      .run('2024-01-02T00:00:00.000Z', recipe3);

    const all = modRepo.listAll();

    // Most recently updated first
    expect(all[0].recipeId).toBe(recipe2);
    expect(all[1].recipeId).toBe(recipe3);
    expect(all[2].recipeId).toBe(recipe1);
  } finally {
    cleanup();
  }
});

test('listAll returns empty array when no modifications', () => {
  const { modRepo, cleanup } = setupTestDb();
  try {
    const all = modRepo.listAll();
    expect(all).toEqual([]);
  } finally {
    cleanup();
  }
});

// ==================== Integration Tests ====================

describe('RecipeModificationRepository integration', () => {
  test('complete modification workflow', () => {
    const { modRepo, recipeRepo, cleanup } = setupTestDb();
    try {
      const recipeId = createTestRecipe(recipeRepo, 'Pasta Carbonara');

      // Initially no modifications
      expect(modRepo.hasModifications(recipeId)).toBe(false);

      // Add user notes
      modRepo.setUserNotes(recipeId, 'Family favorite!');
      expect(modRepo.hasModifications(recipeId)).toBe(true);

      // Add ingredient overrides
      modRepo.addIngredientOverride(recipeId, 'bacon', 'turkey bacon');
      modRepo.addIngredientOverride(recipeId, 'parmesan', 'pecorino romano');

      // Get full modification
      const mod = modRepo.getByRecipeId(recipeId);
      expect(mod?.userNotes).toBe('Family favorite!');
      expect(mod?.ingredientOverrides.length).toBe(2);

      // Update an override
      modRepo.addIngredientOverride(recipeId, 'bacon', 'pancetta');
      const updated = modRepo.getByRecipeId(recipeId);
      const baconOverride = updated?.ingredientOverrides.find(o => o.original === 'bacon');
      expect(baconOverride?.replacement).toBe('pancetta');

      // Remove one override
      modRepo.removeIngredientOverride(recipeId, 'parmesan');
      expect(modRepo.getByRecipeId(recipeId)?.ingredientOverrides.length).toBe(1);

      // Add instruction notes
      modRepo.upsert({
        recipeId,
        instructionNotes: 'Use extra garlic',
      });
      expect(modRepo.getByRecipeId(recipeId)?.instructionNotes).toBe('Use extra garlic');

      // Delete all modifications
      modRepo.delete(recipeId);
      expect(modRepo.hasModifications(recipeId)).toBe(false);
    } finally {
      cleanup();
    }
  });

  test('modifications for multiple recipes', () => {
    const { modRepo, recipeRepo, cleanup } = setupTestDb();
    try {
      const pasta = createTestRecipe(recipeRepo, 'Pasta');
      const soup = createTestRecipe(recipeRepo, 'Soup');
      const salad = createTestRecipe(recipeRepo, 'Salad');

      // Add modifications to different recipes
      modRepo.setUserNotes(pasta, 'Add extra cheese');
      modRepo.addIngredientOverride(soup, 'chicken broth', 'vegetable broth');
      modRepo.upsert({
        recipeId: salad,
        userNotes: 'Double the dressing',
        ingredientOverrides: [{ original: 'romaine', replacement: 'kale' }],
      });

      // Verify each recipe has its own modifications
      expect(modRepo.getByRecipeId(pasta)?.userNotes).toBe('Add extra cheese');
      expect(modRepo.getByRecipeId(pasta)?.ingredientOverrides).toEqual([]);

      expect(modRepo.getByRecipeId(soup)?.userNotes).toBeNull();
      expect(modRepo.getByRecipeId(soup)?.ingredientOverrides.length).toBe(1);

      expect(modRepo.getByRecipeId(salad)?.userNotes).toBe('Double the dressing');
      expect(modRepo.getByRecipeId(salad)?.ingredientOverrides.length).toBe(1);

      // List all
      expect(modRepo.listAll().length).toBe(3);

      // Delete one
      modRepo.delete(soup);
      expect(modRepo.listAll().length).toBe(2);
      expect(modRepo.hasModifications(soup)).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe('RecipeModificationRepository edge cases', () => {
  test('handles special characters in notes', () => {
    const { modRepo, recipeRepo, cleanup } = setupTestDb();
    try {
      const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

      modRepo.setUserNotes(recipeId, 'Use "extra" garlic & onions! <3');

      const mod = modRepo.getByRecipeId(recipeId);
      expect(mod?.userNotes).toBe('Use "extra" garlic & onions! <3');
    } finally {
      cleanup();
    }
  });

  test('handles unicode in notes', () => {
    const { modRepo, recipeRepo, cleanup } = setupTestDb();
    try {
      const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

      modRepo.setUserNotes(recipeId, 'Add jalape\u00f1os y crema');

      const mod = modRepo.getByRecipeId(recipeId);
      expect(mod?.userNotes).toBe('Add jalape\u00f1os y crema');
    } finally {
      cleanup();
    }
  });

  test('handles very long notes', () => {
    const { modRepo, recipeRepo, cleanup } = setupTestDb();
    try {
      const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');
      const longNotes = 'A'.repeat(5000);

      modRepo.setUserNotes(recipeId, longNotes);

      const mod = modRepo.getByRecipeId(recipeId);
      expect(mod?.userNotes).toBe(longNotes);
    } finally {
      cleanup();
    }
  });

  test('handles many ingredient overrides', () => {
    const { modRepo, recipeRepo, cleanup } = setupTestDb();
    try {
      const recipeId = createTestRecipe(recipeRepo, 'Test Recipe');

      // Add 20 overrides
      for (let i = 0; i < 20; i++) {
        modRepo.addIngredientOverride(recipeId, `ingredient_${i}`, `replacement_${i}`);
      }

      const mod = modRepo.getByRecipeId(recipeId);
      expect(mod?.ingredientOverrides.length).toBe(20);
    } finally {
      cleanup();
    }
  });
});
