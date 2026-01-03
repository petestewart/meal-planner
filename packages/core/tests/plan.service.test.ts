/**
 * Unit tests for PlanService
 *
 * Tests that service methods correctly call repository methods
 * and that audit entries are created for create/update/delete operations.
 */

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { PlanService } from '../src/services/plan.service.js';
import type { Database } from 'better-sqlite3';
import type { MealType, PlanStatus } from '../src/models/index.js';

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

function assertThrows(fn: () => void, expectedMessage: string): void {
  let threw = false;
  let actualMessage = '';
  try {
    fn();
  } catch (error) {
    threw = true;
    actualMessage = (error as Error).message;
  }
  if (!threw) {
    throw new Error(`Expected function to throw, but it did not`);
  }
  if (!actualMessage.includes(expectedMessage)) {
    throw new Error(
      `Expected error message to contain "${expectedMessage}", but got "${actualMessage}"`
    );
  }
}

// Database setup helper
function setupTestDb(): { db: Database; service: PlanService; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const service = new PlanService(db);

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

// Helper to create a test recipe
function createTestRecipe(db: Database, title: string): string {
  const id = `recipe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO recipes (id, title, instructions, servings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, title, 'Test instructions', 4, now, now);
  return id;
}

// =====================
// Plan CRUD Tests
// =====================

test('createPlan creates plan and returns it', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const plan = service.createPlan({
      week: '2025-W02',
      status: 'draft',
      notes: 'Test plan',
    });

    assertNotNull(plan, 'plan should be created');
    assertEqual(plan.week, '2025-W02', 'week should match');
    assertEqual(plan.status, 'draft', 'status should be draft');
    assertEqual(plan.notes, 'Test plan', 'notes should match');
    assert(plan.id.length > 0, 'id should be generated');
  } finally {
    cleanup();
  }
});

test('createPlan creates audit log entry', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const plan = service.createPlan(
      {
        week: '2025-W03',
        status: 'draft',
        notes: null,
      },
      'cli'
    );

    const auditEntries = getAuditEntries(db, plan.id);
    assertEqual(auditEntries.length, 1, 'should have 1 audit entry');
    assertEqual(auditEntries[0].action, 'create', 'action should be create');
    assertEqual(auditEntries[0].actor, 'cli', 'actor should be cli');
    assertEqual(auditEntries[0].entity_type, 'weekly_plan', 'entity_type should be weekly_plan');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.week, '2025-W03', 'details should include week');
    assertEqual(details.status, 'draft', 'details should include status');
  } finally {
    cleanup();
  }
});

test('getPlan returns plan with items', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(db, 'Test Recipe');
    const created = service.createPlan({
      week: '2025-W04',
      status: 'draft',
      notes: null,
    });

    service.setMeal(created.id, 1, 'dinner', recipeId);

    const fetched = service.getPlan(created.id);
    assertNotNull(fetched, 'should find plan');
    assertEqual(fetched.id, created.id, 'id should match');
    assertEqual(fetched.items?.length, 1, 'should have 1 item');
  } finally {
    cleanup();
  }
});

test('getPlan returns null for non-existent plan', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.getPlan('non-existent-id');
    assertEqual(result, null, 'should return null');
  } finally {
    cleanup();
  }
});

test('getPlanByWeek returns plan by week string', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const created = service.createPlan({
      week: '2025-W05',
      status: 'active',
      notes: 'Week 5 plan',
    });

    const fetched = service.getPlanByWeek('2025-W05');
    assertNotNull(fetched, 'should find plan');
    assertEqual(fetched.id, created.id, 'id should match');
    assertEqual(fetched.status, 'active', 'status should match');
  } finally {
    cleanup();
  }
});

test('getPlanByWeek returns null for non-existent week', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.getPlanByWeek('2099-W01');
    assertEqual(result, null, 'should return null');
  } finally {
    cleanup();
  }
});

test('listPlans returns all plans', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.createPlan({ week: '2025-W10', status: 'draft', notes: null });
    service.createPlan({ week: '2025-W11', status: 'active', notes: null });
    service.createPlan({ week: '2025-W12', status: 'completed', notes: null });

    const plans = service.listPlans();
    assertEqual(plans.length, 3, 'should have 3 plans');
  } finally {
    cleanup();
  }
});

test('listPlans filters by status', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.createPlan({ week: '2025-W20', status: 'draft', notes: null });
    service.createPlan({ week: '2025-W21', status: 'active', notes: null });
    service.createPlan({ week: '2025-W22', status: 'draft', notes: null });

    const draftPlans = service.listPlans({ status: 'draft' });
    assertEqual(draftPlans.length, 2, 'should have 2 draft plans');

    const activePlans = service.listPlans({ status: 'active' });
    assertEqual(activePlans.length, 1, 'should have 1 active plan');
  } finally {
    cleanup();
  }
});

test('updatePlan updates plan and creates audit log', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const created = service.createPlan({
      week: '2025-W06',
      status: 'draft',
      notes: 'Original notes',
    });

    const updated = service.updatePlan(
      {
        id: created.id,
        notes: 'Updated notes',
      },
      'user'
    );

    assertNotNull(updated, 'should return updated plan');
    assertEqual(updated.notes, 'Updated notes', 'notes should be updated');

    const auditEntries = getAuditEntries(db, created.id);
    assertEqual(auditEntries.length, 2, 'should have 2 audit entries (create + update)');
    assertEqual(auditEntries[0].action, 'update', 'most recent should be update');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.notes, 'Updated notes', 'details should include notes');
  } finally {
    cleanup();
  }
});

test('updatePlan returns null for non-existent plan without logging', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const countBefore = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    const result = service.updatePlan({ id: 'non-existent-id', notes: 'New notes' });

    const countAfter = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    assertEqual(result, null, 'should return null');
    assertEqual(countAfter, countBefore, 'should not create audit entry');
  } finally {
    cleanup();
  }
});

test('deletePlan deletes plan and creates audit log', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const created = service.createPlan({
      week: '2025-W07',
      status: 'draft',
      notes: null,
    });

    const deleted = service.deletePlan(created.id, 'cli');

    assertEqual(deleted, true, 'delete should return true');

    // Plan should be gone
    const fetched = service.getPlan(created.id);
    assertEqual(fetched, null, 'deleted plan should not be found');

    // But audit log should have the delete entry
    const auditEntries = getAuditEntries(db, created.id);
    assertEqual(auditEntries.length, 2, 'should have 2 audit entries (create + delete)');
    assertEqual(auditEntries[0].action, 'delete', 'most recent should be delete');
    assertEqual(auditEntries[0].actor, 'cli', 'actor should be cli');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.week, '2025-W07', 'details should include week');
  } finally {
    cleanup();
  }
});

test('deletePlan returns false for non-existent plan without logging', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const countBefore = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    const result = service.deletePlan('non-existent-id', 'user');

    const countAfter = (
      db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as { count: number }
    ).count;

    assertEqual(result, false, 'delete should return false');
    assertEqual(countAfter, countBefore, 'should not create audit entry');
  } finally {
    cleanup();
  }
});

// =====================
// Status Tests
// =====================

test('setStatus changes status and creates audit log', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const created = service.createPlan({
      week: '2025-W08',
      status: 'draft',
      notes: null,
    });

    const updated = service.setStatus(created.id, 'active', 'api');

    assertNotNull(updated, 'should return updated plan');
    assertEqual(updated.status, 'active', 'status should be active');

    const auditEntries = getAuditEntries(db, created.id);
    assertEqual(auditEntries.length, 2, 'should have 2 audit entries');
    assertEqual(auditEntries[0].action, 'update', 'most recent should be update');
    assertEqual(auditEntries[0].actor, 'api', 'actor should be api');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.statusChange.from, 'draft', 'should have from status');
    assertEqual(details.statusChange.to, 'active', 'should have to status');
  } finally {
    cleanup();
  }
});

test('setStatus returns null for non-existent plan', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.setStatus('non-existent-id', 'active');
    assertEqual(result, null, 'should return null');
  } finally {
    cleanup();
  }
});

test('setStatus allows any transition', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const plan = service.createPlan({
      week: '2025-W09',
      status: 'draft',
      notes: null,
    });

    // draft -> active
    let updated = service.setStatus(plan.id, 'active');
    assertNotNull(updated, 'should update to active');
    assertEqual(updated.status, 'active', 'status should be active');

    // active -> completed
    updated = service.setStatus(plan.id, 'completed');
    assertNotNull(updated, 'should update to completed');
    assertEqual(updated.status, 'completed', 'status should be completed');

    // completed -> draft (allowed - no restrictions in spec)
    updated = service.setStatus(plan.id, 'draft');
    assertNotNull(updated, 'should update to draft');
    assertEqual(updated.status, 'draft', 'status should be draft');
  } finally {
    cleanup();
  }
});

// =====================
// Meal Assignment Tests
// =====================

test('setMeal sets meal and creates audit log', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(db, 'Test Recipe');
    const plan = service.createPlan({
      week: '2025-W15',
      status: 'draft',
      notes: null,
    });

    const item = service.setMeal(plan.id, 1, 'dinner', recipeId, 4, 'Test notes', 'user');

    assertNotNull(item, 'should return plan item');
    assertEqual(item.planId, plan.id, 'planId should match');
    assertEqual(item.dayOfWeek, 1, 'dayOfWeek should be 1');
    assertEqual(item.mealType, 'dinner', 'mealType should be dinner');
    assertEqual(item.recipeId, recipeId, 'recipeId should match');
    assertEqual(item.servings, 4, 'servings should be 4');
    assertEqual(item.notes, 'Test notes', 'notes should match');

    const auditEntries = getAuditEntries(db, item.id);
    assertEqual(auditEntries.length, 1, 'should have 1 audit entry for item');
    assertEqual(auditEntries[0].action, 'update', 'action should be update');
    assertEqual(auditEntries[0].entity_type, 'plan_item', 'entity_type should be plan_item');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.planId, plan.id, 'details should include planId');
    assertEqual(details.dayOfWeek, 1, 'details should include dayOfWeek');
    assertEqual(details.mealType, 'dinner', 'details should include mealType');
    assertEqual(details.recipeId, recipeId, 'details should include recipeId');
  } finally {
    cleanup();
  }
});

test('setMeal with null recipeId works', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const plan = service.createPlan({
      week: '2025-W16',
      status: 'draft',
      notes: null,
    });

    const item = service.setMeal(plan.id, 2, 'lunch', null, 2, 'Leftovers');

    assertNotNull(item, 'should return plan item');
    assertEqual(item.recipeId, null, 'recipeId should be null');
    assertEqual(item.notes, 'Leftovers', 'notes should match');
  } finally {
    cleanup();
  }
});

test('setMeal returns null for non-existent plan', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(db, 'Test Recipe');
    const result = service.setMeal('non-existent-id', 1, 'dinner', recipeId);
    assertEqual(result, null, 'should return null');
  } finally {
    cleanup();
  }
});

test('setMeal throws error for non-existent recipe', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const plan = service.createPlan({
      week: '2025-W17',
      status: 'draft',
      notes: null,
    });

    assertThrows(
      () => service.setMeal(plan.id, 1, 'dinner', 'non-existent-recipe'),
      'Recipe non-existent-recipe not found'
    );
  } finally {
    cleanup();
  }
});

test('setMeal updates existing meal at same slot', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const recipe1 = createTestRecipe(db, 'Recipe 1');
    const recipe2 = createTestRecipe(db, 'Recipe 2');
    const plan = service.createPlan({
      week: '2025-W18',
      status: 'draft',
      notes: null,
    });

    const item1 = service.setMeal(plan.id, 1, 'dinner', recipe1);
    assertNotNull(item1, 'should set first meal');

    const item2 = service.setMeal(plan.id, 1, 'dinner', recipe2);
    assertNotNull(item2, 'should update meal');

    // Should have same ID (update, not insert)
    assertEqual(item2.id, item1.id, 'should have same ID');
    assertEqual(item2.recipeId, recipe2, 'recipeId should be updated');
  } finally {
    cleanup();
  }
});

test('removeMeal removes meal and creates audit log', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(db, 'Test Recipe');
    const plan = service.createPlan({
      week: '2025-W19',
      status: 'draft',
      notes: null,
    });

    const item = service.setMeal(plan.id, 1, 'dinner', recipeId);
    assertNotNull(item, 'should set meal');

    const removed = service.removeMeal(plan.id, 1, 'dinner', 'cli');

    assertEqual(removed, true, 'removeMeal should return true');

    // Verify meal is gone
    const updatedPlan = service.getPlan(plan.id);
    assertNotNull(updatedPlan, 'plan should exist');
    assertEqual(updatedPlan.items?.length ?? 0, 0, 'should have no items');

    // Check audit log
    const auditEntries = getAuditEntries(db, item.id);
    assertEqual(auditEntries.length, 2, 'should have 2 audit entries (set + remove)');
    assertEqual(auditEntries[0].action, 'delete', 'most recent should be delete');
    assertEqual(auditEntries[0].actor, 'cli', 'actor should be cli');
    assertEqual(auditEntries[0].entity_type, 'plan_item', 'entity_type should be plan_item');

    const details = JSON.parse(auditEntries[0].details!);
    assertEqual(details.planId, plan.id, 'details should include planId');
    assertEqual(details.dayOfWeek, 1, 'details should include dayOfWeek');
    assertEqual(details.mealType, 'dinner', 'details should include mealType');
  } finally {
    cleanup();
  }
});

test('removeMeal returns false for non-existent meal', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const plan = service.createPlan({
      week: '2025-W25',
      status: 'draft',
      notes: null,
    });

    const result = service.removeMeal(plan.id, 1, 'dinner');
    assertEqual(result, false, 'should return false');
  } finally {
    cleanup();
  }
});

// =====================
// Utility Tests
// =====================

test('planExists returns correct value', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const created = service.createPlan({
      week: '2025-W26',
      status: 'draft',
      notes: null,
    });

    assertEqual(service.planExists(created.id), true, 'should return true for existing');
    assertEqual(
      service.planExists('non-existent-id'),
      false,
      'should return false for non-existent'
    );
  } finally {
    cleanup();
  }
});

test('countPlans returns correct count', () => {
  const { service, cleanup } = setupTestDb();
  try {
    assertEqual(service.countPlans(), 0, 'should start with 0');

    service.createPlan({ week: '2025-W27', status: 'draft', notes: null });
    service.createPlan({ week: '2025-W28', status: 'active', notes: null });

    assertEqual(service.countPlans(), 2, 'should have 2 plans');
    assertEqual(service.countPlans({ status: 'draft' }), 1, 'should have 1 draft plan');
  } finally {
    cleanup();
  }
});

test('getPlanAuditLog returns audit entries for plan', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const plan = service.createPlan({
      week: '2025-W29',
      status: 'draft',
      notes: null,
    });

    service.updatePlan({ id: plan.id, notes: 'Updated' });
    service.setStatus(plan.id, 'active');

    const auditLog = service.getPlanAuditLog(plan.id);

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
    const plan = service.createPlan({
      week: '2025-W30',
      status: 'draft',
      notes: null,
    });

    const auditEntries = getAuditEntries(db, plan.id);
    assertEqual(auditEntries[0].actor, 'user', 'default actor should be user');
  } finally {
    cleanup();
  }
});

test('supports all actor types', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const actors = ['user', 'cli', 'api', 'agent:curator', 'agent:planner'];

    for (let i = 0; i < actors.length; i++) {
      const actor = actors[i];
      const plan = service.createPlan(
        {
          week: `2025-W3${i + 1}`,
          status: 'draft',
          notes: null,
        },
        actor
      );

      const auditEntries = getAuditEntries(db, plan.id);
      assertEqual(auditEntries[0].actor, actor, `actor should be ${actor}`);
    }
  } finally {
    cleanup();
  }
});

// Run all tests
console.log('Running PlanService unit tests...');
console.log('');
runTests();
