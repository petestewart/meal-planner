/**
 * Grocery service - Generates aggregated grocery lists from meal plans
 *
 * Takes a week or plan ID, fetches all plan items with their recipes,
 * aggregates ingredients by name (summing quantities), groups by category,
 * and returns a structured grocery list.
 */

import type { Database } from 'better-sqlite3';
import { PlanRepository } from '../repos/plan.repo.js';
import { RecipeRepository } from '../repos/recipe.repo.js';
import { PantryRepository } from '../repos/pantry.repo.js';
import {
  GroceryListRepository,
  type PersistedGroceryListWithItems,
  type PersistedGroceryItem,
  type GroceryItemStatus,
  type CreateGroceryItemInput,
} from '../repos/grocery-list.repo.js';
import type { WeeklyPlanWithItems, RecipeWithRelations } from '../models/index.js';

/**
 * A single item in the grocery list.
 */
export interface GroceryItem {
  /** Ingredient name */
  ingredient: string;
  /** Total quantity needed (aggregated) */
  totalQuantity: number;
  /** Unit of measurement */
  unit: string;
  /** Recipe titles that need this ingredient */
  recipes: string[];
}

/**
 * A group of grocery items by category.
 */
export interface GroceryGroup {
  /** Category name (from ingredients table, or "Uncategorized") */
  name: string;
  /** Items in this category */
  items: GroceryItem[];
}

/**
 * The complete grocery list response.
 */
export interface GroceryList {
  /** ISO week string (e.g., "2025-W02") */
  week: string;
  /** Grouped grocery items by category */
  groups: GroceryGroup[];
  /** ISO timestamp when the list was generated */
  generatedAt: string;
}

/**
 * Internal structure for aggregating ingredients.
 */
interface IngredientAggregation {
  ingredient: string;
  ingredientId: string;
  category: string | null;
  storeSection: string | null;
  /** Map of unit -> quantity */
  quantitiesByUnit: Map<string, number>;
  /** Recipe titles that need this ingredient */
  recipes: Set<string>;
}

/**
 * Raw ingredient row from database.
 */
interface IngredientRow {
  id: string;
  name: string;
  category: string | null;
  default_unit: string | null;
  store_section: string | null;
}

/**
 * Unit conversion factors.
 * Maps from unit -> base unit with conversion factor.
 * Example: 1 tablespoon = 3 teaspoons
 */
const UNIT_CONVERSIONS: Record<string, { baseUnit: string; factor: number }> = {
  // Volume conversions (base: ml)
  'ml': { baseUnit: 'ml', factor: 1 },
  'milliliter': { baseUnit: 'ml', factor: 1 },
  'milliliters': { baseUnit: 'ml', factor: 1 },
  'l': { baseUnit: 'ml', factor: 1000 },
  'liter': { baseUnit: 'ml', factor: 1000 },
  'liters': { baseUnit: 'ml', factor: 1000 },
  'tsp': { baseUnit: 'ml', factor: 5 },
  'teaspoon': { baseUnit: 'ml', factor: 5 },
  'teaspoons': { baseUnit: 'ml', factor: 5 },
  'tbsp': { baseUnit: 'ml', factor: 15 },
  'tablespoon': { baseUnit: 'ml', factor: 15 },
  'tablespoons': { baseUnit: 'ml', factor: 15 },
  'cup': { baseUnit: 'ml', factor: 240 },
  'cups': { baseUnit: 'ml', factor: 240 },

  // Weight conversions (base: g)
  'g': { baseUnit: 'g', factor: 1 },
  'gram': { baseUnit: 'g', factor: 1 },
  'grams': { baseUnit: 'g', factor: 1 },
  'kg': { baseUnit: 'g', factor: 1000 },
  'kilogram': { baseUnit: 'g', factor: 1000 },
  'kilograms': { baseUnit: 'g', factor: 1000 },
  'oz': { baseUnit: 'g', factor: 28.35 },
  'ounce': { baseUnit: 'g', factor: 28.35 },
  'ounces': { baseUnit: 'g', factor: 28.35 },
  'lb': { baseUnit: 'g', factor: 453.6 },
  'pound': { baseUnit: 'g', factor: 453.6 },
  'pounds': { baseUnit: 'g', factor: 453.6 },
};

