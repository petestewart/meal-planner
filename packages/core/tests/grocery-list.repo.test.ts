/**
 * Integration tests for GroceryListRepository
 *
 * Tests all CRUD operations against an in-memory SQLite database.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { GroceryListRepository } from '../src/repos/grocery-list.repo.js';
import { IngredientRepository } from '../src/repos/ingredient.repo.js';
import type { Database } from 'better-sqlite3';

// Database setup helper
function setupTestDb(): {
  db: Database;
  repo: GroceryListRepository;
  ingredientRepo: IngredientRepository;
  cleanup: () => void;
} {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const repo = new GroceryListRepository(db);
  const ingredientRepo = new IngredientRepository(db);

  return {
    db,
    repo,
    ingredientRepo,
    cleanup: () => closeDb(db),
  };
}

// ==================== Grocery List CRUD Tests ====================

test('getOrCreateByWeek creates new list', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W01');

    expect(list).toBeDefined();
    expect(list.id.length).toBeGreaterThan(0);
    expect(list.week).toBe('2024-W01');
    expect(list.generatedAt).toBeDefined();
    expect(list.updatedAt).toBeDefined();
    expect(list.items).toEqual([]);
  } finally {
    cleanup();
  }
});

test('getOrCreateByWeek returns existing list', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const created = repo.getOrCreateByWeek('2024-W02');
    const retrieved = repo.getOrCreateByWeek('2024-W02');

    expect(retrieved.id).toBe(created.id);
    expect(retrieved.week).toBe('2024-W02');
  } finally {
    cleanup();
  }
});

test('getByWeek returns list with items', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W03');
    repo.addItem(list.id, { name: 'Apples', quantity: 5, unit: 'pieces' });
    repo.addItem(list.id, { name: 'Bananas', quantity: 6, unit: 'pieces' });

    const result = repo.getByWeek('2024-W03');

    expect(result).toBeDefined();
    expect(result?.items.length).toBe(2);
  } finally {
    cleanup();
  }
});

test('getByWeek returns null for non-existent week', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getByWeek('2024-W99');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('getById returns list with items', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W04');
    repo.addItem(list.id, { name: 'Milk', quantity: 1, unit: 'gallon' });

    const result = repo.getById(list.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(list.id);
    expect(result?.items.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('getById returns null for non-existent ID', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getById('non-existent-id');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('deleteByWeek removes list and items', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W05');
    repo.addItem(list.id, { name: 'Eggs', quantity: 12, unit: 'pieces' });

    const deleted = repo.deleteByWeek('2024-W05');

    expect(deleted).toBe(true);
    expect(repo.getByWeek('2024-W05')).toBeNull();
  } finally {
    cleanup();
  }
});

test('deleteByWeek returns false for non-existent week', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.deleteByWeek('2024-W99');
    expect(result).toBe(false);
  } finally {
    cleanup();
  }
});

test('touch updates updatedAt timestamp', () => {
  const { repo, db, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W06');

    // Set an old timestamp
    const oldTime = '2020-01-01T00:00:00.000Z';
    db.prepare('UPDATE grocery_lists SET updated_at = ? WHERE id = ?').run(oldTime, list.id);

    repo.touch(list.id);

    const updated = repo.getById(list.id);
    expect(updated?.updatedAt).not.toBe(oldTime);
  } finally {
    cleanup();
  }
});

test('setGeneratedAt updates timestamps', () => {
  const { repo, db, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W07');

    // Clear generated_at
    db.prepare('UPDATE grocery_lists SET generated_at = NULL WHERE id = ?').run(list.id);

    repo.setGeneratedAt(list.id);

    const updated = repo.getById(list.id);
    expect(updated?.generatedAt).toBeDefined();
    expect(updated?.generatedAt?.length).toBeGreaterThan(0);
  } finally {
    cleanup();
  }
});

// ==================== Item CRUD Tests ====================

test('addItem creates a new item', () => {
  const { repo, ingredientRepo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W10');
    const ingredient = ingredientRepo.create({ name: 'Chicken Breast', category: 'Meat', defaultUnit: 'lbs' });

    const item = repo.addItem(list.id, {
      name: 'Chicken Breast',
      quantity: 2,
      unit: 'lbs',
      ingredientId: ingredient.id,
      status: 'need_to_buy',
      isManual: false,
      recipes: ['Grilled Chicken', 'Chicken Salad'],
    });

    expect(item).toBeDefined();
    expect(item.id.length).toBeGreaterThan(0);
    expect(item.groceryListId).toBe(list.id);
    expect(item.name).toBe('Chicken Breast');
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe('lbs');
    expect(item.ingredientId).toBe(ingredient.id);
    expect(item.status).toBe('need_to_buy');
    expect(item.isManual).toBe(false);
    expect(item.recipes).toEqual(['Grilled Chicken', 'Chicken Salad']);
  } finally {
    cleanup();
  }
});

test('addItem uses default values', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W11');

    const item = repo.addItem(list.id, { name: 'Salt' });

    expect(item.quantity).toBeNull();
    expect(item.unit).toBeNull();
    expect(item.ingredientId).toBeNull();
    expect(item.status).toBe('need_to_buy');
    expect(item.haveQuantity).toBeNull();
    expect(item.isManual).toBe(false);
    expect(item.recipes).toEqual([]);
  } finally {
    cleanup();
  }
});

test('getItems returns all items sorted by name', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W12');
    repo.addItem(list.id, { name: 'Zucchini' });
    repo.addItem(list.id, { name: 'Apples' });
    repo.addItem(list.id, { name: 'Milk' });

    const items = repo.getItems(list.id);

    expect(items.length).toBe(3);
    expect(items[0].name).toBe('Apples');
    expect(items[1].name).toBe('Milk');
    expect(items[2].name).toBe('Zucchini');
  } finally {
    cleanup();
  }
});

test('getItemById returns item', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W13');
    const created = repo.addItem(list.id, { name: 'Bread', quantity: 1, unit: 'loaf' });

    const item = repo.getItemById(created.id);

    expect(item).toBeDefined();
    expect(item?.id).toBe(created.id);
    expect(item?.name).toBe('Bread');
  } finally {
    cleanup();
  }
});

test('getItemById returns null for non-existent item', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.getItemById('non-existent-id');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('findItemByName finds item case-insensitively', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W14');
    const created = repo.addItem(list.id, { name: 'Olive Oil', quantity: 1, unit: 'bottle' });

    const result1 = repo.findItemByName(list.id, 'Olive Oil');
    const result2 = repo.findItemByName(list.id, 'olive oil');
    const result3 = repo.findItemByName(list.id, 'OLIVE OIL');

    expect(result1?.id).toBe(created.id);
    expect(result2?.id).toBe(created.id);
    expect(result3?.id).toBe(created.id);
  } finally {
    cleanup();
  }
});

test('findItemByName returns null for non-existent item', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W15');
    const result = repo.findItemByName(list.id, 'Non Existent');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('updateItem modifies item fields', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W16');
    const created = repo.addItem(list.id, { name: 'Butter', quantity: 1, unit: 'lb', status: 'need_to_buy' });

    const updated = repo.updateItem(created.id, {
      status: 'already_have',
      quantity: 2,
      unit: 'lbs',
    });

    expect(updated?.status).toBe('already_have');
    expect(updated?.quantity).toBe(2);
    expect(updated?.unit).toBe('lbs');
  } finally {
    cleanup();
  }
});

test('updateItem returns null for non-existent item', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.updateItem('non-existent-id', { status: 'already_have' });
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

test('updateItem with no changes returns existing item', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W17');
    const created = repo.addItem(list.id, { name: 'Cheese', quantity: 8, unit: 'oz' });

    const updated = repo.updateItem(created.id, {});

    expect(updated?.id).toBe(created.id);
    expect(updated?.quantity).toBe(8);
  } finally {
    cleanup();
  }
});

test('deleteItem removes item', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W18');
    const created = repo.addItem(list.id, { name: 'To Delete' });

    const deleted = repo.deleteItem(created.id);

    expect(deleted).toBe(true);
    expect(repo.getItemById(created.id)).toBeNull();
  } finally {
    cleanup();
  }
});

test('deleteItem returns false for non-existent item', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const result = repo.deleteItem('non-existent-id');
    expect(result).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== Clear Items Tests ====================

test('clearItems removes all items from list', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W20');
    repo.addItem(list.id, { name: 'Item 1' });
    repo.addItem(list.id, { name: 'Item 2' });
    repo.addItem(list.id, { name: 'Item 3' });

    repo.clearItems(list.id);

    expect(repo.getItems(list.id)).toEqual([]);
  } finally {
    cleanup();
  }
});

test('clearNonManualItems keeps manual items', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W21');
    repo.addItem(list.id, { name: 'Auto Item 1', isManual: false });
    repo.addItem(list.id, { name: 'Manual Item', isManual: true });
    repo.addItem(list.id, { name: 'Auto Item 2', isManual: false });

    repo.clearNonManualItems(list.id);

    const items = repo.getItems(list.id);
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('Manual Item');
    expect(items[0].isManual).toBe(true);
  } finally {
    cleanup();
  }
});

// ==================== Bulk Operations Tests ====================

test('bulkAddItems adds multiple items', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W22');

    const items = repo.bulkAddItems(list.id, [
      { name: 'Bulk Item 1', quantity: 1, unit: 'piece' },
      { name: 'Bulk Item 2', quantity: 2, unit: 'pieces' },
      { name: 'Bulk Item 3', quantity: 3, unit: 'pieces' },
    ]);

    expect(items.length).toBe(3);
    expect(repo.getItems(list.id).length).toBe(3);
  } finally {
    cleanup();
  }
});

test('bulkAddItems handles empty array', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W23');

    const items = repo.bulkAddItems(list.id, []);

    expect(items).toEqual([]);
  } finally {
    cleanup();
  }
});

// ==================== Status Helper Tests ====================

test('markAsHave sets status to already_have', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W25');
    const created = repo.addItem(list.id, { name: 'Have Item', status: 'need_to_buy' });

    const updated = repo.markAsHave(created.id);

    expect(updated?.status).toBe('already_have');
  } finally {
    cleanup();
  }
});

test('markAsPartial sets status and haveQuantity', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W26');
    const created = repo.addItem(list.id, { name: 'Partial Item', quantity: 10, status: 'need_to_buy' });

    const updated = repo.markAsPartial(created.id, 5);

    expect(updated?.status).toBe('partial');
    expect(updated?.haveQuantity).toBe(5);
  } finally {
    cleanup();
  }
});

test('markAsNeedToBuy resets status', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W27');
    const created = repo.addItem(list.id, { name: 'Reset Item', status: 'already_have', haveQuantity: 5 });

    const updated = repo.markAsNeedToBuy(created.id);

    expect(updated?.status).toBe('need_to_buy');
    expect(updated?.haveQuantity).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== Status Query Tests ====================

test('getItemsByStatus filters items', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W28');
    repo.addItem(list.id, { name: 'Need 1', status: 'need_to_buy' });
    repo.addItem(list.id, { name: 'Have 1', status: 'already_have' });
    repo.addItem(list.id, { name: 'Need 2', status: 'need_to_buy' });
    repo.addItem(list.id, { name: 'Partial 1', status: 'partial' });

    const needToBuy = repo.getItemsByStatus(list.id, 'need_to_buy');
    expect(needToBuy.length).toBe(2);
    expect(needToBuy.every(i => i.status === 'need_to_buy')).toBe(true);

    const alreadyHave = repo.getItemsByStatus(list.id, 'already_have');
    expect(alreadyHave.length).toBe(1);

    const partial = repo.getItemsByStatus(list.id, 'partial');
    expect(partial.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('countByStatus returns correct counts', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W29');
    repo.addItem(list.id, { name: 'Need 1', status: 'need_to_buy' });
    repo.addItem(list.id, { name: 'Need 2', status: 'need_to_buy' });
    repo.addItem(list.id, { name: 'Need 3', status: 'need_to_buy' });
    repo.addItem(list.id, { name: 'Have 1', status: 'already_have' });
    repo.addItem(list.id, { name: 'Have 2', status: 'already_have' });
    repo.addItem(list.id, { name: 'Partial 1', status: 'partial' });

    const counts = repo.countByStatus(list.id);

    expect(counts.needToBuy).toBe(3);
    expect(counts.alreadyHave).toBe(2);
    expect(counts.partial).toBe(1);
  } finally {
    cleanup();
  }
});

test('countByStatus returns zeros for empty list', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W30');

    const counts = repo.countByStatus(list.id);

    expect(counts.needToBuy).toBe(0);
    expect(counts.alreadyHave).toBe(0);
    expect(counts.partial).toBe(0);
  } finally {
    cleanup();
  }
});

// ==================== Recipe Parsing Tests ====================

test('handles items with recipes array', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W31');

    const item = repo.addItem(list.id, {
      name: 'Tomatoes',
      recipes: ['Pasta Sauce', 'Salad', 'Bruschetta'],
    });

    expect(item.recipes).toEqual(['Pasta Sauce', 'Salad', 'Bruschetta']);

    // Verify it persists correctly
    const retrieved = repo.getItemById(item.id);
    expect(retrieved?.recipes).toEqual(['Pasta Sauce', 'Salad', 'Bruschetta']);
  } finally {
    cleanup();
  }
});

test('handles items with empty recipes array', () => {
  const { repo, cleanup } = setupTestDb();
  try {
    const list = repo.getOrCreateByWeek('2024-W32');

    const item = repo.addItem(list.id, {
      name: 'Manual Item',
      recipes: [],
    });

    expect(item.recipes).toEqual([]);
  } finally {
    cleanup();
  }
});

// ==================== Integration Tests ====================

describe('GroceryListRepository integration', () => {
  test('complete grocery list workflow', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      // Create list for the week
      const list = repo.getOrCreateByWeek('2024-W40');
      expect(list.items.length).toBe(0);

      // Bulk add items from meal plan
      repo.bulkAddItems(list.id, [
        { name: 'Chicken', quantity: 2, unit: 'lbs', recipes: ['Chicken Dinner'] },
        { name: 'Rice', quantity: 1, unit: 'bag', recipes: ['Chicken Dinner'] },
        { name: 'Broccoli', quantity: 2, unit: 'heads', recipes: ['Chicken Dinner'] },
      ]);

      expect(repo.getItems(list.id).length).toBe(3);

      // User manually adds an item
      repo.addItem(list.id, { name: 'Snacks', isManual: true });
      expect(repo.getItems(list.id).length).toBe(4);

      // Check pantry - mark items already have
      repo.markAsHave(repo.findItemByName(list.id, 'Rice')!.id);
      const broccoli = repo.findItemByName(list.id, 'Broccoli');
      repo.markAsPartial(broccoli!.id, 1);

      // Verify status counts
      const counts = repo.countByStatus(list.id);
      expect(counts.needToBuy).toBe(2);
      expect(counts.alreadyHave).toBe(1);
      expect(counts.partial).toBe(1);

      // Get shopping list (need_to_buy only)
      const toBuy = repo.getItemsByStatus(list.id, 'need_to_buy');
      expect(toBuy.length).toBe(2);

      // Regenerate list (clear non-manual, keep manual)
      repo.clearNonManualItems(list.id);
      const afterClear = repo.getItems(list.id);
      expect(afterClear.length).toBe(1);
      expect(afterClear[0].name).toBe('Snacks');
      expect(afterClear[0].isManual).toBe(true);

      // Get same list again (should return existing)
      const sameList = repo.getOrCreateByWeek('2024-W40');
      expect(sameList.id).toBe(list.id);
    } finally {
      cleanup();
    }
  });
});

describe('GroceryListRepository edge cases', () => {
  test('handles special characters in item names', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const list = repo.getOrCreateByWeek('2024-W50');
      const item = repo.addItem(list.id, { name: "Ben & Jerry's Ice Cream" });

      expect(item.name).toBe("Ben & Jerry's Ice Cream");
      expect(repo.findItemByName(list.id, "Ben & Jerry's Ice Cream")).toBeDefined();
    } finally {
      cleanup();
    }
  });

  test('handles unicode in item names', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const list = repo.getOrCreateByWeek('2024-W51');
      const item = repo.addItem(list.id, { name: 'Caf\u00e9 con Leche' });

      expect(item.name).toBe('Caf\u00e9 con Leche');
    } finally {
      cleanup();
    }
  });

  test('handles very long item names', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const list = repo.getOrCreateByWeek('2024-W52');
      const longName = 'A'.repeat(500);
      const item = repo.addItem(list.id, { name: longName });

      expect(item.name).toBe(longName);
    } finally {
      cleanup();
    }
  });

  test('handles multiple lists for different weeks', () => {
    const { repo, cleanup } = setupTestDb();
    try {
      const list1 = repo.getOrCreateByWeek('2024-W01');
      const list2 = repo.getOrCreateByWeek('2024-W02');
      const list3 = repo.getOrCreateByWeek('2024-W03');

      repo.addItem(list1.id, { name: 'Week 1 Item' });
      repo.addItem(list2.id, { name: 'Week 2 Item' });
      repo.addItem(list3.id, { name: 'Week 3 Item' });

      expect(repo.getItems(list1.id).length).toBe(1);
      expect(repo.getItems(list2.id).length).toBe(1);
      expect(repo.getItems(list3.id).length).toBe(1);

      expect(repo.getItems(list1.id)[0].name).toBe('Week 1 Item');
      expect(repo.getItems(list2.id)[0].name).toBe('Week 2 Item');
      expect(repo.getItems(list3.id)[0].name).toBe('Week 3 Item');
    } finally {
      cleanup();
    }
  });
});
