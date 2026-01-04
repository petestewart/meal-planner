/**
 * Unit tests for IngredientRepository
 *
 * Tests ingredient CRUD operations, category management, and auto-categorization.
 */

import { test, expect, describe } from 'vitest';
import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import {
  IngredientRepository,
  getAutoCategory,
  isValidCategory,
  INGREDIENT_CATEGORIES,
} from '../src/repos/ingredient.repo.js';
import type { Database } from 'better-sqlite3';

// Database setup helper
interface TestContext {
  db: Database;
  ingredientRepo: IngredientRepository;
  cleanup: () => void;
}

function setupTestDb(): TestContext {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const ingredientRepo = new IngredientRepository(db);

  return {
    db,
    ingredientRepo,
    cleanup: () => closeDb(db),
  };
}

// =====================
// Basic CRUD Tests
// =====================

test('can create an ingredient', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredient = ingredientRepo.create({
      name: 'Test Ingredient',
      category: 'Produce',
      defaultUnit: 'pieces',
    });

    expect(ingredient.id).toBeDefined();
    expect(ingredient.name).toBe('Test Ingredient');
    expect(ingredient.category).toBe('Produce');
    expect(ingredient.defaultUnit).toBe('pieces');
  } finally {
    cleanup();
  }
});

test('can get ingredient by ID', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const created = ingredientRepo.create({
      name: 'Test Ingredient',
      category: 'Produce',
      defaultUnit: null,
    });

    const retrieved = ingredientRepo.getById(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.name).toBe('Test Ingredient');
  } finally {
    cleanup();
  }
});

test('getById returns null for non-existent ingredient', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const result = ingredientRepo.getById('non-existent-id');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('can get ingredient by name (case-insensitive)', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    ingredientRepo.create({
      name: 'Chicken Breast',
      category: 'Meat',
      defaultUnit: 'lbs',
    });

    const result1 = ingredientRepo.getByName('Chicken Breast');
    expect(result1).toBeDefined();
    expect(result1?.name).toBe('Chicken Breast');

    const result2 = ingredientRepo.getByName('chicken breast');
    expect(result2).toBeDefined();
    expect(result2?.name).toBe('Chicken Breast');

    const result3 = ingredientRepo.getByName('CHICKEN BREAST');
    expect(result3).toBeDefined();
    expect(result3?.name).toBe('Chicken Breast');
  } finally {
    cleanup();
  }
});

test('getByName returns null for non-existent ingredient', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const result = ingredientRepo.getByName('Non Existent');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

// =====================
// getOrCreate Tests
// =====================

test('getOrCreate returns existing ingredient', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const created = ingredientRepo.create({
      name: 'Existing Ingredient',
      category: 'Pantry',
      defaultUnit: null,
    });

    const result = ingredientRepo.getOrCreate('Existing Ingredient');
    expect(result.id).toBe(created.id);
    expect(result.category).toBe('Pantry');
  } finally {
    cleanup();
  }
});

test('getOrCreate creates new ingredient if not exists', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const result = ingredientRepo.getOrCreate('New Ingredient', 'Dairy', 'cups');
    expect(result.id).toBeDefined();
    expect(result.name).toBe('New Ingredient');
    expect(result.category).toBe('Dairy');
    expect(result.defaultUnit).toBe('cups');

    // Verify it was created
    const retrieved = ingredientRepo.getByName('New Ingredient');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(result.id);
  } finally {
    cleanup();
  }
});

// =====================
// Auto-Categorization Tests
// =====================

test('getOrCreate auto-categorizes common ingredients', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    // Test various common ingredients
    const chicken = ingredientRepo.getOrCreate('chicken');
    expect(chicken.category).toBe('Meat');

    const milk = ingredientRepo.getOrCreate('milk');
    expect(milk.category).toBe('Dairy');

    const salmon = ingredientRepo.getOrCreate('salmon');
    expect(salmon.category).toBe('Seafood');

    const broccoli = ingredientRepo.getOrCreate('broccoli');
    expect(broccoli.category).toBe('Produce');

    const bread = ingredientRepo.getOrCreate('bread');
    expect(bread.category).toBe('Bakery');

    const oliveOil = ingredientRepo.getOrCreate('olive oil');
    expect(oliveOil.category).toBe('Pantry');

    const salt = ingredientRepo.getOrCreate('salt');
    expect(salt.category).toBe('Spices');

    const ketchup = ingredientRepo.getOrCreate('ketchup');
    expect(ketchup.category).toBe('Condiments');
  } finally {
    cleanup();
  }
});

