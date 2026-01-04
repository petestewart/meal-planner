/**
 * Pantry service - Business logic for pantry management
 *
 * Provides operations for adding, removing, and using pantry items.
 * Supports expiration tracking, location management, and staple item workflow.
 */

import type { Database } from 'better-sqlite3';
import { PantryRepository, type ListPantryItemsOptions } from '../repos/pantry.repo.js';
import { IngredientRepository } from '../repos/ingredient.repo.js';
import type {
  PantryItem,
  PantryItemWithIngredient,
  PantryLocation,
  CreatePantryItem,
  UpdatePantryItem,
} from '../models/pantry.js';

/**
 * Input for adding a pantry item by ingredient name
 */
export interface AddPantryItemInput {
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
  expiresAt?: string | null; // ISO date YYYY-MM-DD
  location?: PantryLocation | null;
  isPrepared?: boolean;
  preparationNotes?: string | null;
  isStaple?: boolean;
}

/**
 * Result of adding an item to pantry
 */
export interface AddPantryItemResult {
  item: PantryItemWithIngredient;
  created: boolean; // true if new item, false if updated existing
}

export class PantryService {
  private pantryRepo: PantryRepository;
  private ingredientRepo: IngredientRepository;

  constructor(db: Database) {
    this.pantryRepo = new PantryRepository(db);
    this.ingredientRepo = new IngredientRepository(db);
  }

  /**
   * Add an item to the pantry by ingredient name.
   * If the ingredient doesn't exist, it will be created.
   * If the item already exists in pantry, its quantity will be updated.
   */
  addItem(input: AddPantryItemInput): AddPantryItemResult {
    // Get or create the ingredient
    const ingredient = this.ingredientRepo.getOrCreate(input.ingredientName);

    // Check if item already exists in pantry
    const existing = this.pantryRepo.getByIngredientId(ingredient.id);

    if (existing) {
      // Update existing item - add to quantity
      const newQuantity =
        (existing.quantity ?? 0) + (input.quantity ?? 0);

      const updates: UpdatePantryItem = {
        quantity: newQuantity,
      };

      // Only update other fields if provided
      if (input.unit !== undefined) {
        updates.unit = input.unit;
      }
      if (input.expiresAt !== undefined) {
        updates.expiresAt = input.expiresAt;
      }
      if (input.location !== undefined) {
        updates.location = input.location;
      }
      if (input.isPrepared !== undefined) {
        updates.isPrepared = input.isPrepared;
      }
      if (input.preparationNotes !== undefined) {
        updates.preparationNotes = input.preparationNotes;
      }
      if (input.isStaple !== undefined) {
        updates.isStaple = input.isStaple;
      }

      this.pantryRepo.update(existing.id, updates);
      const updated = this.pantryRepo.getByIdWithIngredient(existing.id)!;

      return {
        item: updated,
        created: false,
      };
    }

    // Create new pantry item
    const createData: CreatePantryItem = {
      ingredientId: ingredient.id,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      expiresAt: input.expiresAt ?? null,
      location: input.location ?? null,
      isPrepared: input.isPrepared ?? false,
      preparationNotes: input.preparationNotes ?? null,
      isStaple: input.isStaple ?? false,
    };

    const created = this.pantryRepo.create(createData);
    const withIngredient = this.pantryRepo.getByIdWithIngredient(created.id)!;

    return {
      item: withIngredient,
      created: true,
    };
  }

  /**
   * Get a pantry item by ingredient name
   */
  getByIngredientName(name: string): PantryItemWithIngredient | null {
    return this.pantryRepo.getByIngredientName(name);
  }

  /**
   * List all pantry items
   */
  listItems(options?: ListPantryItemsOptions): PantryItemWithIngredient[] {
    return this.pantryRepo.list(options);
  }

  /**
   * List items expiring within a number of days (default 7)
   */
  listExpiringItems(days: number = 7): PantryItemWithIngredient[] {
    return this.pantryRepo.listExpiring(days);
  }

  /**
   * List staple items
   */
  listStaples(): PantryItemWithIngredient[] {
    return this.pantryRepo.listStaples();
  }

  /**
   * Use (decrement) quantity of a pantry item by name
   */
  useItem(
    ingredientName: string,
    quantity: number
  ): PantryItemWithIngredient | null {
    return this.pantryRepo.useByIngredientName(ingredientName, quantity);
  }

  /**
   * Remove an item from the pantry by ingredient name
   */
  removeItem(ingredientName: string): boolean {
    return this.pantryRepo.deleteByIngredientName(ingredientName);
  }

  /**
   * Update a pantry item by ingredient name
   */
  updateItem(
    ingredientName: string,
    updates: UpdatePantryItem
  ): PantryItemWithIngredient | null {
    const existing = this.pantryRepo.getByIngredientName(ingredientName);
    if (!existing) {
      return null;
    }

    this.pantryRepo.update(existing.id, updates);
    return this.pantryRepo.getByIngredientName(ingredientName);
  }

  /**
   * Get pantry quantities as a map for grocery list checking
   */
  getPantryQuantities(): Map<string, { quantity: number; unit: string | null }> {
    return this.pantryRepo.getPantryQuantities();
  }

  /**
   * Check if an ingredient is in the pantry with sufficient quantity
   */
  hasIngredient(ingredientId: string, requiredQuantity?: number): boolean {
    const item = this.pantryRepo.getByIngredientId(ingredientId);
    if (!item) {
      return false;
    }

    if (requiredQuantity === undefined) {
      return true;
    }

    return (item.quantity ?? 0) >= requiredQuantity;
  }

  /**
   * Get all pantry items by their ingredient IDs
   */
  getByIngredientIds(ingredientIds: string[]): PantryItem[] {
    return this.pantryRepo.getByIngredientIds(ingredientIds);
  }
}
