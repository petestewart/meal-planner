/**
 * Unit tests for RecipeService
 *
 * Tests that service methods correctly call repository methods
 * and that audit entries are created for create/update/delete operations.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { RecipeService } from '../src/services/recipe.service.js';
import type { Database } from 'better-sqlite3';

// Database setup helper
function setupTestDb(): { db: Database; service: RecipeService; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const service = new RecipeService(db);

  return {
    db,
    service,
    cleanup: () => closeDb(db),
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

// =====================
// Service Method Tests
// =====================

test('createRecipe calls repo and returns recipe', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const recipe = service.createRecipe({
      title: 'Test Recipe',
      instructions: 'Mix and cook.',
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
    expect(recipe.id.length > 0).toBe(true);
  } finally {
    cleanup();
  }
});

test('createRecipe creates audit log entry', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const recipe = service.createRecipe(
      {
        title: 'Audited Recipe',
        instructions: 'Instructions here.',
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
      undefined,
      'cli'
    );

    const auditEntries = getAuditEntries(db, recipe.id);
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].action).toBe('create');
    expect(auditEntries[0].actor).toBe('cli');
    expect(auditEntries[0].entity_type).toBe('recipe');
    expect(auditEntries[0].entity_id).toBe(recipe.id);

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.title).toBe('Audited Recipe');
  } finally {
    cleanup();
  }
});

test('createRecipe with ingredients logs ingredient count', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(db, 'Flour');

    const recipe = service.createRecipe(
      {
        title: 'Recipe with Ingredients',
        instructions: 'Mix ingredients.',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      },
      [{ ingredientId, quantity: 2, unit: 'cups', notes: null, optional: false }],
      undefined,
      'api'
    );

    const auditEntries = getAuditEntries(db, recipe.id);
    const details = JSON.parse(auditEntries[0].details!);
    expect(details.ingredientCount).toBe(1);
  } finally {
    cleanup();
  }
});

test('createRecipe with tags logs tag count', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const tagId1 = createTestTag(db, 'Dinner');
    const tagId2 = createTestTag(db, 'Quick');

    const recipe = service.createRecipe(
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
      [tagId1, tagId2],
      'agent:curator'
    );

    const auditEntries = getAuditEntries(db, recipe.id);
    expect(auditEntries[0].actor).toBe('agent:curator');
    const details = JSON.parse(auditEntries[0].details!);
    expect(details.tagCount).toBe(2);
  } finally {
    cleanup();
  }
});

test('getRecipe returns recipe without audit logging', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const created = service.createRecipe({
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

    // Clear audit log to verify getRecipe doesn't create entries
    db.prepare('DELETE FROM audit_log').run();

    const fetched = service.getRecipe(created.id);

    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);

    // Verify no new audit entries were created
    const auditEntries = getAuditEntries(db, created.id);
    expect(auditEntries.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('getRecipe returns null for non-existent recipe', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.getRecipe('non-existent-id');
    expect(result).toBe(null);
  } finally {
    cleanup();
  }
});

test('listRecipes returns recipes without audit logging', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    service.createRecipe({
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
    service.createRecipe({
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

    // Get count of audit entries before list
    const countBefore = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    const recipes = service.listRecipes();

    // Verify no new audit entries
    const countAfter = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    expect(recipes.length).toBe(2);
    expect(countAfter).toBe(countBefore);
  } finally {
    cleanup();
  }
});

test('listRecipes with filters works correctly', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.createRecipe({
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
    service.createRecipe({
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

    const italian = service.listRecipes({ cuisine: 'Italian' });
    expect(italian.length).toBe(1);
    expect(italian[0].title).toBe('Italian Pasta');
  } finally {
    cleanup();
  }
});

test('updateRecipe calls repo and creates audit log entry', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const created = service.createRecipe({
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

    const updated = service.updateRecipe(
      {
        id: created.id,
        title: 'Updated Title',
        servings: 6,
      },
      undefined,
      undefined,
      'user'
    );

    expect(updated).toBeDefined();
    expect(updated.title).toBe('Updated Title');
    expect(updated.servings).toBe(6);

    const auditEntries = getAuditEntries(db, created.id);
    expect(auditEntries.length).toBe(2);
    expect(auditEntries[0].action).toBe('update');
    expect(auditEntries[0].actor).toBe('user');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.title).toBe('Updated Title');
    expect(details.servings).toBe(6);
  } finally {
    cleanup();
  }
});

test('updateRecipe logs ingredient replacement', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(db, 'Flour');

    const created = service.createRecipe({
      title: 'Recipe',
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

    service.updateRecipe(
      { id: created.id },
      [{ ingredientId, quantity: 2, unit: 'cups', notes: null, optional: false }],
      undefined,
      'api'
    );

    const auditEntries = getAuditEntries(db, created.id);
    const updateEntry = auditEntries.find((e) => e.action === 'update');
    expect(updateEntry).toBeDefined();

    const details = JSON.parse(updateEntry.details!);
    expect(details.ingredientsReplaced).toBe(true);
    expect(details.ingredientCount).toBe(1);
  } finally {
    cleanup();
  }
});

test('updateRecipe logs tag replacement', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const tagId = createTestTag(db, 'Quick');

    const created = service.createRecipe({
      title: 'Recipe',
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

    service.updateRecipe({ id: created.id }, undefined, [tagId], 'agent:planner');

    const auditEntries = getAuditEntries(db, created.id);
    const updateEntry = auditEntries.find((e) => e.action === 'update');
    expect(updateEntry).toBeDefined();
    expect(updateEntry.actor).toBe('agent:planner');

    const details = JSON.parse(updateEntry.details!);
    expect(details.tagsReplaced).toBe(true);
    expect(details.tagCount).toBe(1);
  } finally {
    cleanup();
  }
});

test('updateRecipe returns null for non-existent recipe without logging', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const countBefore = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    const result = service.updateRecipe({ id: 'non-existent-id', title: 'New Title' });

    const countAfter = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    expect(result).toBe(null);
    expect(countAfter).toBe(countBefore);
  } finally {
    cleanup();
  }
});

test('deleteRecipe calls repo and creates audit log entry', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const created = service.createRecipe({
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

    const deleted = service.deleteRecipe(created.id, 'cli');

    expect(deleted).toBe(true);

    // Recipe should be gone
    const fetched = service.getRecipe(created.id);
    expect(fetched).toBe(null);

    // But audit log should have the delete entry
    const auditEntries = getAuditEntries(db, created.id);
    expect(auditEntries.length).toBe(2);
    expect(auditEntries[0].action).toBe('delete');
    expect(auditEntries[0].actor).toBe('cli');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.title).toBe('Recipe to Delete');
  } finally {
    cleanup();
  }
});

test('deleteRecipe returns false for non-existent recipe without logging', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const countBefore = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    const result = service.deleteRecipe('non-existent-id', 'user');

    const countAfter = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    expect(result).toBe(false);
    expect(countAfter).toBe(countBefore);
  } finally {
    cleanup();
  }
});

test('recipeExists returns correct value', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const created = service.createRecipe({
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

    expect(service.recipeExists(created.id)).toBe(true);
    expect(service.recipeExists('non-existent-id')).toBe(false);
  } finally {
    cleanup();
  }
});

test('countRecipes returns correct count', () => {
  const { service, cleanup } = setupTestDb();
  try {
    expect(service.countRecipes()).toBe(0);

    service.createRecipe({
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
    service.createRecipe({
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

    expect(service.countRecipes()).toBe(2);
  } finally {
    cleanup();
  }
});

test('getRecipeAuditLog returns audit entries for recipe', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const recipe = service.createRecipe({
      title: 'Audited Recipe',
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

    service.updateRecipe({ id: recipe.id, title: 'Updated' });
    service.updateRecipe({ id: recipe.id, servings: 8 });

    const auditLog = service.getRecipeAuditLog(recipe.id);

    expect(auditLog.length).toBe(3);
    expect(auditLog[0].action).toBe('update');
    expect(auditLog[2].action).toBe('create');
  } finally {
    cleanup();
  }
});

test('default actor is user when not specified', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const recipe = service.createRecipe({
      title: 'Default Actor Recipe',
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

    const auditEntries = getAuditEntries(db, recipe.id);
    expect(auditEntries[0].actor).toBe('user');
  } finally {
    cleanup();
  }
});

test('supports all actor types', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const actors = ['user', 'cli', 'api', 'agent:curator', 'agent:planner'];

    for (const actor of actors) {
      const recipe = service.createRecipe(
        {
          title: `Recipe by ${actor}`,
          instructions: 'Instructions',
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
        undefined,
        actor
      );

      const auditEntries = getAuditEntries(db, recipe.id);
      expect(auditEntries[0].actor).toBe(actor);
    }
  } finally {
    cleanup();
  }
});

// =====================
// Scale Recipe Tests
// =====================

describe('scaleRecipe', () => {
  test('scaleRecipe doubles quantities when doubling servings', () => {
    const { db, service, cleanup } = setupTestDb();
    try {
      const ingredientId = createTestIngredient(db, 'Flour', 'Pantry');

      const recipe = service.createRecipe(
        {
          title: 'Scalable Recipe',
          instructions: 'Mix ingredients',
          servings: 4,
          description: null,
          prepTimeMinutes: null,
          cookTimeMinutes: null,
          sourceUrl: null,
          sourceType: null,
          cuisine: null,
          difficulty: null,
        },
        [{ ingredientId, quantity: 2, unit: 'cups', notes: null, optional: false }]
      );

      const scaled = service.scaleRecipe(recipe.id, 8);

      expect(scaled).not.toBeNull();
      expect(scaled!.servings).toBe(8);
      expect(scaled!.ingredients![0].quantity).toBe(4); // 2 cups * 2 = 4 cups
    } finally {
      cleanup();
    }
  });

  test('scaleRecipe halves quantities when halving servings', () => {
    const { db, service, cleanup } = setupTestDb();
    try {
      const ingredientId = createTestIngredient(db, 'Sugar', 'Pantry');

      const recipe = service.createRecipe(
        {
          title: 'Recipe',
          instructions: 'Mix',
          servings: 8,
          description: null,
          prepTimeMinutes: null,
          cookTimeMinutes: null,
          sourceUrl: null,
          sourceType: null,
          cuisine: null,
          difficulty: null,
        },
        [{ ingredientId, quantity: 4, unit: 'pieces', notes: null, optional: false }]
      );

      const scaled = service.scaleRecipe(recipe.id, 4);

      expect(scaled!.servings).toBe(4);
      expect(scaled!.ingredients![0].quantity).toBe(2); // 4 pieces / 2 = 2 pieces
    } finally {
      cleanup();
    }
  });

  test('scaleRecipe handles null quantities', () => {
    const { db, service, cleanup } = setupTestDb();
    try {
      const ingredientId = createTestIngredient(db, 'Salt', 'Pantry');

      const recipe = service.createRecipe(
        {
          title: 'Recipe',
          instructions: 'Season',
          servings: 4,
          description: null,
          prepTimeMinutes: null,
          cookTimeMinutes: null,
          sourceUrl: null,
          sourceType: null,
          cuisine: null,
          difficulty: null,
        },
        [{ ingredientId, quantity: null, unit: null, notes: 'to taste', optional: false }]
      );

      const scaled = service.scaleRecipe(recipe.id, 8);

      expect(scaled!.ingredients![0].quantity).toBeNull();
      expect(scaled!.ingredients![0].notes).toBe('to taste');
    } finally {
      cleanup();
    }
  });

  test('scaleRecipe returns null for non-existent recipe', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const scaled = service.scaleRecipe('non-existent-id', 8);
      expect(scaled).toBeNull();
    } finally {
      cleanup();
    }
  });

  test('scaleRecipe converts large quantities to larger units', () => {
    const { db, service, cleanup } = setupTestDb();
    try {
      const ingredientId = createTestIngredient(db, 'Water', 'Pantry');

      const recipe = service.createRecipe(
        {
          title: 'Recipe',
          instructions: 'Mix',
          servings: 1,
          description: null,
          prepTimeMinutes: null,
          cookTimeMinutes: null,
          sourceUrl: null,
          sourceType: null,
          cuisine: null,
          difficulty: null,
        },
        [{ ingredientId, quantity: 500, unit: 'g', notes: null, optional: false }]
      );

      const scaled = service.scaleRecipe(recipe.id, 4);

      // 500g * 4 = 2000g = 2kg
      expect(scaled!.ingredients![0].quantity).toBe(2);
      expect(scaled!.ingredients![0].unit).toBe('kg');
    } finally {
      cleanup();
    }
  });

  test('scaleRecipe does not modify original recipe', () => {
    const { db, service, cleanup } = setupTestDb();
    try {
      const ingredientId = createTestIngredient(db, 'Butter', 'Dairy');

      const recipe = service.createRecipe(
        {
          title: 'Original',
          instructions: 'Cook',
          servings: 4,
          description: null,
          prepTimeMinutes: null,
          cookTimeMinutes: null,
          sourceUrl: null,
          sourceType: null,
          cuisine: null,
          difficulty: null,
        },
        [{ ingredientId, quantity: 100, unit: 'g', notes: null, optional: false }]
      );

      service.scaleRecipe(recipe.id, 8);

      // Verify original is unchanged
      const original = service.getRecipe(recipe.id);
      expect(original!.servings).toBe(4);
      expect(original!.ingredients![0].quantity).toBe(100);
    } finally {
      cleanup();
    }
  });
});

// =====================
// Toggle Favorite Tests
// =====================

describe('toggleFavorite', () => {
  test('toggleFavorite sets recipe as favorite', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Favorite Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      const updated = service.toggleFavorite(recipe.id);

      expect(updated.isFavorite).toBe(true);
    } finally {
      cleanup();
    }
  });

  test('toggleFavorite unsets favorite', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      // Toggle on
      service.toggleFavorite(recipe.id);
      // Toggle off
      const updated = service.toggleFavorite(recipe.id);

      expect(updated.isFavorite).toBe(false);
    } finally {
      cleanup();
    }
  });

  test('toggleFavorite creates audit log entry', () => {
    const { db, service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      service.toggleFavorite(recipe.id, 'api');

      const auditEntries = getAuditEntries(db, recipe.id);
      const favoriteEntry = auditEntries.find((e) => e.action === 'favorite');
      expect(favoriteEntry).toBeDefined();
      expect(favoriteEntry!.actor).toBe('api');
    } finally {
      cleanup();
    }
  });

  test('toggleFavorite throws for non-existent recipe', () => {
    const { service, cleanup } = setupTestDb();
    try {
      expect(() => service.toggleFavorite('non-existent-id')).toThrow();
    } finally {
      cleanup();
    }
  });

  test('getFavoriteRecipeIds returns favorite IDs', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe1 = service.createRecipe({
        title: 'Recipe 1',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });
      const recipe2 = service.createRecipe({
        title: 'Recipe 2',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      service.toggleFavorite(recipe1.id);

      const favorites = service.getFavoriteRecipeIds();
      expect(favorites).toContain(recipe1.id);
      expect(favorites).not.toContain(recipe2.id);
    } finally {
      cleanup();
    }
  });
});

// =====================
// Modification Tests
// =====================

describe('recipe modifications', () => {
  test('getModifications returns null for recipe without modifications', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      const mods = service.getModifications(recipe.id);
      expect(mods).toBeNull();
    } finally {
      cleanup();
    }
  });

  test('hasModifications returns false for recipe without modifications', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      expect(service.hasModifications(recipe.id)).toBe(false);
    } finally {
      cleanup();
    }
  });

  test('setRecipeNote creates modification', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      const mod = service.setRecipeNote(recipe.id, 'My personal note');

      expect(mod.userNotes).toBe('My personal note');
      expect(service.hasModifications(recipe.id)).toBe(true);
    } finally {
      cleanup();
    }
  });

  test('setRecipeNote throws for non-existent recipe', () => {
    const { service, cleanup } = setupTestDb();
    try {
      expect(() => service.setRecipeNote('non-existent-id', 'Note')).toThrow();
    } finally {
      cleanup();
    }
  });

  test('addIngredientOverride creates override', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      const mod = service.addIngredientOverride(recipe.id, 'butter', 'olive oil');

      expect(mod.ingredientOverrides.length).toBe(1);
      expect(mod.ingredientOverrides[0].original).toBe('butter');
      expect(mod.ingredientOverrides[0].replacement).toBe('olive oil');
    } finally {
      cleanup();
    }
  });

  test('addIngredientOverride throws for non-existent recipe', () => {
    const { service, cleanup } = setupTestDb();
    try {
      expect(() =>
        service.addIngredientOverride('non-existent-id', 'butter', 'oil')
      ).toThrow();
    } finally {
      cleanup();
    }
  });

  test('removeIngredientOverride removes override', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      service.addIngredientOverride(recipe.id, 'butter', 'olive oil');
      const mod = service.removeIngredientOverride(recipe.id, 'butter');

      expect(mod!.ingredientOverrides.length).toBe(0);
    } finally {
      cleanup();
    }
  });

  test('removeIngredientOverride returns null for recipe without modifications', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      const result = service.removeIngredientOverride(recipe.id, 'butter');
      expect(result).toBeNull();
    } finally {
      cleanup();
    }
  });

  test('clearModifications removes all modifications', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      service.setRecipeNote(recipe.id, 'Note');
      service.addIngredientOverride(recipe.id, 'butter', 'oil');

      const deleted = service.clearModifications(recipe.id);

      expect(deleted).toBe(true);
      expect(service.hasModifications(recipe.id)).toBe(false);
    } finally {
      cleanup();
    }
  });

  test('clearModifications returns false for recipe without modifications', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      const deleted = service.clearModifications(recipe.id);
      expect(deleted).toBe(false);
    } finally {
      cleanup();
    }
  });

  test('updateModifications creates/updates modifications', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      const mod = service.updateModifications(recipe.id, {
        userNotes: 'My notes',
        ingredientOverrides: [{ original: 'butter', replacement: 'oil' }],
        instructionNotes: 'Cook longer',
      });

      expect(mod.userNotes).toBe('My notes');
      expect(mod.ingredientOverrides.length).toBe(1);
      expect(mod.instructionNotes).toBe('Cook longer');
    } finally {
      cleanup();
    }
  });

  test('updateModifications throws for non-existent recipe', () => {
    const { service, cleanup } = setupTestDb();
    try {
      expect(() =>
        service.updateModifications('non-existent-id', { userNotes: 'Note' })
      ).toThrow();
    } finally {
      cleanup();
    }
  });

  test('getRecipeWithModifications returns recipe and modifications', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      service.setRecipeNote(recipe.id, 'My note');

      const result = service.getRecipeWithModifications(recipe.id);

      expect(result.recipe).not.toBeNull();
      expect(result.recipe!.title).toBe('Recipe');
      expect(result.modifications).not.toBeNull();
      expect(result.modifications!.userNotes).toBe('My note');
    } finally {
      cleanup();
    }
  });

  test('getRecipeWithModifications returns null modifications when none exist', () => {
    const { service, cleanup } = setupTestDb();
    try {
      const recipe = service.createRecipe({
        title: 'Recipe',
        instructions: 'Cook',
        servings: 4,
        description: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        sourceUrl: null,
        sourceType: null,
        cuisine: null,
        difficulty: null,
      });

      const result = service.getRecipeWithModifications(recipe.id);

      expect(result.recipe).not.toBeNull();
      expect(result.modifications).toBeNull();
    } finally {
      cleanup();
    }
  });
});