test('getOrCreate uses null category for unknown ingredients', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const unknown = ingredientRepo.getOrCreate('mystery ingredient xyz');
    expect(unknown.category).toBeNull();
  } finally {
    cleanup();
  }
});

test('getOrCreate respects explicitly provided category over auto-category', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    // Chicken would normally be auto-categorized as Meat
    const result = ingredientRepo.getOrCreate('chicken', 'Frozen', null);
    expect(result.category).toBe('Frozen');
  } finally {
    cleanup();
  }
});

// =====================
// Category Update Tests
// =====================

test('updateCategory updates ingredient category by ID', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredient = ingredientRepo.create({
      name: 'Test Ingredient',
      category: 'Produce',
      defaultUnit: null,
    });

    const updated = ingredientRepo.updateCategory(ingredient.id, 'Meat');
    expect(updated).toBeDefined();
    expect(updated?.category).toBe('Meat');

    // Verify it was persisted
    const retrieved = ingredientRepo.getById(ingredient.id);
    expect(retrieved?.category).toBe('Meat');
  } finally {
    cleanup();
  }
});

test('updateCategory returns null for non-existent ingredient', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const result = ingredientRepo.updateCategory('non-existent-id', 'Meat');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('updateCategoryByName updates ingredient category by name', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    ingredientRepo.create({
      name: 'Test Ingredient',
      category: null,
      defaultUnit: null,
    });

    const updated = ingredientRepo.updateCategoryByName('Test Ingredient', 'Dairy');
    expect(updated).toBeDefined();
    expect(updated?.category).toBe('Dairy');
  } finally {
    cleanup();
  }
});

test('updateCategoryByName is case-insensitive', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    ingredientRepo.create({
      name: 'Chicken Breast',
      category: null,
      defaultUnit: null,
    });

    const updated = ingredientRepo.updateCategoryByName('chicken breast', 'Meat');
    expect(updated).toBeDefined();
    expect(updated?.category).toBe('Meat');
    expect(updated?.name).toBe('Chicken Breast');
  } finally {
    cleanup();
  }
});

test('updateCategoryByName returns null for non-existent ingredient', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const result = ingredientRepo.updateCategoryByName('Non Existent', 'Meat');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('updateCategory can set category to null', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    const ingredient = ingredientRepo.create({
      name: 'Test Ingredient',
      category: 'Produce',
      defaultUnit: null,
    });

    const updated = ingredientRepo.updateCategory(ingredient.id, null);
    expect(updated).toBeDefined();
    expect(updated?.category).toBeNull();
  } finally {
    cleanup();
  }
});

// =====================
// List Tests
// =====================

test('list returns all ingredients', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    ingredientRepo.create({ name: 'Ingredient 1', category: 'Produce', defaultUnit: null });
    ingredientRepo.create({ name: 'Ingredient 2', category: 'Meat', defaultUnit: null });
    ingredientRepo.create({ name: 'Ingredient 3', category: 'Produce', defaultUnit: null });

    const all = ingredientRepo.list();
    expect(all.length).toBe(3);
  } finally {
    cleanup();
  }
});

test('list can filter by category', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    ingredientRepo.create({ name: 'Ingredient 1', category: 'Produce', defaultUnit: null });
    ingredientRepo.create({ name: 'Ingredient 2', category: 'Meat', defaultUnit: null });
    ingredientRepo.create({ name: 'Ingredient 3', category: 'Produce', defaultUnit: null });

    const produce = ingredientRepo.list('Produce');
    expect(produce.length).toBe(2);
    expect(produce.every((i) => i.category === 'Produce')).toBe(true);

    const meat = ingredientRepo.list('Meat');
    expect(meat.length).toBe(1);
    expect(meat[0].category).toBe('Meat');
  } finally {
    cleanup();
  }
});

