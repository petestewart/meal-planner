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

export class GroceryService {
  private planRepo: PlanRepository;
  private recipeRepo: RecipeRepository;
  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.planRepo = new PlanRepository(db);
    this.recipeRepo = new RecipeRepository(db);
  }

  /**
   * Generate a grocery list for a week or plan ID.
   *
   * @param weekOrPlanId - ISO week string (e.g., "2025-W02") or plan ID
   * @returns Structured grocery list grouped by category
   */
  generateList(weekOrPlanId: string): GroceryList | null {
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
    const aggregations = new Map<string, IngredientAggregation>();

    for (const item of plan.items || []) {
      if (!item.recipeId) continue;

      const recipe = this.recipeRepo.getById(item.recipeId);
      if (!recipe || !recipe.ingredients) continue;

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

    // Build grouped grocery list
    const groups = this.buildGroups(aggregations);

    return {
      week: plan.week,
      groups,
      generatedAt: new Date().toISOString(),
    };
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

    // Get or create aggregation
    let agg = aggregations.get(ingredientId);
    if (!agg) {
      agg = {
        ingredient: ingredientName,
        ingredientId,
        category,
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
   */
  private buildGroups(aggregations: Map<string, IngredientAggregation>): GroceryGroup[] {
    // Group by category
    const categoryMap = new Map<string, GroceryItem[]>();

    for (const agg of aggregations.values()) {
      const categoryName = agg.category || 'Uncategorized';

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, []);
      }

      // Convert each unit quantity to a grocery item
      for (const [unit, quantity] of agg.quantitiesByUnit.entries()) {
        // Try to convert to display unit if applicable
        const display = UNIT_CONVERSIONS[unit]
          ? toDisplayUnit(quantity, unit)
          : { quantity: Math.round(quantity * 100) / 100, unit };

        categoryMap.get(categoryName)!.push({
          ingredient: agg.ingredient,
          totalQuantity: display.quantity,
          unit: display.unit,
          recipes: Array.from(agg.recipes).sort(),
        });
      }

      // If no quantities were recorded, still add the ingredient with 0 quantity
      if (agg.quantitiesByUnit.size === 0) {
        categoryMap.get(categoryName)!.push({
          ingredient: agg.ingredient,
          totalQuantity: 0,
          unit: '',
          recipes: Array.from(agg.recipes).sort(),
        });
      }
    }

    // Sort categories and items
    const groups: GroceryGroup[] = [];

    // Get sorted category names (Uncategorized last)
    const categoryNames = Array.from(categoryMap.keys()).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });

    for (const name of categoryNames) {
      const items = categoryMap.get(name)!;
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
   * @returns Structured grocery list grouped by category
   */
  generateListForWeek(week: string): GroceryList | null {
    const plan = this.planRepo.getByWeek(week);
    if (!plan) {
      return null;
    }
    return this.generateList(plan.id);
  }

  /**
   * Generate a grocery list for a specific plan ID.
   *
   * @param planId - Plan ID
   * @returns Structured grocery list grouped by category
   */
  generateListForPlan(planId: string): GroceryList | null {
    const plan = this.planRepo.getById(planId);
    if (!plan) {
      return null;
    }
    return this.generateList(plan.id);
  }
}
