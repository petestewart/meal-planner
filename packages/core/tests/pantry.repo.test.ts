/**
 * Integration tests for PantryRepository
 *
 * Tests all CRUD operations against an in-memory SQLite database.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { PantryRepository } from '../src/repos/pantry.repo.js';
import { IngredientRepository } from '../src/repos/ingredient.repo.js';
import type { Database } from 'better-sqlite3';

// Database setup helper
function setupTestDb(): {
  db: Database;
  pantryRepo: PantryRepository;
  ingredientRepo: IngredientRepository;
  cleanup: () => void;
} {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const pantryRepo = new PantryRepository(db);
  const ingredientRepo = new IngredientRepository(db);

  return {
    db,
    pantryRepo,
    ingredientRepo,
    cleanup: () => closeDb(db),
  };
}

// Helper to create a test ingredient
function createTestIngredient(repo: IngredientRepository, name: string): string {
  const ingredient = repo.create({ name, category: 'Produce', defaultUnit: null });
  return ingredient.id;
}

// ==================== Basic CRUD Tests ====================

test('can create a pantry item', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Tomatoes');

    const item = pantryRepo.create({
      ingredientId,
      quantity: 5,
      unit: 'pieces',
      expiresAt: '2024-12-31',
      location: 'fridge',
      isPrepared: false,
      preparationNotes: null,
      isStaple: false,
    });

    expect(item).toBeDefined();
    expect(item.id.length).toBeGreaterThan(0);
    expect(item.ingredientId).toBe(ingredientId);
    expect(item.quantity).toBe(5);
    expect(item.unit).toBe('pieces');
    expect(item.expiresAt).toBe('2024-12-31');
    expect(item.location).toBe('fridge');
    expect(item.isPrepared).toBe(false);
    expect(item.isStaple).toBe(false);
  } finally {
    cleanup();
  }
});

test('can create a pantry item with minimal fields', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Salt');

    const item = pantryRepo.create({
      ingredientId,
      quantity: null,
      unit: null,
      expiresAt: null,
      location: null,
      isPrepared: false,
      preparationNotes: null,
      isStaple: true,
    });

    expect(item).toBeDefined();
    expect(item.ingredientId).toBe(ingredientId);
    expect(item.quantity).toBeNull();
    expect(item.unit).toBeNull();
    expect(item.expiresAt).toBeNull();
    expect(item.location).toBeNull();
    expect(item.isStaple).toBe(true);
  } finally {
    cleanup();
  }
});

test('can get pantry item by ID', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Onions');
    const created = pantryRepo.create({
      ingredientId,
      quantity: 3,
      unit: 'pieces',
      expiresAt: null,
      location: 'pantry',
      isPrepared: false,
      preparationNotes: null,
      isStaple: false,
    });

    const retrieved = pantryRepo.getById(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.ingredientId).toBe(ingredientId);
    expect(retrieved?.quantity).toBe(3);
  } finally {
    cleanup();
  }
});

test('getById returns null for non-existent item', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.getById('non-existent-id');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('can get pantry item by ID with ingredient details', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Carrots');
    const created = pantryRepo.create({
      ingredientId,
      quantity: 10,
      unit: 'pieces',
      expiresAt: null,
      location: 'fridge',
      isPrepared: false,
      preparationNotes: null,
      isStaple: false,
    });

    const result = pantryRepo.getByIdWithIngredient(created.id);

    expect(result).toBeDefined();
    expect(result?.ingredientName).toBe('Carrots');
    expect(result?.ingredientCategory).toBe('Produce');
    expect(result?.quantity).toBe(10);
  } finally {
    cleanup();
  }
});

test('getByIdWithIngredient returns null for non-existent item', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.getByIdWithIngredient('non-existent-id');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('can get pantry item by ingredient ID', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Garlic');
    pantryRepo.create({
      ingredientId,
      quantity: 2,
      unit: 'heads',
      expiresAt: null,
      location: 'pantry',
      isPrepared: false,
      preparationNotes: null,
      isStaple: true,
    });

    const result = pantryRepo.getByIngredientId(ingredientId);

    expect(result).toBeDefined();
    expect(result?.ingredientId).toBe(ingredientId);
    expect(result?.quantity).toBe(2);
  } finally {
    cleanup();
  }
});

test('getByIngredientId returns null for non-existent ingredient', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.getByIngredientId('non-existent-id');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('can get pantry item by ingredient name', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Chicken Breast');
    pantryRepo.create({
      ingredientId,
      quantity: 2,
      unit: 'lbs',
      expiresAt: '2024-12-20',
      location: 'freezer',
      isPrepared: false,
      preparationNotes: null,
      isStaple: false,
    });

    const result = pantryRepo.getByIngredientName('Chicken Breast');

    expect(result).toBeDefined();
    expect(result?.ingredientName).toBe('Chicken Breast');
    expect(result?.quantity).toBe(2);
  } finally {
    cleanup();
  }
});

test('getByIngredientName is case-insensitive', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Olive Oil');
    pantryRepo.create({
      ingredientId,
      quantity: 1,
      unit: 'bottle',
      expiresAt: null,
      location: 'pantry',
      isPrepared: false,
      preparationNotes: null,
      isStaple: true,
    });

    const result1 = pantryRepo.getByIngredientName('olive oil');
    const result2 = pantryRepo.getByIngredientName('OLIVE OIL');

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1?.id).toBe(result2?.id);
  } finally {
    cleanup();
  }
});

test('getByIngredientName returns null for non-existent ingredient', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.getByIngredientName('Non Existent');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== list Tests ====================

test('list returns all pantry items with ingredient details', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Apples');
    const id2 = createTestIngredient(ingredientRepo, 'Bananas');
    const id3 = createTestIngredient(ingredientRepo, 'Oranges');

    pantryRepo.create({ ingredientId: id1, quantity: 5, unit: 'pieces', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id2, quantity: 6, unit: 'pieces', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id3, quantity: 4, unit: 'pieces', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const items = pantryRepo.list();

    expect(items.length).toBe(3);
    expect(items.every(item => item.ingredientName !== undefined)).toBe(true);
  } finally {
    cleanup();
  }
});

test('list returns items sorted by ingredient name', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Zucchini');
    const id2 = createTestIngredient(ingredientRepo, 'Avocado');
    const id3 = createTestIngredient(ingredientRepo, 'Mushrooms');

    pantryRepo.create({ ingredientId: id1, quantity: 2, unit: 'pieces', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id2, quantity: 3, unit: 'pieces', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id3, quantity: 8, unit: 'oz', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const items = pantryRepo.list();

    expect(items[0].ingredientName).toBe('Avocado');
    expect(items[1].ingredientName).toBe('Mushrooms');
    expect(items[2].ingredientName).toBe('Zucchini');
  } finally {
    cleanup();
  }
});

test('list filters by location', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Milk');
    const id2 = createTestIngredient(ingredientRepo, 'Rice');
    const id3 = createTestIngredient(ingredientRepo, 'Ice Cream');

    pantryRepo.create({ ingredientId: id1, quantity: 1, unit: 'gallon', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id2, quantity: 2, unit: 'lbs', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id3, quantity: 1, unit: 'pint', expiresAt: null, location: 'freezer', isPrepared: false, preparationNotes: null, isStaple: false });

    const fridgeItems = pantryRepo.list({ location: 'fridge' });
    expect(fridgeItems.length).toBe(1);
    expect(fridgeItems[0].ingredientName).toBe('Milk');

    const pantryItems = pantryRepo.list({ location: 'pantry' });
    expect(pantryItems.length).toBe(1);
    expect(pantryItems[0].ingredientName).toBe('Rice');

    const freezerItems = pantryRepo.list({ location: 'freezer' });
    expect(freezerItems.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('list filters by isPrepared', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Diced Onions');
    const id2 = createTestIngredient(ingredientRepo, 'Whole Onions');

    pantryRepo.create({ ingredientId: id1, quantity: 2, unit: 'cups', expiresAt: null, location: 'fridge', isPrepared: true, preparationNotes: 'Diced yesterday', isStaple: false });
    pantryRepo.create({ ingredientId: id2, quantity: 5, unit: 'pieces', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: false });

    const prepared = pantryRepo.list({ isPrepared: true });
    expect(prepared.length).toBe(1);
    expect(prepared[0].ingredientName).toBe('Diced Onions');
    expect(prepared[0].preparationNotes).toBe('Diced yesterday');

    const notPrepared = pantryRepo.list({ isPrepared: false });
    expect(notPrepared.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('list filters by isStaple', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Salt');
    const id2 = createTestIngredient(ingredientRepo, 'Fresh Salmon');

    pantryRepo.create({ ingredientId: id1, quantity: 1, unit: 'container', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: true });
    pantryRepo.create({ ingredientId: id2, quantity: 1, unit: 'lb', expiresAt: '2024-12-20', location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const staples = pantryRepo.list({ isStaple: true });
    expect(staples.length).toBe(1);
    expect(staples[0].ingredientName).toBe('Salt');

    const nonStaples = pantryRepo.list({ isStaple: false });
    expect(nonStaples.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('list filters by expiringWithinDays', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Expiring Soon');
    const id2 = createTestIngredient(ingredientRepo, 'Not Expiring');
    const id3 = createTestIngredient(ingredientRepo, 'No Expiry');

    // Calculate dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    pantryRepo.create({ ingredientId: id1, quantity: 1, unit: 'piece', expiresAt: tomorrow.toISOString().split('T')[0], location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id2, quantity: 1, unit: 'piece', expiresAt: nextMonth.toISOString().split('T')[0], location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id3, quantity: 1, unit: 'piece', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: true });

    const expiringSoon = pantryRepo.list({ expiringWithinDays: 7 });
    expect(expiringSoon.length).toBe(1);
    expect(expiringSoon[0].ingredientName).toBe('Expiring Soon');
  } finally {
    cleanup();
  }
});

test('listExpiring uses default 7 days', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id = createTestIngredient(ingredientRepo, 'Expiring Item');

    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);

    pantryRepo.create({ ingredientId: id, quantity: 1, unit: 'piece', expiresAt: threeDays.toISOString().split('T')[0], location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const expiring = pantryRepo.listExpiring();
    expect(expiring.length).toBe(1);

    const expiringIn1Day = pantryRepo.listExpiring(1);
    expect(expiringIn1Day.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('listStaples returns only staple items', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Flour');
    const id2 = createTestIngredient(ingredientRepo, 'Sugar');
    const id3 = createTestIngredient(ingredientRepo, 'Fresh Meat');

    pantryRepo.create({ ingredientId: id1, quantity: 5, unit: 'lbs', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: true });
    pantryRepo.create({ ingredientId: id2, quantity: 2, unit: 'lbs', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: true });
    pantryRepo.create({ ingredientId: id3, quantity: 1, unit: 'lb', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const staples = pantryRepo.listStaples();
    expect(staples.length).toBe(2);
    expect(staples.every(s => s.isStaple)).toBe(true);
  } finally {
    cleanup();
  }
});

// ==================== update Tests ====================

test('update modifies pantry item fields', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Butter');
    const created = pantryRepo.create({ ingredientId, quantity: 1, unit: 'lb', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const updated = pantryRepo.update(created.id, {
      quantity: 2,
      unit: 'lbs',
      location: 'freezer',
      isStaple: true,
    });

    expect(updated).toBeDefined();
    expect(updated?.quantity).toBe(2);
    expect(updated?.unit).toBe('lbs');
    expect(updated?.location).toBe('freezer');
    expect(updated?.isStaple).toBe(true);
  } finally {
    cleanup();
  }
});

test('update can set fields to null', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Cheese');
    const created = pantryRepo.create({ ingredientId, quantity: 8, unit: 'oz', expiresAt: '2024-12-31', location: 'fridge', isPrepared: false, preparationNotes: 'Cheddar', isStaple: false });

    const updated = pantryRepo.update(created.id, {
      expiresAt: null,
      preparationNotes: null,
    });

    expect(updated?.expiresAt).toBeNull();
    expect(updated?.preparationNotes).toBeNull();
  } finally {
    cleanup();
  }
});

test('update returns null for non-existent item', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.update('non-existent-id', { quantity: 5 });
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('update with no changes returns existing item', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Eggs');
    const created = pantryRepo.create({ ingredientId, quantity: 12, unit: 'pieces', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const updated = pantryRepo.update(created.id, {});

    expect(updated?.id).toBe(created.id);
    expect(updated?.quantity).toBe(12);
  } finally {
    cleanup();
  }
});

test('update changes updatedAt timestamp', () => {
  const { pantryRepo, ingredientRepo, db, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Yogurt');
    const created = pantryRepo.create({ ingredientId, quantity: 2, unit: 'containers', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    // Set old timestamp
    const oldTime = '2020-01-01T00:00:00.000Z';
    db.prepare('UPDATE pantry_items SET updated_at = ? WHERE id = ?').run(oldTime, created.id);

    const updated = pantryRepo.update(created.id, { quantity: 3 });

    expect(updated?.updatedAt).not.toBe(oldTime);
  } finally {
    cleanup();
  }
});

// ==================== use Tests ====================

test('use decrements quantity', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Chicken');
    const created = pantryRepo.create({ ingredientId, quantity: 5, unit: 'lbs', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const updated = pantryRepo.use(created.id, 2);

    expect(updated?.quantity).toBe(3);
  } finally {
    cleanup();
  }
});

test('use does not go below zero', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Bread');
    const created = pantryRepo.create({ ingredientId, quantity: 1, unit: 'loaf', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: false });

    const updated = pantryRepo.use(created.id, 5);

    expect(updated?.quantity).toBe(0);
  } finally {
    cleanup();
  }
});

test('use returns null for non-existent item', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.use('non-existent-id', 1);
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('useByIngredientName decrements by name', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Pasta');
    pantryRepo.create({ ingredientId, quantity: 3, unit: 'boxes', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: true });

    const updated = pantryRepo.useByIngredientName('Pasta', 1);

    expect(updated?.quantity).toBe(2);
  } finally {
    cleanup();
  }
});

test('useByIngredientName returns null for non-existent ingredient', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.useByIngredientName('Non Existent', 1);
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== delete Tests ====================

test('delete removes pantry item', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Lettuce');
    const created = pantryRepo.create({ ingredientId, quantity: 1, unit: 'head', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const deleted = pantryRepo.delete(created.id);

    expect(deleted).toBe(true);
    expect(pantryRepo.getById(created.id)).toBeNull();
  } finally {
    cleanup();
  }
});

test('delete returns false for non-existent item', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.delete('non-existent-id');
    expect(result).toBe(false);
  } finally {
    cleanup();
  }
});

test('deleteByIngredientName removes by ingredient name', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Spinach');
    pantryRepo.create({ ingredientId, quantity: 1, unit: 'bag', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const deleted = pantryRepo.deleteByIngredientName('Spinach');

    expect(deleted).toBe(true);
    expect(pantryRepo.getByIngredientName('Spinach')).toBeNull();
  } finally {
    cleanup();
  }
});

test('deleteByIngredientName is case-insensitive', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Kale');
    pantryRepo.create({ ingredientId, quantity: 1, unit: 'bunch', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    const deleted = pantryRepo.deleteByIngredientName('KALE');

    expect(deleted).toBe(true);
  } finally {
    cleanup();
  }
});

test('deleteByIngredientName returns false for non-existent ingredient', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const result = pantryRepo.deleteByIngredientName('Non Existent');
    expect(result).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== exists Tests ====================

test('exists returns true for existing ingredient in pantry', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Peppers');
    pantryRepo.create({ ingredientId, quantity: 3, unit: 'pieces', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });

    expect(pantryRepo.exists(ingredientId)).toBe(true);
  } finally {
    cleanup();
  }
});

test('exists returns false for non-existent ingredient in pantry', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredientId = createTestIngredient(ingredientRepo, 'Not In Pantry');
    expect(pantryRepo.exists(ingredientId)).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== getByIngredientIds Tests ====================

test('getByIngredientIds returns matching items', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Item 1');
    const id2 = createTestIngredient(ingredientRepo, 'Item 2');
    const id3 = createTestIngredient(ingredientRepo, 'Item 3');

    pantryRepo.create({ ingredientId: id1, quantity: 1, unit: 'piece', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id2, quantity: 2, unit: 'pieces', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: false });
    // id3 not in pantry

    const items = pantryRepo.getByIngredientIds([id1, id2, id3]);

    expect(items.length).toBe(2);
    expect(items.map(i => i.ingredientId)).toContain(id1);
    expect(items.map(i => i.ingredientId)).toContain(id2);
  } finally {
    cleanup();
  }
});

test('getByIngredientIds returns empty array for empty input', () => {
  const { pantryRepo, cleanup } = setupTestDb();
  try {
    const items = pantryRepo.getByIngredientIds([]);
    expect(items).toEqual([]);
  } finally {
    cleanup();
  }
});

// ==================== getPantryQuantities Tests ====================

test('getPantryQuantities returns map of quantities', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id1 = createTestIngredient(ingredientRepo, 'Qty Item 1');
    const id2 = createTestIngredient(ingredientRepo, 'Qty Item 2');
    const id3 = createTestIngredient(ingredientRepo, 'Zero Qty Item');

    pantryRepo.create({ ingredientId: id1, quantity: 5, unit: 'cups', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id2, quantity: 10, unit: 'oz', expiresAt: null, location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });
    pantryRepo.create({ ingredientId: id3, quantity: 0, unit: 'pieces', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: false });

    const quantities = pantryRepo.getPantryQuantities();

    expect(quantities.get(id1)).toEqual({ quantity: 5, unit: 'cups' });
    expect(quantities.get(id2)).toEqual({ quantity: 10, unit: 'oz' });
    expect(quantities.has(id3)).toBe(false); // Zero quantity items not included
  } finally {
    cleanup();
  }
});

test('getPantryQuantities excludes null quantities', () => {
  const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const id = createTestIngredient(ingredientRepo, 'Null Qty Item');
    pantryRepo.create({ ingredientId: id, quantity: null, unit: null, expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: true });

    const quantities = pantryRepo.getPantryQuantities();

    expect(quantities.has(id)).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== Integration Tests ====================

describe('PantryRepository integration', () => {
  test('complete pantry workflow', () => {
    const { pantryRepo, ingredientRepo, cleanup } = setupTestDb();
    try {
      // Add items to pantry
      const chickenId = createTestIngredient(ingredientRepo, 'Chicken Thighs');
      const riceId = createTestIngredient(ingredientRepo, 'Jasmine Rice');
      const soyId = createTestIngredient(ingredientRepo, 'Soy Sauce');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      pantryRepo.create({ ingredientId: chickenId, quantity: 2, unit: 'lbs', expiresAt: tomorrow.toISOString().split('T')[0], location: 'fridge', isPrepared: false, preparationNotes: null, isStaple: false });
      pantryRepo.create({ ingredientId: riceId, quantity: 5, unit: 'lbs', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: true });
      pantryRepo.create({ ingredientId: soyId, quantity: 1, unit: 'bottle', expiresAt: null, location: 'pantry', isPrepared: false, preparationNotes: null, isStaple: true });

      // List all items
      expect(pantryRepo.list().length).toBe(3);

      // Check expiring items
      const expiring = pantryRepo.listExpiring(3);
      expect(expiring.length).toBe(1);
      expect(expiring[0].ingredientName).toBe('Chicken Thighs');

      // Check staples
      const staples = pantryRepo.listStaples();
      expect(staples.length).toBe(2);

      // Use some chicken
      pantryRepo.useByIngredientName('Chicken Thighs', 1);
      expect(pantryRepo.getByIngredientName('Chicken Thighs')?.quantity).toBe(1);

      // Update rice location
      const riceItem = pantryRepo.getByIngredientName('Jasmine Rice');
      pantryRepo.update(riceItem!.id, { location: 'freezer' });
      expect(pantryRepo.getByIngredientName('Jasmine Rice')?.location).toBe('freezer');

      // Get quantities map
      const quantities = pantryRepo.getPantryQuantities();
      expect(quantities.size).toBe(3);

      // Delete chicken
      pantryRepo.deleteByIngredientName('Chicken Thighs');
      expect(pantryRepo.list().length).toBe(2);
    } finally {
      cleanup();
    }
  });
});