test('list returns ingredients sorted by name', () => {
  const { ingredientRepo, cleanup } = setupTestDb();
  try {
    ingredientRepo.create({ name: 'Zucchini', category: 'Produce', defaultUnit: null });
    ingredientRepo.create({ name: 'Apples', category: 'Produce', defaultUnit: null });
    ingredientRepo.create({ name: 'Carrots', category: 'Produce', defaultUnit: null });

    const all = ingredientRepo.list();
    expect(all[0].name).toBe('Apples');
    expect(all[1].name).toBe('Carrots');
    expect(all[2].name).toBe('Zucchini');
  } finally {
    cleanup();
  }
});

// =====================
// Helper Function Tests
// =====================

describe('getAutoCategory', () => {
  test('returns correct categories for common ingredients', () => {
    expect(getAutoCategory('chicken')).toBe('Meat');
    expect(getAutoCategory('milk')).toBe('Dairy');
    expect(getAutoCategory('salmon')).toBe('Seafood');
    expect(getAutoCategory('broccoli')).toBe('Produce');
    expect(getAutoCategory('bread')).toBe('Bakery');
    expect(getAutoCategory('olive oil')).toBe('Pantry');
    expect(getAutoCategory('salt')).toBe('Spices');
    expect(getAutoCategory('ketchup')).toBe('Condiments');
  });

  test('is case-insensitive', () => {
    expect(getAutoCategory('CHICKEN')).toBe('Meat');
    expect(getAutoCategory('Chicken')).toBe('Meat');
    expect(getAutoCategory('ChIcKeN')).toBe('Meat');
  });

  test('handles whitespace', () => {
    expect(getAutoCategory('  chicken  ')).toBe('Meat');
    expect(getAutoCategory('olive oil  ')).toBe('Pantry');
  });

  test('returns null for unknown ingredients', () => {
    expect(getAutoCategory('mystery ingredient')).toBeNull();
    expect(getAutoCategory('xyz123')).toBeNull();
  });
});

describe('isValidCategory', () => {
  test('returns true for valid categories', () => {
    expect(isValidCategory('Produce')).toBe(true);
    expect(isValidCategory('Dairy')).toBe(true);
    expect(isValidCategory('Meat')).toBe(true);
    expect(isValidCategory('Seafood')).toBe(true);
    expect(isValidCategory('Bakery')).toBe(true);
    expect(isValidCategory('Frozen')).toBe(true);
    expect(isValidCategory('Pantry')).toBe(true);
    expect(isValidCategory('Beverages')).toBe(true);
    expect(isValidCategory('Condiments')).toBe(true);
    expect(isValidCategory('Spices')).toBe(true);
    expect(isValidCategory('Other')).toBe(true);
  });

  test('returns false for invalid categories', () => {
    expect(isValidCategory('produce')).toBe(false); // lowercase
    expect(isValidCategory('MEAT')).toBe(false); // uppercase
    expect(isValidCategory('Invalid')).toBe(false);
    expect(isValidCategory('')).toBe(false);
  });
});

describe('INGREDIENT_CATEGORIES', () => {
  test('contains all expected categories', () => {
    expect(INGREDIENT_CATEGORIES).toContain('Produce');
    expect(INGREDIENT_CATEGORIES).toContain('Dairy');
    expect(INGREDIENT_CATEGORIES).toContain('Meat');
    expect(INGREDIENT_CATEGORIES).toContain('Seafood');
    expect(INGREDIENT_CATEGORIES).toContain('Bakery');
    expect(INGREDIENT_CATEGORIES).toContain('Frozen');
    expect(INGREDIENT_CATEGORIES).toContain('Pantry');
    expect(INGREDIENT_CATEGORIES).toContain('Beverages');
    expect(INGREDIENT_CATEGORIES).toContain('Condiments');
    expect(INGREDIENT_CATEGORIES).toContain('Spices');
    expect(INGREDIENT_CATEGORIES).toContain('Other');
  });

  test('has 11 categories', () => {
    expect(INGREDIENT_CATEGORIES.length).toBe(11);
  });
});
