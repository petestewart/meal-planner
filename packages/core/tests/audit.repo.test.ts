/**
 * Integration tests for AuditRepository
 *
 * Tests all query operations against an in-memory SQLite database.
 * Includes comprehensive tests for logging and querying 100+ entries.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { AuditRepository } from '../src/repos/audit.repo.js';
import type { Database } from 'better-sqlite3';



// Database setup helper
function setupTestDb(): { db: Database; repo: AuditRepository; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const repo = new AuditRepository(db);

  return {
    db,
    repo,
    cleanup: () => closeDb(db),
  };
}

// ==================== Basic Tests ====================

test('can log an audit entry', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const entry = repo.log({
      actor: 'user',
      action: 'create',
      entityType: 'recipe',
      entityId: 'recipe-123',
      details: { title: 'Test Recipe' },
    });

    expect(entry).toBeDefined();
    expect(entry.actor).toBe('user');
    expect(entry.action).toBe('create');
    expect(entry.entityType).toBe('recipe');
    expect(entry.entityId).toBe('recipe-123');
    expect(entry.details).toBeDefined();
    expect((entry.details as Record<string, unknown>).title).toBe('Test Recipe');
    expect(entry.id.length > 0).toBe(true);
    expect(entry.timestamp.length > 0).toBe(true);
  } finally {
    cleanup();
  }
});

test('can get entries by entity ID', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });

    const entries = repo.getByEntityId('recipe-1');

    expect(entries.length).toBe(2);
    expect(entries.every(e => e.entityId === 'recipe-1')).toBe(true);
  } finally {
    cleanup();
  }
});

test('can get entries by entity type', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'plan', entityId: 'plan-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });

    const entries = repo.getByEntityType('recipe');

    expect(entries.length).toBe(2);
    expect(entries.every(e => e.entityType === 'recipe')).toBe(true);
  } finally {
    cleanup();
  }
});

test('can get entries by entity type with limit', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    for (let i = 0; i < 10; i++) {
      repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: `recipe-${i}` });
    }

    const entries = repo.getByEntityType('recipe', 5);

    expect(entries.length).toBe(5);
  } finally {
    cleanup();
  }
});

test('can get recent entries', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    for (let i = 0; i < 10; i++) {
      repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: `recipe-${i}` });
    }

    const entries = repo.getRecent(5);

    expect(entries.length).toBe(5);
  } finally {
    cleanup();
  }
});

// ==================== getByActor Tests ====================

test('can get entries by actor', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'cli', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'api', action: 'create', entityType: 'plan', entityId: 'plan-1' });
    repo.log({ actor: 'cli', action: 'delete', entityType: 'recipe', entityId: 'recipe-2' });

    const userEntries = repo.getByActor('user');
    expect(userEntries.length).toBe(2);
    expect(userEntries.every(e => e.actor === 'user')).toBe(true);

    const cliEntries = repo.getByActor('cli');
    expect(cliEntries.length).toBe(2);
    expect(cliEntries.every(e => e.actor === 'cli')).toBe(true);

    const apiEntries = repo.getByActor('api');
    expect(apiEntries.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('getByActor with limit', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    for (let i = 0; i < 20; i++) {
      repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: `recipe-${i}` });
    }

    const entries = repo.getByActor('user', 10);

    expect(entries.length).toBe(10);
    expect(entries.every(e => e.actor === 'user')).toBe(true);
  } finally {
    cleanup();
  }
});

test('getByActor returns empty for non-existent actor', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });

    const entries = repo.getByActor('non-existent');

    expect(entries.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('getByActor with agent actors', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'agent:curator', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'agent:planner', action: 'create', entityType: 'plan', entityId: 'plan-1' });
    repo.log({ actor: 'agent:curator', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });

    const curatorEntries = repo.getByActor('agent:curator');
    expect(curatorEntries.length).toBe(2);

    const plannerEntries = repo.getByActor('agent:planner');
    expect(plannerEntries.length).toBe(1);
  } finally {
    cleanup();
  }
});

// ==================== getByTimeRange Tests ====================

test('can get entries by time range', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    // Insert entries with specific timestamps
    const entry1 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-01T10:00:00.000Z', entry1.id);

    const entry2 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-15T10:00:00.000Z', entry2.id);

    const entry3 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-3' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-02-01T10:00:00.000Z', entry3.id);

    // Query for January only
    const januaryEntries = repo.getByTimeRange('2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
    expect(januaryEntries.length).toBe(2);

    // Query for February only
    const februaryEntries = repo.getByTimeRange('2024-02-01T00:00:00.000Z', '2024-02-29T23:59:59.999Z');
    expect(februaryEntries.length).toBe(1);

    // Query for entire range
    const allEntries = repo.getByTimeRange('2024-01-01T00:00:00.000Z', '2024-12-31T23:59:59.999Z');
    expect(allEntries.length).toBe(3);
  } finally {
    cleanup();
  }
});

test('getByTimeRange with limit', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    // Create 10 entries in January
    for (let i = 0; i < 10; i++) {
      const entry = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: `recipe-${i}` });
      db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, entry.id);
    }

    const entries = repo.getByTimeRange('2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z', 5);

    expect(entries.length).toBe(5);
  } finally {
    cleanup();
  }
});

test('getByTimeRange returns empty for no matches', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const entry = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-15T10:00:00.000Z', entry.id);

    const entries = repo.getByTimeRange('2024-02-01T00:00:00.000Z', '2024-02-29T23:59:59.999Z');

    expect(entries.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('getByTimeRange is inclusive on both ends', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const entry = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-15T10:00:00.000Z', entry.id);

    // Query with exact matching start time
    const startMatch = repo.getByTimeRange('2024-01-15T10:00:00.000Z', '2024-01-31T23:59:59.999Z');
    expect(startMatch.length).toBe(1);

    // Query with exact matching end time
    const endMatch = repo.getByTimeRange('2024-01-01T00:00:00.000Z', '2024-01-15T10:00:00.000Z');
    expect(endMatch.length).toBe(1);
  } finally {
    cleanup();
  }
});

// ==================== query() Tests ====================

test('query with no filters returns all entries', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'cli', action: 'update', entityType: 'plan', entityId: 'plan-1' });
    repo.log({ actor: 'api', action: 'delete', entityType: 'recipe', entityId: 'recipe-2' });

    const entries = repo.query();

    expect(entries.length).toBe(3);
  } finally {
    cleanup();
  }
});

test('query with actor filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'cli', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });

    const entries = repo.query({ actor: 'user' });

    expect(entries.length).toBe(2);
    expect(entries.every(e => e.actor === 'user')).toBe(true);
  } finally {
    cleanup();
  }
});

test('query with entityType filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'plan', entityId: 'plan-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });

    const entries = repo.query({ entityType: 'recipe' });

    expect(entries.length).toBe(2);
    expect(entries.every(e => e.entityType === 'recipe')).toBe(true);
  } finally {
    cleanup();
  }
});

test('query with entityId filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });

    const entries = repo.query({ entityId: 'recipe-1' });

    expect(entries.length).toBe(2);
    expect(entries.every(e => e.entityId === 'recipe-1')).toBe(true);
  } finally {
    cleanup();
  }
});

test('query with action filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'delete', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });

    const createEntries = repo.query({ action: 'create' });
    expect(createEntries.length).toBe(2);

    const updateEntries = repo.query({ action: 'update' });
    expect(updateEntries.length).toBe(1);

    const deleteEntries = repo.query({ action: 'delete' });
    expect(deleteEntries.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('query with time range filters', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const entry1 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-10T10:00:00.000Z', entry1.id);

    const entry2 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-20T10:00:00.000Z', entry2.id);

    const entry3 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-3' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-30T10:00:00.000Z', entry3.id);

    // startTime only
    const afterJan15 = repo.query({ startTime: '2024-01-15T00:00:00.000Z' });
    expect(afterJan15.length).toBe(2);

    // endTime only
    const beforeJan25 = repo.query({ endTime: '2024-01-25T00:00:00.000Z' });
    expect(beforeJan25.length).toBe(2);

    // Both startTime and endTime
    const midJan = repo.query({ startTime: '2024-01-15T00:00:00.000Z', endTime: '2024-01-25T00:00:00.000Z' });
    expect(midJan.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('query with multiple combined filters', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    // Create varied entries
    const entry1 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-10T10:00:00.000Z', entry1.id);

    const entry2 = repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-20T10:00:00.000Z', entry2.id);

    const entry3 = repo.log({ actor: 'cli', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-15T10:00:00.000Z', entry3.id);

    const entry4 = repo.log({ actor: 'user', action: 'create', entityType: 'plan', entityId: 'plan-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-10T10:00:00.000Z', entry4.id);

    // Query: user + recipe + create
    const userRecipeCreate = repo.query({ actor: 'user', entityType: 'recipe', action: 'create' });
    expect(userRecipeCreate.length).toBe(1);
    expect(userRecipeCreate[0].entityId).toBe('recipe-1');

    // Query: user + January (all user entries in Jan)
    const userJan = repo.query({
      actor: 'user',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-31T23:59:59.999Z',
    });
    expect(userJan.length).toBe(3);

    // Query: recipe + after Jan 12
    const recipeAfter12 = repo.query({
      entityType: 'recipe',
      startTime: '2024-01-12T00:00:00.000Z',
    });
    expect(recipeAfter12.length).toBe(2);
  } finally {
    cleanup();
  }
});

test('query with limit', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    for (let i = 0; i < 20; i++) {
      repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: `recipe-${i}` });
    }

    const entries = repo.query({ limit: 10 });

    expect(entries.length).toBe(10);
  } finally {
    cleanup();
  }
});

test('query with offset', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    for (let i = 0; i < 10; i++) {
      repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: `recipe-${i}` });
    }

    const page1 = repo.query({ limit: 3, offset: 0 });
    expect(page1.length).toBe(3);

    const page2 = repo.query({ limit: 3, offset: 3 });
    expect(page2.length).toBe(3);

    // Verify different entries on each page
    const page1Ids = page1.map(e => e.id);
    const page2Ids = page2.map(e => e.id);
    const overlap = page1Ids.filter(id => page2Ids.includes(id));
    expect(overlap.length).toBe(0);

    const page4 = repo.query({ limit: 3, offset: 9 });
    expect(page4.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('query with offset only (no limit)', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    for (let i = 0; i < 10; i++) {
      repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: `recipe-${i}` });
    }

    const entries = repo.query({ offset: 5 });

    expect(entries.length).toBe(5);
  } finally {
    cleanup();
  }
});

// ==================== count() Tests ====================

test('count with no filters returns total count', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'cli', action: 'update', entityType: 'plan', entityId: 'plan-1' });
    repo.log({ actor: 'api', action: 'delete', entityType: 'recipe', entityId: 'recipe-2' });

    const count = repo.count();

    expect(count).toBe(3);
  } finally {
    cleanup();
  }
});

test('count with actor filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'cli', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });

    expect(repo.count({ actor: 'user' })).toBe(2);
    expect(repo.count({ actor: 'cli' })).toBe(1);
    expect(repo.count({ actor: 'api' })).toBe(0);
  } finally {
    cleanup();
  }
});

test('count with entityType filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'plan', entityId: 'plan-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });

    expect(repo.count({ entityType: 'recipe' })).toBe(2);
    expect(repo.count({ entityType: 'plan' })).toBe(1);
  } finally {
    cleanup();
  }
});

test('count with action filter', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'delete', entityType: 'recipe', entityId: 'recipe-1' });
    repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });

    expect(repo.count({ action: 'create' })).toBe(2);
    expect(repo.count({ action: 'update' })).toBe(1);
    expect(repo.count({ action: 'delete' })).toBe(1);
  } finally {
    cleanup();
  }
});

test('count with time range filters', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const entry1 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-10T10:00:00.000Z', entry1.id);

    const entry2 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-20T10:00:00.000Z', entry2.id);

    const entry3 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-3' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-30T10:00:00.000Z', entry3.id);

    expect(repo.count({ startTime: '2024-01-15T00:00:00.000Z' })).toBe(2);
    expect(repo.count({ endTime: '2024-01-25T00:00:00.000Z' })).toBe(2);
    expect(repo.count({ startTime: '2024-01-15T00:00:00.000Z', endTime: '2024-01-25T00:00:00.000Z' })).toBe(1);
  } finally {
    cleanup();
  }
});

test('count with multiple combined filters', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const entry1 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-10T10:00:00.000Z', entry1.id);

    const entry2 = repo.log({ actor: 'user', action: 'update', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-20T10:00:00.000Z', entry2.id);

    const entry3 = repo.log({ actor: 'cli', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-15T10:00:00.000Z', entry3.id);

    expect(repo.count({ actor: 'user', entityType: 'recipe', action: 'create' })).toBe(1);
    expect(repo.count({ actor: 'user', startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-31T23:59:59.999Z' })).toBe(2);
  } finally {
    cleanup();
  }
});

test('count ignores limit and offset', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    for (let i = 0; i < 20; i++) {
      repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: `recipe-${i}` });
    }

    // count should ignore limit and offset
    const count = repo.count({ limit: 5, offset: 10 });

    expect(count).toBe(20);
  } finally {
    cleanup();
  }
});

// ==================== Integration Test: 100 Entries ====================

test('logs and queries 100+ entries correctly', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const actors = ['user', 'cli', 'api', 'agent:curator', 'agent:planner'];
    const actions: Array<'create' | 'update' | 'delete'> = ['create', 'update', 'delete'];
    const entityTypes = ['recipe', 'plan', 'ingredient', 'tag'];

    // Log 120 entries with varied attributes
    const loggedEntries = [];
    for (let i = 0; i < 120; i++) {
      const actor = actors[i % actors.length];
      const action = actions[i % actions.length];
      const entityType = entityTypes[i % entityTypes.length];
      const entityId = `${entityType}-${i}`;

      const entry = repo.log({
        actor,
        action,
        entityType,
        entityId,
        details: { index: i },
      });

      // Set specific timestamps for time range testing
      const day = (i % 28) + 1;
      const month = (i < 60) ? '01' : '02'; // First 60 in January, rest in February
      db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run(
        `2024-${month}-${String(day).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
        entry.id
      );

      loggedEntries.push(entry);
    }

    // Verify total count
    expect(repo.count()).toBe(120);

    // Test getRecent
    const recent = repo.getRecent(50);
    expect(recent.length).toBe(50);

    // Test getByActor
    const userEntries = repo.getByActor('user');
    expect(userEntries.length).toBe(24);

    const cliEntries = repo.getByActor('cli');
    expect(cliEntries.length).toBe(24);

    const curatorEntries = repo.getByActor('agent:curator');
    expect(curatorEntries.length).toBe(24);

    // Test getByActor with limit
    const limitedUserEntries = repo.getByActor('user', 10);
    expect(limitedUserEntries.length).toBe(10);

    // Test getByTimeRange
    const januaryEntries = repo.getByTimeRange('2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z');
    expect(januaryEntries.length).toBe(60);

    const februaryEntries = repo.getByTimeRange('2024-02-01T00:00:00.000Z', '2024-02-29T23:59:59.999Z');
    expect(februaryEntries.length).toBe(60);

    // Test getByTimeRange with limit
    const limitedJanuary = repo.getByTimeRange('2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z', 20);
    expect(limitedJanuary.length).toBe(20);

    // Test getByEntityType
    const recipeEntries = repo.getByEntityType('recipe');
    expect(recipeEntries.length).toBe(30);

    // Test query with combined filters
    const userRecipeCreate = repo.query({ actor: 'user', entityType: 'recipe', action: 'create' });
    expect(userRecipeCreate.length >= 1).toBe(true);
    expect(userRecipeCreate.every(e => e.actor === 'user' && e.entityType === 'recipe' && e.action === 'create')).toBe(true);

    // Test query with time range and other filters
    const userJanuaryRecipes = repo.query({
      actor: 'user',
      entityType: 'recipe',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-31T23:59:59.999Z',
    });
    expect(userJanuaryRecipes.every(e =>
      e.actor === 'user' &&
      e.entityType === 'recipe' &&
      e.timestamp >= '2024-01-01T00:00:00.000Z' &&
      e.timestamp <= '2024-01-31T23:59:59.999Z'
    )).toBe(true);

    // Test pagination
    const page1 = repo.query({ limit: 25, offset: 0 });
    const page2 = repo.query({ limit: 25, offset: 25 });
    const page3 = repo.query({ limit: 25, offset: 50 });
    const page4 = repo.query({ limit: 25, offset: 75 });
    const page5 = repo.query({ limit: 25, offset: 100 });

    expect(page1.length).toBe(25);
    expect(page2.length).toBe(25);
    expect(page3.length).toBe(25);
    expect(page4.length).toBe(25);
    expect(page5.length).toBe(20);

    // Verify no duplicates across pages
    const allPagedIds = [...page1, ...page2, ...page3, ...page4, ...page5].map(e => e.id);
    const uniqueIds = new Set(allPagedIds);
    expect(uniqueIds.size).toBe(120);

    // Test count with filters
    expect(repo.count({ actor: 'user' })).toBe(24);
    expect(repo.count({ entityType: 'recipe' })).toBe(30);
    expect(repo.count({ action: 'create' })).toBe(40);
    expect(repo.count({ startTime: '2024-01-01T00:00:00.000Z', endTime: '2024-01-31T23:59:59.999Z' })).toBe(60);

    console.log('      [100+ entries integration test completed successfully]');
  } finally {
    cleanup();
  }
});

// ==================== Edge Cases ====================

test('query returns entries in descending timestamp order', () => {
  const { db, repo, cleanup } = setupTestDb();
  try {
    const entry1 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-1' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-10T10:00:00.000Z', entry1.id);

    const entry2 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-2' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-20T10:00:00.000Z', entry2.id);

    const entry3 = repo.log({ actor: 'user', action: 'create', entityType: 'recipe', entityId: 'recipe-3' });
    db.prepare('UPDATE audit_log SET timestamp = ? WHERE id = ?').run('2024-01-15T10:00:00.000Z', entry3.id);

    const entries = repo.query();

    // Should be in descending order: Jan 20, Jan 15, Jan 10
    expect(entries[0].entityId).toBe('recipe-2');
    expect(entries[1].entityId).toBe('recipe-3');
    expect(entries[2].entityId).toBe('recipe-1');
  } finally {
    cleanup();
  }
});

test('handles entries with null details', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const entry = repo.log({
      actor: 'user',
      action: 'create',
      entityType: 'recipe',
      entityId: 'recipe-1',
    });

    expect(entry.details).toBe(null);

    const fetched = repo.query({ entityId: 'recipe-1' });
    expect(fetched[0].details).toBe(null);
  } finally {
    cleanup();
  }
});

test('handles entries with complex details object', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const complexDetails = {
      nested: {
        array: [1, 2, 3],
        object: { key: 'value' },
      },
      string: 'test',
      number: 42,
      boolean: true,
      nullValue: null,
    };

    const entry = repo.log({
      actor: 'user',
      action: 'create',
      entityType: 'recipe',
      entityId: 'recipe-1',
      details: complexDetails,
    });

    expect(entry.details).toBeDefined();
    const details = entry.details as Record<string, unknown>;
    expect(JSON.stringify(details)).toBe(JSON.stringify(complexDetails));
  } finally {
    cleanup();
  }
});