/**
 * Preferred display units for grocery lists.
 * Converts base units back to more readable units when quantity is appropriate.
 * Uses metric system for consistency.
 */
const DISPLAY_UNIT_THRESHOLDS: Record<string, { threshold: number; unit: string; factor: number }[]> = {
  'ml': [
    { threshold: 1000, unit: 'l', factor: 1000 },
    { threshold: 240, unit: 'cups', factor: 240 },
    { threshold: 15, unit: 'tbsp', factor: 15 },
  ],
  'g': [
    { threshold: 1000, unit: 'kg', factor: 1000 },
  ],
};

/**
 * Normalize a unit string for comparison.
 */
function normalizeUnit(unit: string | null): string {
  if (!unit) return '';
  return unit.toLowerCase().trim();
}

/**
 * Check if two units can be converted to each other.
 */
function areUnitsConvertible(unit1: string, unit2: string): boolean {
  const norm1 = normalizeUnit(unit1);
  const norm2 = normalizeUnit(unit2);

  if (norm1 === norm2) return true;

  const conv1 = UNIT_CONVERSIONS[norm1];
  const conv2 = UNIT_CONVERSIONS[norm2];

  if (!conv1 || !conv2) return false;

  return conv1.baseUnit === conv2.baseUnit;
}

/**
 * Convert a quantity from one unit to a base unit.
 */
function toBaseUnit(quantity: number, unit: string): { quantity: number; baseUnit: string } | null {
  const normUnit = normalizeUnit(unit);
  const conv = UNIT_CONVERSIONS[normUnit];

  if (!conv) return null;

  return {
    quantity: quantity * conv.factor,
    baseUnit: conv.baseUnit,
  };
}

/**
 * Convert a base unit quantity to a more readable display unit.
 */
function toDisplayUnit(quantity: number, baseUnit: string): { quantity: number; unit: string } {
  const thresholds = DISPLAY_UNIT_THRESHOLDS[baseUnit];

  if (thresholds) {
    for (const { threshold, unit, factor } of thresholds) {
      if (quantity >= threshold) {
        return {
          quantity: Math.round((quantity / factor) * 100) / 100,
          unit,
        };
      }
    }
  }

  // Return as-is with base unit
  return {
    quantity: Math.round(quantity * 100) / 100,
    unit: baseUnit,
  };
}

/**
 * A persistent grocery list item with status
 */
export interface GroceryListItemWithStatus {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  status: GroceryItemStatus;
  haveQuantity: number | null;
  isManual: boolean;
  recipes: string[];
  ingredientId: string | null;
  /** Category of the ingredient (looked up from ingredients table) */
  category: string | null;
  /** Store section for grocery organization */
  storeSection: string | null;
}

/**
 * A persistent grocery list with items and status counts
 */
export interface PersistentGroceryList {
  id: string;
  week: string;
  generatedAt: string | null;
  updatedAt: string | null;
  items: GroceryListItemWithStatus[];
  counts: {
    needToBuy: number;
    alreadyHave: number;
    partial: number;
  };
}

/**
 * Result of check-pantry operation
 */
export interface CheckPantryResult {
  week: string;
  itemsChecked: number;
  itemsMarked: number;
  warning?: string;
}

/**
 * Options for generating a grocery list
 */
export interface GenerateListOptions {
  /** Exclude items that are in the pantry (subtract quantities) */
  excludePantry?: boolean;
}

