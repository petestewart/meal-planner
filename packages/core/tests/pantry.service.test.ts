/**
 * Integration tests for PantryService
 *
 * Tests all pantry service operations against an in-memory SQLite database.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { PantryService } from '../src/services/pantry.service.js';
import { IngredientRepository } from '../src/repos/ingredient.repo.js';
import type { Database } from 'better-sqlite3';

// Database setup helper
function setupTestDb(): {
  db: Database;
  service: PantryService;
  ingredientRepo: IngredientRepository;
  cleanup: () => void;
} {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  const service = new PantryService(db);
  const ingredientRepo = new IngredientRepository(db);

  return {
    db,
    service,
    ingredientRepo,
    cleanup: () => closeDb(db),
  };
}

// ==================== addItem Tests ====================

test('addItem creates new pantry item', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.addItem({
      ingredientName: 'Tomatoes',
      quantity: 5,
      unit: 'pieces',
      location: 'fridge',
    });

    expect(result.created).toBe(true);
    expect(result.item).toBeDefined();
    expect(result.item.ingredientName).toBe('Tomatoes');
    expect(result.item.quantity).toBe(5);
    expect(result.item.unit).toBe('pieces');
    expect(result.item.location).toBe('fridge');
  } finally {
    cleanup();
  }
});

test('addItem creates ingredient if not exists', () => {
  const { service, ingredientRepo, cleanup } = setupTestDb();
  try {
    // Ingredient doesn't exist yet
    expect(ingredientRepo.getByName('New Ingredient')).toBeNull();

    const result = service.addItem({
      ingredientName: 'New Ingredient',
      quantity: 1,
      unit: 'piece',
    });

    expect(result.created).toBe(true);
    // Ingredient should now exist
    expect(ingredientRepo.getByName('New Ingredient')).not.toBeNull();
  } finally {
    cleanup();
  }
});

test('addItem updates existing item quantity', () => {
  const { service, cleanup } = setupTestDb();
  try {
    // Add initial item
    service.addItem({
      ingredientName: 'Milk',
      quantity: 1,
      unit: 'gallon',
      location: 'fridge',
    });

    // Add more of the same
    const result = service.addItem({
      ingredientName: 'Milk',
      quantity: 2,
    });

    expect(result.created).toBe(false);
    expect(result.item.quantity).toBe(3); // 1 + 2
  } finally {
    cleanup();
  }
});

test('addItem updates other fields when provided', () => {
  const { service, cleanup } = setupTestDb();
  try {
    // Add initial item
    service.addItem({
      ingredientName: 'Butter',
      quantity: 1,
      unit: 'lb',
      location: 'fridge',
      isStaple: false,
    });

    // Update with new fields
    const result = service.addItem({
      ingredientName: 'Butter',
      quantity: 1,
      unit: 'lbs',
      location: 'freezer',
      isStaple: true,
      expiresAt: '2024-12-31',
      isPrepared: true,
      preparationNotes: 'Softened',
    });

    expect(result.created).toBe(false);
    expect(result.item.unit).toBe('lbs');
    expect(result.item.location).toBe('freezer');
    expect(result.item.isStaple).toBe(true);
    expect(result.item.expiresAt).toBe('2024-12-31');
    expect(result.item.isPrepared).toBe(true);
    expect(result.item.preparationNotes).toBe('Softened');
  } finally {
    cleanup();
  }
});

test('addItem with minimal input', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.addItem({
      ingredientName: 'Salt',
    });

    expect(result.created).toBe(true);
    expect(result.item.ingredientName).toBe('Salt');
    expect(result.item.quantity).toBeNull();
    expect(result.item.unit).toBeNull();
    expect(result.item.isStaple).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== getByIngredientName Tests ====================

test('getByIngredientName returns item', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.addItem({
      ingredientName: 'Chicken',
      quantity: 2,
      unit: 'lbs',
      location: 'fridge',
    });

    const result = service.getByIngredientName('Chicken');

    expect(result).not.toBeNull();
    expect(result?.ingredientName).toBe('Chicken');
    expect(result?.quantity).toBe(2);
  } finally {
    cleanup();
  }
});

test('getByIngredientName returns null for non-existent item', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.getByIngredientName('Non Existent');
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== listItems Tests ====================

test('listItems returns all items', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.addItem({ ingredientName: 'Item 1', quantity: 1, location: 'fridge' });
    service.addItem({ ingredientName: 'Item 2', quantity: 2, location: 'pantry' });
    service.addItem({ ingredientName: 'Item 3', quantity: 3, location: 'freezer' });

    const items = service.listItems();

    expect(items.length).toBe(3);
  } finally {
    cleanup();
  }
});

test('listItems with location filter', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.addItem({ ingredientName: 'Fridge Item', location: 'fridge' });
    service.addItem({ ingredientName: 'Pantry Item', location: 'pantry' });

    const fridgeItems = service.listItems({ location: 'fridge' });

    expect(fridgeItems.length).toBe(1);
    expect(fridgeItems[0].ingredientName).toBe('Fridge Item');
  } finally {
    cleanup();
  }
});

test('listItems with isStaple filter', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.addItem({ ingredientName: 'Staple', isStaple: true, location: 'pantry' });
    service.addItem({ ingredientName: 'Non Staple', isStaple: false, location: 'fridge' });

    const staples = service.listItems({ isStaple: true });

    expect(staples.length).toBe(1);
    expect(staples[0].ingredientName).toBe('Staple');
  } finally {
    cleanup();
  }
});

// ==================== listExpiringItems Tests ====================

test('listExpiringItems returns expiring items', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    service.addItem({
      ingredientName: 'Expiring Soon',
      expiresAt: tomorrow.toISOString().split('T')[0],
      location: 'fridge',
    });
    service.addItem({
      ingredientName: 'Not Expiring',
      expiresAt: nextMonth.toISOString().split('T')[0],
      location: 'fridge',
    });
    service.addItem({
      ingredientName: 'No Expiry',
      location: 'pantry',
    });

    const expiring = service.listExpiringItems(7);

    expect(expiring.length).toBe(1);
    expect(expiring[0].ingredientName).toBe('Expiring Soon');
  } finally {
    cleanup();
  }
});

test('listExpiringItems uses default 7 days', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);

    service.addItem({
      ingredientName: 'Expiring',
      expiresAt: threeDays.toISOString().split('T')[0],
      location: 'fridge',
    });

    const expiring = service.listExpiringItems();

    expect(expiring.length).toBe(1);
  } finally {
    cleanup();
  }
});

// ==================== listStaples Tests ====================

test('listStaples returns only staple items', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.addItem({ ingredientName: 'Salt', isStaple: true, location: 'pantry' });
    service.addItem({ ingredientName: 'Flour', isStaple: true, location: 'pantry' });
    service.addItem({ ingredientName: 'Fresh Meat', isStaple: false, location: 'fridge' });

    const staples = service.listStaples();

    expect(staples.length).toBe(2);
    expect(staples.every(s => s.isStaple)).toBe(true);
  } finally {
    cleanup();
  }
});

// ==================== useItem Tests ====================

test('useItem decrements quantity', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.addItem({
      ingredientName: 'Eggs',
      quantity: 12,
      unit: 'pieces',
      location: 'fridge',
    });

    const result = service.useItem('Eggs', 3);

    expect(result).not.toBeNull();
    expect(result?.quantity).toBe(9);
  } finally {
    cleanup();
  }
});

test('useItem returns null for non-existent item', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.useItem('Non Existent', 1);
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== removeItem Tests ====================

test('removeItem deletes item', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.addItem({
      ingredientName: 'To Remove',
      quantity: 1,
      location: 'fridge',
    });

    const removed = service.removeItem('To Remove');

    expect(removed).toBe(true);
    expect(service.getByIngredientName('To Remove')).toBeNull();
  } finally {
    cleanup();
  }
});

test('removeItem returns false for non-existent item', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.removeItem('Non Existent');
    expect(result).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== updateItem Tests ====================

test('updateItem modifies item fields', () => {
  const { service, cleanup } = setupTestDb();
  try {
    service.addItem({
      ingredientName: 'Cheese',
      quantity: 8,
      unit: 'oz',
      location: 'fridge',
    });

    const updated = service.updateItem('Cheese', {
      quantity: 16,
      location: 'freezer',
      isStaple: true,
    });

    expect(updated).not.toBeNull();
    expect(updated?.quantity).toBe(16);
    expect(updated?.location).toBe('freezer');
    expect(updated?.isStaple).toBe(true);
  } finally {
    cleanup();
  }
});

test('updateItem returns null for non-existent item', () => {
  const { service, cleanup } = setupTestDb();
  try {
    const result = service.updateItem('Non Existent', { quantity: 5 });
    expect(result).toBeNull();
  } finally {
    cleanup();
  }
});

// ==================== getPantryQuantities Tests ====================

test('getPantryQuantities returns quantity map', () => {
  const { service, ingredientRepo, cleanup } = setupTestDb();
  try {
    service.addItem({ ingredientName: 'Flour', quantity: 5, unit: 'cups', location: 'pantry' });
    service.addItem({ ingredientName: 'Sugar', quantity: 3, unit: 'cups', location: 'pantry' });

    const quantities = service.getPantryQuantities();

    const flour = ingredientRepo.getByName('Flour');
    const sugar = ingredientRepo.getByName('Sugar');

    expect(quantities.get(flour!.id)).toEqual({ quantity: 5, unit: 'cups' });
    expect(quantities.get(sugar!.id)).toEqual({ quantity: 3, unit: 'cups' });
  } finally {
    cleanup();
  }
});

// ==================== hasIngredient Tests ====================

test('hasIngredient returns true when ingredient exists', () => {
  const { service, ingredientRepo, cleanup } = setupTestDb();
  try {
    service.addItem({ ingredientName: 'Butter', quantity: 2, location: 'fridge' });

    const butter = ingredientRepo.getByName('Butter');

    expect(service.hasIngredient(butter!.id)).toBe(true);
  } finally {
    cleanup();
  }
});

test('hasIngredient returns false when ingredient not in pantry', () => {
  const { service, ingredientRepo, cleanup } = setupTestDb();
  try {
    // Create ingredient but don't add to pantry
    const ing = ingredientRepo.create({ name: 'Not In Pantry', category: 'Other', defaultUnit: null });

    expect(service.hasIngredient(ing.id)).toBe(false);
  } finally {
    cleanup();
  }
});

test('hasIngredient checks required quantity', () => {
  const { service, ingredientRepo, cleanup } = setupTestDb();
  try {
    service.addItem({ ingredientName: 'Rice', quantity: 2, unit: 'cups', location: 'pantry' });

    const rice = ingredientRepo.getByName('Rice');

    expect(service.hasIngredient(rice!.id, 1)).toBe(true);
    expect(service.hasIngredient(rice!.id, 2)).toBe(true);
    expect(service.hasIngredient(rice!.id, 3)).toBe(false);
  } finally {
    cleanup();
  }
});

// ==================== getByIngredientIds Tests ====================

test('getByIngredientIds returns matching items', () => {
  const { service, ingredientRepo, cleanup } = setupTestDb();
  try {
    service.addItem({ ingredientName: 'Item A', quantity: 1, location: 'fridge' });
    service.addItem({ ingredientName: 'Item B', quantity: 2, location: 'pantry' });

    const itemA = ingredientRepo.getByName('Item A');
    const itemB = ingredientRepo.getByName('Item B');
    const itemC = ingredientRepo.create({ name: 'Item C', category: 'Other', defaultUnit: null });

    const items = service.getByIngredientIds([itemA!.id, itemB!.id, itemC.id]);

    expect(items.length).toBe(2);
  } finally {
    cleanup();
  }
});

// ==================== Integration Tests ====================

describe('PantryService integration', () => {
  test('complete pantry workflow', () => {
    const { service, cleanup } = setupTestDb();
    try {
      // Add staple items
      service.addItem({
        ingredientName: 'Salt',
        isStaple: true,
        location: 'pantry',
      });
      service.addItem({
        ingredientName: 'Olive Oil',
        quantity: 1,
        unit: 'bottle',
        isStaple: true,
        location: 'pantry',
      });

      // Add fresh items with expiration
      const twoDays = new Date();
      twoDays.setDate(twoDays.getDate() + 2);

      service.addItem({
        ingredientName: 'Chicken Breast',
        quantity: 2,
        unit: 'lbs',
        expiresAt: twoDays.toISOString().split('T')[0],
        location: 'fridge',
      });

      // Verify staples
      expect(service.listStaples().length).toBe(2);

      // Verify expiring items
      expect(service.listExpiringItems(7).length).toBe(1);

      // Use some chicken
      service.useItem('Chicken Breast', 1);
      expect(service.getByIngredientName('Chicken Breast')?.quantity).toBe(1);

      // Add more olive oil
      service.addItem({
        ingredientName: 'Olive Oil',
        quantity: 1,
      });
      expect(service.getByIngredientName('Olive Oil')?.quantity).toBe(2);

      // Update salt to have quantity
      service.updateItem('Salt', { quantity: 1, unit: 'container' });
      expect(service.getByIngredientName('Salt')?.unit).toBe('container');

      // Remove chicken
      service.removeItem('Chicken Breast');
      expect(service.getByIngredientName('Chicken Breast')).toBeNull();

      // Final count
      expect(service.listItems().length).toBe(2);
    } finally {
      cleanup();
    }
  });
});
