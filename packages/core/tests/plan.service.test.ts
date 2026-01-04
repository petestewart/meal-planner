/**
 * Unit tests for PlanService
 *
 * Tests that service methods correctly call repository methods
 * and that audit entries are created for create/update/delete operations.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { PlanService } from '../src/services/plan.service.js';
import type { Database } from 'better-sqlite3';
import type { MealType, PlanStatus } from '../src/models/index.js';

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

    expect(plan).toBeDefined();
    expect(plan.week).toBe('2025-W02');
    expect(plan.status).toBe('draft');
    expect(plan.notes).toBe('Test plan');
    expect(plan.id.length > 0).toBe(true);
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
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].action).toBe('create');
    expect(auditEntries[0].actor).toBe('cli');
    expect(auditEntries[0].entity_type).toBe('weekly_plan');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.week).toBe('2025-W03');
    expect(details.status).toBe('draft');
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
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);
    expect(fetched.items?.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('getPlan returns null for non-existent plan', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.getPlan('non-existent-id');
    expect(result).toBe(null);
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
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);
    expect(fetched.status).toBe('active');
  } finally {
    cleanup();
  }
});

test('getPlanByWeek returns null for non-existent week', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.getPlanByWeek('2099-W01');
    expect(result).toBe(null);
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
    expect(plans.length).toBe(3);
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
    expect(draftPlans.length).toBe(2);

    const activePlans = service.listPlans({ status: 'active' });
    expect(activePlans.length).toBe(1);
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

    expect(updated).toBeDefined();
    expect(updated.notes).toBe('Updated notes');

    const auditEntries = getAuditEntries(db, created.id);
    expect(auditEntries.length).toBe(2);
    expect(auditEntries[0].action).toBe('update');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.notes).toBe('Updated notes');
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

    expect(result).toBe(null);
    expect(countAfter).toBe(countBefore);
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

    expect(deleted).toBe(true);

    // Plan should be gone
    const fetched = service.getPlan(created.id);
    expect(fetched).toBe(null);

    // But audit log should have the delete entry
    const auditEntries = getAuditEntries(db, created.id);
    expect(auditEntries.length).toBe(2);
    expect(auditEntries[0].action).toBe('delete');
    expect(auditEntries[0].actor).toBe('cli');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.week).toBe('2025-W07');
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

    expect(result).toBe(false);
    expect(countAfter).toBe(countBefore);
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

    expect(updated).toBeDefined();
    expect(updated.status).toBe('active');

    const auditEntries = getAuditEntries(db, created.id);
    expect(auditEntries.length).toBe(2);
    expect(auditEntries[0].action).toBe('update');
    expect(auditEntries[0].actor).toBe('api');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.statusChange.from).toBe('draft');
    expect(details.statusChange.to).toBe('active');
  } finally {
    cleanup();
  }
});

test('setStatus returns null for non-existent plan', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.setStatus('non-existent-id', 'active');
    expect(result).toBe(null);
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
    expect(updated).toBeDefined();
    expect(updated.status).toBe('active');

    // active -> completed
    updated = service.setStatus(plan.id, 'completed');
    expect(updated).toBeDefined();
    expect(updated.status).toBe('completed');

    // completed -> draft (allowed - no restrictions in spec)
    updated = service.setStatus(plan.id, 'draft');
    expect(updated).toBeDefined();
    expect(updated.status).toBe('draft');
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

    expect(item).toBeDefined();
    expect(item.planId).toBe(plan.id);
    expect(item.dayOfWeek).toBe(1);
    expect(item.mealType).toBe('dinner');
    expect(item.recipeId).toBe(recipeId);
    expect(item.servings).toBe(4);
    expect(item.notes).toBe('Test notes');

    const auditEntries = getAuditEntries(db, item.id);
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].action).toBe('update');
    expect(auditEntries[0].entity_type).toBe('plan_item');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.planId).toBe(plan.id);
    expect(details.dayOfWeek).toBe(1);
    expect(details.mealType).toBe('dinner');
    expect(details.recipeId).toBe(recipeId);
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

    expect(item).toBeDefined();
    expect(item.recipeId).toBe(null);
    expect(item.notes).toBe('Leftovers');
  } finally {
    cleanup();
  }
});

test('setMeal returns null for non-existent plan', () => {
  const { db, service, cleanup } = setupTestDb();
  try {
    const recipeId = createTestRecipe(db, 'Test Recipe');
    const result = service.setMeal('non-existent-id', 1, 'dinner', recipeId);
    expect(result).toBe(null);
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

    expect(() => service.setMeal(plan.id, 1, 'dinner', 'non-existent-recipe')).toThrow('Recipe non-existent-recipe not found');
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
    expect(item1).toBeDefined();

    const item2 = service.setMeal(plan.id, 1, 'dinner', recipe2);
    expect(item2).toBeDefined();

    // Should have same ID (update, not insert)
    expect(item2.id).toBe(item1.id);
    expect(item2.recipeId).toBe(recipe2);
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
    expect(item).toBeDefined();

    const removed = service.removeMeal(plan.id, 1, 'dinner', 'cli');

    expect(removed).toBe(true);

    // Verify meal is gone
    const updatedPlan = service.getPlan(plan.id);
    expect(updatedPlan).toBeDefined();
    expect(updatedPlan.items?.length ?? 0).toBe(0);

    // Check audit log
    const auditEntries = getAuditEntries(db, item.id);
    expect(auditEntries.length).toBe(2);
    expect(auditEntries[0].action).toBe('delete');
    expect(auditEntries[0].actor).toBe('cli');
    expect(auditEntries[0].entity_type).toBe('plan_item');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.planId).toBe(plan.id);
    expect(details.dayOfWeek).toBe(1);
    expect(details.mealType).toBe('dinner');
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
    expect(result).toBe(false);
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

    expect(service.planExists(created.id)).toBe(true);
    expect(service.planExists('non-existent-id')).toBe(false);
  } finally {
    cleanup();
  }
});

test('countPlans returns correct count', () => {
  const { service, cleanup } = setupTestDb();
  try {
    expect(service.countPlans()).toBe(0);

    service.createPlan({ week: '2025-W27', status: 'draft', notes: null });
    service.createPlan({ week: '2025-W28', status: 'active', notes: null });

    expect(service.countPlans()).toBe(2);
    expect(service.countPlans({ status: 'draft' })).toBe(1);
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
    const plan = service.createPlan({
      week: '2025-W30',
      status: 'draft',
      notes: null,
    });

    const auditEntries = getAuditEntries(db, plan.id);
    expect(auditEntries[0].actor).toBe('user');
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
      expect(auditEntries[0].actor).toBe(actor);
    }
  } finally {
    cleanup();
  }
});