export class GroceryService {
  private planRepo: PlanRepository;
  private recipeRepo: RecipeRepository;
  private groceryListRepo: GroceryListRepository;
  private pantryRepo: PantryRepository;
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.planRepo = new PlanRepository(db);
    this.recipeRepo = new RecipeRepository(db);
    this.groceryListRepo = new GroceryListRepository(db);
    this.pantryRepo = new PantryRepository(db);
  }

  /**
   * Generate a grocery list for a week or plan ID.
   *
   * @param weekOrPlanId - ISO week string (e.g., "2025-W02") or plan ID
   * @param options - Generation options
   * @returns Structured grocery list grouped by category
   */
  generateList(weekOrPlanId: string, options?: GenerateListOptions): GroceryList | null {
    // Try to get plan by week first, then by ID
    let plan: WeeklyPlanWithItems | null = null;

    // Check if it's an ISO week format
    if (/^\d{4}-W\d{2}$/.test(weekOrPlanId)) {
      plan = this.planRepo.getByWeek(weekOrPlanId);
    }

    // If not found by week, try by ID
    if (!plan) {
      plan = this.planRepo.getById(weekOrPlanId);
    }

    if (!plan) {
      return null;
    }

    // Collect all ingredients from plan items
    // Only include items with slot_type 'recipe' (skip dining_out, skip, leftovers)
    const aggregations = new Map<string, IngredientAggregation>();

    // Track batches we've already processed to avoid double-counting
    // Key: batchId, Value: { recipeId, totalServings, recipeTitle }
    const processedBatches = new Map<string, { recipeId: string; totalServings: number; recipeTitle: string }>();

    for (const item of plan.items || []) {
      // Only process recipe slots - skip dining_out, skip, and leftovers
      if (item.slotType && item.slotType !== 'recipe') continue;
      if (!item.recipeId) continue;

      const recipe = this.recipeRepo.getById(item.recipeId);
      if (!recipe || !recipe.ingredients) continue;

      // Check if this item is part of a batch
      if (item.batchId) {
        // If we've already processed this batch, skip it
        if (processedBatches.has(item.batchId)) {
          continue;
        }

        // Get batch info to determine total servings
        const batchRow = this.db
          .prepare('SELECT total_servings FROM prep_batches WHERE id = ?')
          .get(item.batchId) as { total_servings: number } | undefined;

        if (batchRow) {
          // Use batch total servings instead of individual meal servings
          const scaleFactor = batchRow.total_servings / recipe.servings;

          for (const recipeIngredient of recipe.ingredients) {
            this.aggregateIngredient(
              aggregations,
              recipeIngredient.ingredientId,
              recipeIngredient.quantity,
              recipeIngredient.unit,
              scaleFactor,
              `${recipe.title} (batch)`
            );
          }

          // Mark this batch as processed
          processedBatches.set(item.batchId, {
            recipeId: item.recipeId,
            totalServings: batchRow.total_servings,
            recipeTitle: recipe.title,
          });
          continue;
        }
        // If batch not found, fall through to normal processing
      }

      // Normal processing for non-batch items
      // Calculate scaling factor (plan servings / recipe servings)
      const scaleFactor = item.servings / recipe.servings;

      for (const recipeIngredient of recipe.ingredients) {
        this.aggregateIngredient(
          aggregations,
          recipeIngredient.ingredientId,
          recipeIngredient.quantity,
          recipeIngredient.unit,
          scaleFactor,
          recipe.title
        );
      }
    }

    // If excludePantry is set, subtract pantry quantities
    if (options?.excludePantry) {
      this.subtractPantryItems(aggregations);
    }

    // Build grouped grocery list
    const groups = this.buildGroups(aggregations);

    return {
      week: plan.week,
      groups,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Subtract pantry item quantities from aggregations.
   * Removes items completely if pantry has enough quantity.
   */
  private subtractPantryItems(aggregations: Map<string, IngredientAggregation>): void {
    const pantryQuantities = this.pantryRepo.getPantryQuantities();

    for (const [ingredientId, agg] of aggregations) {
      const pantryItem = pantryQuantities.get(ingredientId);
      if (!pantryItem) continue;

      // For each unit in the aggregation, try to subtract pantry quantity
      // This is simplified - assumes same units or no conversion
      for (const [unit, neededQty] of agg.quantitiesByUnit.entries()) {
        // Check if pantry has this ingredient
        const pantryQty = pantryItem.quantity;

        if (pantryQty >= neededQty) {
          // Pantry has enough - remove from grocery list
          agg.quantitiesByUnit.delete(unit);
        } else {
          // Pantry has some - reduce needed quantity
          agg.quantitiesByUnit.set(unit, neededQty - pantryQty);
        }
      }

      // If no quantities left, mark for removal
      if (agg.quantitiesByUnit.size === 0) {
        aggregations.delete(ingredientId);
      }
    }
  }

  /**
   * Aggregate an ingredient into the aggregations map.
   */
  private aggregateIngredient(
    aggregations: Map<string, IngredientAggregation>,
    ingredientId: string,
    quantity: number | null,
    unit: string | null,
    scaleFactor: number,
    recipeTitle: string
  ): void {
    // Look up ingredient details from database
    const ingredientRow = this.db
      .prepare('SELECT * FROM ingredients WHERE id = ?')
      .get(ingredientId) as IngredientRow | undefined;

    const ingredientName = ingredientRow?.name ?? ingredientId;
    const category = ingredientRow?.category ?? null;
    const storeSection = ingredientRow?.store_section ?? null;

    // Get or create aggregation
    let agg = aggregations.get(ingredientId);
    if (!agg) {
      agg = {
        ingredient: ingredientName,
        ingredientId,
        category,
        storeSection,
        quantitiesByUnit: new Map(),
        recipes: new Set(),
      };
      aggregations.set(ingredientId, agg);
    }

    // Add recipe to list
    agg.recipes.add(recipeTitle);

    // Handle quantity aggregation
    if (quantity !== null && quantity > 0) {
      const scaledQuantity = quantity * scaleFactor;
      const normalizedUnit = normalizeUnit(unit) || 'units';

      // Try to aggregate with existing quantities
      let aggregated = false;

      for (const [existingUnit, existingQty] of agg.quantitiesByUnit.entries()) {
        if (areUnitsConvertible(existingUnit, normalizedUnit)) {
          // Convert both to base unit and aggregate
          const baseExisting = toBaseUnit(existingQty, existingUnit);
          const baseNew = toBaseUnit(scaledQuantity, normalizedUnit);

          if (baseExisting && baseNew) {
            // Remove old entry and add combined in base unit
            agg.quantitiesByUnit.delete(existingUnit);
            agg.quantitiesByUnit.set(baseExisting.baseUnit, baseExisting.quantity + baseNew.quantity);
            aggregated = true;
            break;
          }
        }
      }

      if (!aggregated) {
        // Add or update quantity for this unit
        const current = agg.quantitiesByUnit.get(normalizedUnit) || 0;
        agg.quantitiesByUnit.set(normalizedUnit, current + scaledQuantity);
      }
    }
  }

  /**
   * Build grouped grocery list from aggregations.
   * Groups by store_section for organized shopping.
   */
  private buildGroups(aggregations: Map<string, IngredientAggregation>): GroceryGroup[] {
    // Group by store section (with capitalized display names)
    const sectionMap = new Map<string, GroceryItem[]>();

    for (const agg of aggregations.values()) {
      // Use store_section if available, fallback to 'Other'
      // Capitalize for display (e.g., 'produce' -> 'Produce')
      const sectionName = agg.storeSection
        ? agg.storeSection.charAt(0).toUpperCase() + agg.storeSection.slice(1)
        : 'Other';

      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, []);
      }

      // Convert each unit quantity to a grocery item
      for (const [unit, quantity] of agg.quantitiesByUnit.entries()) {
        // Try to convert to display unit if applicable
        const display = UNIT_CONVERSIONS[unit]
          ? toDisplayUnit(quantity, unit)
          : { quantity: Math.round(quantity * 100) / 100, unit };

        sectionMap.get(sectionName)!.push({
          ingredient: agg.ingredient,
          totalQuantity: display.quantity,
          unit: display.unit,
          recipes: Array.from(agg.recipes).sort(),
        });
      }

      // If no quantities were recorded, still add the ingredient with 0 quantity
      if (agg.quantitiesByUnit.size === 0) {
        sectionMap.get(sectionName)!.push({
          ingredient: agg.ingredient,
          totalQuantity: 0,
          unit: '',
          recipes: Array.from(agg.recipes).sort(),
        });
      }
    }

    // Sort sections and items
    const groups: GroceryGroup[] = [];

    // Get sorted section names (Other last)
    const sectionNames = Array.from(sectionMap.keys()).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });

    for (const name of sectionNames) {
      const items = sectionMap.get(name)!;
      // Sort items by ingredient name
      items.sort((a, b) => a.ingredient.localeCompare(b.ingredient));

      groups.push({
        name,
        items,
      });
    }

    return groups;
  }

  /**
   * Generate a grocery list for a specific week.
   *
   * @param week - ISO week string (e.g., "2025-W02")
   * @param options - Generation options
   * @returns Structured grocery list grouped by category
   */
  generateListForWeek(week: string, options?: GenerateListOptions): GroceryList | null {
    const plan = this.planRepo.getByWeek(week);
    if (!plan) {
      return null;
    }
    return this.generateList(plan.id, options);
  }

  /**
   * Generate a grocery list for a specific plan ID.
   *
   * @param planId - Plan ID
   * @param options - Generation options
   * @returns Structured grocery list grouped by category
   */
  generateListForPlan(planId: string, options?: GenerateListOptions): GroceryList | null {
    const plan = this.planRepo.getById(planId);
    if (!plan) {
      return null;
    }
    return this.generateList(plan.id, options);
  }

  // ============================================
  // Persistent Grocery List Methods
  // ============================================

  /**
   * Generate and persist a grocery list for a week.
   * This creates/updates the persistent list while preserving manual items.
   *
   * @param week - ISO week string (e.g., "2025-W02")
   * @param options - Generation options
   * @returns Persistent grocery list with items and status counts
   */
  generateAndPersist(week: string, options?: GenerateListOptions): PersistentGroceryList | null {
    // Generate the grocery list from the meal plan
    const generatedList = this.generateListForWeek(week, options);
    if (!generatedList) {
      return null;
    }

    // Get or create the persistent list for this week
    const persistentList = this.groceryListRepo.getOrCreateByWeek(week);

    // Clear non-manual items (preserves manually added items)
    this.groceryListRepo.clearNonManualItems(persistentList.id);

    // Convert generated items to persistent format
    const itemsToAdd: CreateGroceryItemInput[] = [];
    for (const group of generatedList.groups) {
      for (const item of group.items) {
        // Look up ingredient ID if we have the ingredient name
        const ingredientRow = this.db
          .prepare('SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?)')
          .get(item.ingredient) as { id: string } | undefined;

        itemsToAdd.push({
          ingredientId: ingredientRow?.id ?? null,
          name: item.ingredient,
          quantity: item.totalQuantity,
          unit: item.unit,
          status: 'need_to_buy',
          isManual: false,
          recipes: item.recipes,
        });
      }
    }

    // Bulk add the generated items
    if (itemsToAdd.length > 0) {
      this.groceryListRepo.bulkAddItems(persistentList.id, itemsToAdd);
    }

    // Set generated_at timestamp
    this.groceryListRepo.setGeneratedAt(persistentList.id);

    // Return the full persistent list
    return this.getPersistentList(week);
  }

  /**
   * Get a persistent grocery list for a week.
   *
   * @param week - ISO week string (e.g., "2025-W02")
   * @returns Persistent grocery list or null if not found
   */
  getPersistentList(week: string): PersistentGroceryList | null {
    const list = this.groceryListRepo.getByWeek(week);
    if (!list) {
      return null;
    }

    return this.convertToPublicFormat(list);
  }

  /**
   * Convert internal format to public format
   */
  private convertToPublicFormat(list: PersistedGroceryListWithItems): PersistentGroceryList {
    const counts = this.groceryListRepo.countByStatus(list.id);

    return {
      id: list.id,
      week: list.week,
      generatedAt: list.generatedAt,
      updatedAt: list.updatedAt,
      items: list.items.map((item) => {
        // Look up category and store_section from ingredients table if we have an ingredient ID
        let category: string | null = null;
        let storeSection: string | null = null;
        if (item.ingredientId) {
          const ingredientRow = this.db
            .prepare('SELECT category, store_section FROM ingredients WHERE id = ?')
            .get(item.ingredientId) as { category: string | null; store_section: string | null } | undefined;
          category = ingredientRow?.category ?? null;
          storeSection = ingredientRow?.store_section ?? null;
        }

        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          status: item.status,
          haveQuantity: item.haveQuantity,
          isManual: item.isManual,
          recipes: item.recipes,
          ingredientId: item.ingredientId,
          category,
          storeSection,
        };
      }),
      counts,
    };
  }

  /**
   * Add a manual item to a grocery list.
   *
   * @param week - ISO week string
   * @param name - Item name
   * @param quantity - Optional quantity
   * @param unit - Optional unit
   * @returns The added item
   */
  addManualItem(
    week: string,
    name: string,
    quantity?: number | null,
    unit?: string | null
  ): GroceryListItemWithStatus | null {
    const list = this.groceryListRepo.getOrCreateByWeek(week);

    // Check if item already exists
    const existing = this.groceryListRepo.findItemByName(list.id, name);
    if (existing) {
      // Update quantity if item exists
      if (quantity !== undefined) {
        const newQuantity = (existing.quantity ?? 0) + (quantity ?? 0);
        this.groceryListRepo.updateItem(existing.id, { quantity: newQuantity });
      }
      const updated = this.groceryListRepo.getItemById(existing.id);
      return updated ? this.convertItemToPublic(updated) : null;
    }

    // Add new manual item
    const item = this.groceryListRepo.addItem(list.id, {
      name,
      quantity: quantity ?? null,
      unit: unit ?? null,
      isManual: true,
      status: 'need_to_buy',
    });

    return this.convertItemToPublic(item);
  }

  /**
   * Convert internal item to public format
   */
  private convertItemToPublic(item: PersistedGroceryItem): GroceryListItemWithStatus {
    // Look up category and store_section from ingredients table if we have an ingredient ID
    let category: string | null = null;
    let storeSection: string | null = null;
    if (item.ingredientId) {
      const ingredientRow = this.db
        .prepare('SELECT category, store_section FROM ingredients WHERE id = ?')
        .get(item.ingredientId) as { category: string | null; store_section: string | null } | undefined;
      category = ingredientRow?.category ?? null;
      storeSection = ingredientRow?.store_section ?? null;
    }

    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status,
      haveQuantity: item.haveQuantity,
      isManual: item.isManual,
      recipes: item.recipes,
      ingredientId: item.ingredientId,
      category,
      storeSection,
    };
  }

  /**
   * Mark an item as "already have" (checked off).
   *
   * @param week - ISO week string
   * @param itemNameOrId - Item name or ID
   * @returns The updated item or null if not found
   */
  checkItem(week: string, itemNameOrId: string): GroceryListItemWithStatus | null {
    const list = this.groceryListRepo.getByWeek(week);
    if (!list) {
      return null;
    }

    // Try to find by ID first, then by name
    let item = this.groceryListRepo.getItemById(itemNameOrId);
    if (!item || item.groceryListId !== list.id) {
      item = this.groceryListRepo.findItemByName(list.id, itemNameOrId);
    }

    if (!item) {
      return null;
    }

    const updated = this.groceryListRepo.markAsHave(item.id);
    return updated ? this.convertItemToPublic(updated) : null;
  }

  /**
   * Mark an item as "partial" with a have_quantity.
   *
   * @param week - ISO week string
   * @param itemNameOrId - Item name or ID
   * @param haveQuantity - Quantity already on hand
   * @returns The updated item or null if not found
   */
  checkItemPartial(
    week: string,
    itemNameOrId: string,
    haveQuantity: number
  ): GroceryListItemWithStatus | null {
    const list = this.groceryListRepo.getByWeek(week);
    if (!list) {
      return null;
    }

    // Try to find by ID first, then by name
    let item = this.groceryListRepo.getItemById(itemNameOrId);
    if (!item || item.groceryListId !== list.id) {
      item = this.groceryListRepo.findItemByName(list.id, itemNameOrId);
    }

    if (!item) {
      return null;
    }

    const updated = this.groceryListRepo.markAsPartial(item.id, haveQuantity);
    return updated ? this.convertItemToPublic(updated) : null;
  }

  /**
   * Reset an item to "need to buy" status.
   *
   * @param week - ISO week string
   * @param itemNameOrId - Item name or ID
   * @returns The updated item or null if not found
   */
  uncheckItem(week: string, itemNameOrId: string): GroceryListItemWithStatus | null {
    const list = this.groceryListRepo.getByWeek(week);
    if (!list) {
      return null;
    }

    // Try to find by ID first, then by name
    let item = this.groceryListRepo.getItemById(itemNameOrId);
    if (!item || item.groceryListId !== list.id) {
      item = this.groceryListRepo.findItemByName(list.id, itemNameOrId);
    }

    if (!item) {
      return null;
    }

    const updated = this.groceryListRepo.markAsNeedToBuy(item.id);
    return updated ? this.convertItemToPublic(updated) : null;
  }

  /**
   * Get an item by ID.
   *
   * @param itemId - Item ID
   * @returns The item or null if not found
   */
  getItemById(itemId: string): GroceryListItemWithStatus | null {
    const item = this.groceryListRepo.getItemById(itemId);
    return item ? this.convertItemToPublic(item) : null;
  }

  /**
   * Update an item by ID.
   *
   * @param itemId - Item ID
   * @param updates - Fields to update
   * @returns The updated item or null if not found
   */
  updateItem(
    itemId: string,
    updates: {
      status?: GroceryItemStatus;
      haveQuantity?: number | null;
      quantity?: number | null;
      unit?: string | null;
    }
  ): GroceryListItemWithStatus | null {
    const item = this.groceryListRepo.updateItem(itemId, updates);
    return item ? this.convertItemToPublic(item) : null;
  }

  /**
   * Delete an item by ID.
   *
   * @param itemId - Item ID
   * @returns true if deleted, false if not found
   */
  deleteItem(itemId: string): boolean {
    return this.groceryListRepo.deleteItem(itemId);
  }

  /**
   * Bulk-mark items from pantry.
   * Checks grocery list items against pantry inventory and marks items
   * as "already_have" or "partial" based on pantry quantities.
   *
   * @param week - ISO week string
   * @returns Result with counts of checked and marked items
   */
  checkPantry(week: string): CheckPantryResult {
    const list = this.groceryListRepo.getByWeek(week);
    if (!list) {
      return {
        week,
        itemsChecked: 0,
        itemsMarked: 0,
        warning: 'No grocery list found for this week. Generate one first with "grocery generate".',
      };
    }

    // Get pantry quantities
    const pantryQuantities = this.pantryRepo.getPantryQuantities();

    let itemsMarked = 0;

    // Check each grocery item against pantry
    for (const item of list.items) {
      // Skip items that don't have an ingredient ID
      if (!item.ingredientId) continue;

      const pantryItem = pantryQuantities.get(item.ingredientId);
      if (!pantryItem) continue;

      const neededQty = item.quantity ?? 0;
      const pantryQty = pantryItem.quantity;

      if (pantryQty >= neededQty) {
        // Have enough - mark as already_have
        this.groceryListRepo.markAsHave(item.id);
        itemsMarked++;
      } else if (pantryQty > 0) {
        // Have some - mark as partial
        this.groceryListRepo.markAsPartial(item.id, pantryQty);
        itemsMarked++;
      }
    }

    return {
      week,
      itemsChecked: list.items.length,
      itemsMarked,
    };
  }

  /**
   * Get items by status for a week.
   *
   * @param week - ISO week string
   * @param status - Item status filter
   * @returns Items matching the status
   */
  getItemsByStatus(week: string, status: GroceryItemStatus): GroceryListItemWithStatus[] {
    const list = this.groceryListRepo.getByWeek(week);
    if (!list) {
      return [];
    }

    const items = this.groceryListRepo.getItemsByStatus(list.id, status);
    return items.map((item) => this.convertItemToPublic(item));
  }
}
