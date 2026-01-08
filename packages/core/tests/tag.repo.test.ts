/**
 * Integration tests for TagRepository
 *
 * Tests all CRUD operations against an in-memory SQLite database.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { TagRepository } from '../src/repos/tag.repo.js';
import type { Database } from 'better-sqlite3';

// Database setup helper
function setupTestDb(): { db: Database; repo: TagRepository; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const repo = new TagRepository(db);

  return {
    db,
    repo,
    cleanup: () => closeDb(db),
  };
}

// ==================== Basic CRUD Tests ====================

test('can create a tag', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const tag = repo.create({
      name: 'Dinner',
      category: 'meal_type',
    });

    expect(tag).toBeDefined();
    expect(tag.id.length).toBeGreaterThan(0);
    expect(tag.name).toBe('Dinner');
    expect(tag.category).toBe('meal_type');
  } finally {
    cleanup();
  }
});

test('can create a tag with null category', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const tag = repo.create({
      name: 'Custom Tag',
      category: null,
    });

    expect(tag).toBeDefined();
    expect(tag.name).toBe('Custom Tag');
    expect(tag.category).toBeNull();
  } finally {
    cleanup();
  }
});

test('can get tag by ID', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      name: 'Breakfast',
      category: 'meal_type',
    });

    const retrieved = repo.getById(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.name).toBe('Breakfast');
    expect(retrieved?.category).toBe('meal_type');
  } finally {
    cleanup();
  }
});

test('getById returns null for non-existent tag', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getById('non-existent-id');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('can get tag by name', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      name: 'Vegetarian',
      category: 'dietary',
    });

    const result = repo.getByName('Vegetarian');

    expect(result).toBeDefined();
    expect(result?.name).toBe('Vegetarian');
    expect(result?.category).toBe('dietary');
  } finally {
    cleanup();
  }
});

test('getByName is case-insensitive', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({
      name: 'Quick Meals',
      category: 'custom',
    });

    const result1 = repo.getByName('quick meals');
    expect(result1).toBeDefined();
    expect(result1?.name).toBe('Quick Meals');

    const result2 = repo.getByName('QUICK MEALS');
    expect(result2).toBeDefined();
    expect(result2?.name).toBe('Quick Meals');
  } finally {
    cleanup();
  }
});

test('getByName returns null for non-existent tag', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getByName('Non Existent Tag');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== getOrCreate Tests ====================

test('getOrCreate returns existing tag', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      name: 'Existing Tag',
      category: 'dietary',
    });

    const result = repo.getOrCreate('Existing Tag');

    expect(result.id).toBe(created.id);
    expect(result.category).toBe('dietary');
  } finally {
    cleanup();
  }
});

test('getOrCreate is case-insensitive for existing tags', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.create({
      name: 'Case Test',
      category: 'meal_type',
    });

    const result = repo.getOrCreate('CASE TEST');

    expect(result.id).toBe(created.id);
    expect(result.name).toBe('Case Test');
  } finally {
    cleanup();
  }
});

test('getOrCreate creates new tag if not exists', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getOrCreate('New Tag');

    expect(result.id).toBeDefined();
    expect(result.name).toBe('New Tag');
    expect(result.category).toBe('custom'); // Default category

    // Verify it was persisted
    const retrieved = repo.getByName('New Tag');
    expect(retrieved?.id).toBe(result.id);
  } finally {
    cleanup();
  }
});

test('getOrCreate uses provided category for new tags', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getOrCreate('Lunch', 'meal_type');

    expect(result.name).toBe('Lunch');
    expect(result.category).toBe('meal_type');
  } finally {
    cleanup();
  }
});

test('getOrCreate uses null category when specified', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getOrCreate('No Category', null);

    expect(result.name).toBe('No Category');
    expect(result.category).toBe('custom'); // Falls back to 'custom'
  } finally {
    cleanup();
  }
});

// ==================== resolveTagNames Tests ====================

test('resolveTagNames creates and returns tag IDs', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const ids = repo.resolveTagNames(['Tag A', 'Tag B', 'Tag C']);

    expect(ids.length).toBe(3);
    expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true);

    // Verify tags were created
    expect(repo.getByName('Tag A')).toBeDefined();
    expect(repo.getByName('Tag B')).toBeDefined();
    expect(repo.getByName('Tag C')).toBeDefined();
  } finally {
    cleanup();
  }
});

test('resolveTagNames returns existing tag IDs', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const existing = repo.create({ name: 'Existing', category: 'custom' });

    const ids = repo.resolveTagNames(['Existing', 'New One']);

    expect(ids.length).toBe(2);
    expect(ids[0]).toBe(existing.id);
    expect(ids[1]).not.toBe(existing.id);
  } finally {
    cleanup();
  }
});

test('resolveTagNames handles empty array', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const ids = repo.resolveTagNames([]);
    expect(ids).toEqual([]);
  } finally {
    cleanup();
  }
});

// ==================== list Tests ====================

test('list returns all tags', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({ name: 'Tag 1', category: 'meal_type' });
    repo.create({ name: 'Tag 2', category: 'dietary' });
    repo.create({ name: 'Tag 3', category: 'custom' });

    const tags = repo.list();

    expect(tags.length).toBe(3);
  } finally {
    cleanup();
  }
});

test('list returns tags sorted by name', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({ name: 'Zebra', category: 'custom' });
    repo.create({ name: 'Apple', category: 'custom' });
    repo.create({ name: 'Mango', category: 'custom' });

    const tags = repo.list();

    expect(tags[0].name).toBe('Apple');
    expect(tags[1].name).toBe('Mango');
    expect(tags[2].name).toBe('Zebra');
  } finally {
    cleanup();
  }
});

test('list filters by category', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({ name: 'Breakfast', category: 'meal_type' });
    repo.create({ name: 'Lunch', category: 'meal_type' });
    repo.create({ name: 'Vegan', category: 'dietary' });
    repo.create({ name: 'Gluten-Free', category: 'dietary' });

    const mealTypes = repo.list('meal_type');
    expect(mealTypes.length).toBe(2);
    expect(mealTypes.every(t => t.category === 'meal_type')).toBe(true);

    const dietary = repo.list('dietary');
    expect(dietary.length).toBe(2);
    expect(dietary.every(t => t.category === 'dietary')).toBe(true);
  } finally {
    cleanup();
  }
});

test('list returns empty array when no tags match category', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    repo.create({ name: 'Tag', category: 'meal_type' });

    const result = repo.list('dietary');
    expect(result).toEqual([]);
  } finally {
    cleanup();
  }
});

// ==================== delete Tests ====================

test('delete removes a tag', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const tag = repo.create({ name: 'To Delete', category: 'custom' });

    const deleted = repo.delete(tag.id);

    expect(deleted).toBe(true);
    expect(repo.getById(tag.id)).toBeNull();
  } finally {
    cleanup();
  }
});

test('delete returns false for non-existent tag', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.delete('non-existent-id');
    expect(result).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== exists Tests ====================

test('exists returns true for existing tag', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const tag = repo.create({ name: 'Exists', category: 'custom' });
    expect(repo.exists(tag.id)).toBe(true);
  } finally {
    cleanup();
  }
});

test('exists returns false for non-existent tag', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    expect(repo.exists('non-existent-id')).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== Integration Tests ====================

test('can create and manage multiple tags', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    // Create tags of different categories
    const dinner = repo.create({ name: 'Dinner', category: 'meal_type' });
    const vegan = repo.create({ name: 'Vegan', category: 'dietary' });
    const quick = repo.create({ name: 'Quick', category: 'custom' });

    // Verify all were created
    expect(repo.list().length).toBe(3);

    // Get by different methods
    expect(repo.getById(dinner.id)?.name).toBe('Dinner');
    expect(repo.getByName('vegan')?.id).toBe(vegan.id);
    expect(repo.exists(quick.id)).toBe(true);

    // Filter by category
    expect(repo.list('meal_type').length).toBe(1);
    expect(repo.list('dietary').length).toBe(1);
    expect(repo.list('custom').length).toBe(1);

    // Delete one
    repo.delete(vegan.id);
    expect(repo.list().length).toBe(2);
    expect(repo.exists(vegan.id)).toBe(false);
  } finally {
    cleanup();
  }
});

describe('TagRepository edge cases', () => {
  test('handles tags with special characters', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const tag = repo.create({ name: 'Gluten-Free & Dairy-Free', category: 'dietary' });

      expect(tag.name).toBe('Gluten-Free & Dairy-Free');
      expect(repo.getByName('Gluten-Free & Dairy-Free')).toBeDefined();
    } finally {
      cleanup();
    }
  });

  test('handles tags with unicode characters', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const tag = repo.create({ name: 'Caf\u00e9 Style', category: 'custom' });

      expect(tag.name).toBe('Caf\u00e9 Style');
      expect(repo.getByName('Caf\u00e9 Style')).toBeDefined();
    } finally {
      cleanup();
    }
  });

  test('handles very long tag names', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const longName = 'A'.repeat(200);
      const tag = repo.create({ name: longName, category: 'custom' });

      expect(tag.name).toBe(longName);
      expect(repo.getByName(longName)).toBeDefined();
    } finally {
      cleanup();
    }
  });
});
