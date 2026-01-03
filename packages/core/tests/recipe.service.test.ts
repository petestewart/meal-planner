/**
 * Unit tests for RecipeService
 *
 * Tests that service methods correctly call repository methods
 * and that audit entries are created for create/update/delete operations.
 */

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { RecipeService } from '../src/services/recipe.service.js';
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

    assertNotNull(recipe, 'recipe should be created');
    assertEqual(recipe.title, 'Test Recipe', 'title should match');
    assert(recipe.id.length > 0, 'id should be generated');
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
    assertEqual(auditEntries.length, 1, 'should have 1 audit entry');
    assertEqual(auditEntries[0].action, 'create', 'action should be create');
    assertEqual(auditEntries[0].actor, 'cli', 'actor should be cli');
    assertEqual(auditEntries[0].entity_type, 'recipe', 'entity_type should be recipe');
    assertEqual(auditEntries[0].entity_id, recipe.id, 'entity_id should match');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.title, 'Audited Recipe', 'details should include title');
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
    assertEqual(details.ingredientCount, 1, 'ingredientCount should be 1');
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
    assertEqual(auditEntries[0].actor, 'agent:curator', 'actor should be agent:curator');
    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.tagCount, 2, 'tagCount should be 2');
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

    assertNotNull(fetched, 'should find recipe');
    assertEqual(fetched.id, created.id, 'id should match');

    // Verify no new audit entries were created
    const auditEntries = getAuditEntries(db, created.id);
    assertEqual(auditEntries.length, 0, 'should have no audit entries after get');
  } finally {
    cleanup();
  }
});

test('getRecipe returns null for non-existent recipe', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.getRecipe('non-existent-id');
    assertEqual(result, null, 'should return null');
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

    assertEqual(recipes.length, 2, 'should have 2 recipes');
    assertEqual(countAfter, countBefore, 'audit count should not change');
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
    assertEqual(italian.length, 1, 'should have 1 Italian recipe');
    assertEqual(italian[0].title, 'Italian Pasta', 'should be Italian Pasta');
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

    assertNotNull(updated, 'should return updated recipe');
    assertEqual(updated.title, 'Updated Title', 'title should be updated');
    assertEqual(updated.servings, 6, 'servings should be updated');

    const auditEntries = getAuditEntries(db, created.id);
    assertEqual(auditEntries.length, 2, 'should have 2 audit entries (create + update)');
    assertEqual(auditEntries[0].action, 'update', 'most recent should be update');
    assertEqual(auditEntries[0].actor, 'user', 'actor should be user');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.title, 'Updated Title', 'details should include title');
    assertEqual(details.servings, 6, 'details should include servings');
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
    assertNotNull(updateEntry, 'should have update entry');

    const details = JSON.parse(updateEntry.details!);
    assertEqual(details.ingredientsReplaced, true, 'should indicate ingredients replaced');
    assertEqual(details.ingredientCount, 1, 'should have ingredient count');
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
    assertNotNull(updateEntry, 'should have update entry');
    assertEqual(updateEntry.actor, 'agent:planner', 'actor should be agent:planner');

    const details = JSON.parse(updateEntry.details!);
    assertEqual(details.tagsReplaced, true, 'should indicate tags replaced');
    assertEqual(details.tagCount, 1, 'should have tag count');
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

    assertEqual(result, null, 'should return null');
    assertEqual(countAfter, countBefore, 'should not create audit entry');
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

    assertEqual(deleted, true, 'delete should return true');

    // Recipe should be gone
    const fetched = service.getRecipe(created.id);
    assertEqual(fetched, null, 'deleted recipe should not be found');

    // But audit log should have the delete entry
    const auditEntries = getAuditEntries(db, created.id);
    assertEqual(auditEntries.length, 2, 'should have 2 audit entries (create + delete)');
    assertEqual(auditEntries[0].action, 'delete', 'most recent should be delete');
    assertEqual(auditEntries[0].actor, 'cli', 'actor should be cli');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.title, 'Recipe to Delete', 'details should include title');
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

    assertEqual(result, false, 'delete should return false');
    assertEqual(countAfter, countBefore, 'should not create audit entry');
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

    assertEqual(service.recipeExists(created.id), true, 'should return true for existing');
    assertEqual(
      service.recipeExists('non-existent-id'),
      false,
      'should return false for non-existent'
    );
  } finally {
    cleanup();
  }
});

test('countRecipes returns correct count', () => {
  const { service, cleanup } = setupTestDb();
  try {
    assertEqual(service.countRecipes(), 0, 'should start with 0');

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

    assertEqual(service.countRecipes(), 2, 'should have 2 recipes');
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

    assertEqual(auditLog.length, 3, 'should have 3 audit entries');
    assertEqual(auditLog[0].action, 'update', 'first should be most recent update');
    assertEqual(auditLog[2].action, 'create', 'last should be create');
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
    assertEqual(auditEntries[0].actor, 'user', 'default actor should be user');
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
      assertEqual(auditEntries[0].actor, actor, `actor should be ${actor}`);
    }
  } finally {
    cleanup();
  }
});

// Run all tests
console.log('Running RecipeService unit tests...');
console.log('');
runTests();
