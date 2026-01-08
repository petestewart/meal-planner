/**
 * Ingredient repository - CRUD operations for ingredients
 *
 * Handles the ingredients table with operations to create, lookup, and manage ingredients.
 * Ingredients have unique names, allowing lookup by name for user-friendly CLI usage.
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Ingredient, CreateIngredient, StoreSection } from '../models/ingredient.js';
import { isValidStoreSection, STORE_SECTIONS } from '../models/ingredient.js';

/**
 * Valid ingredient categories for grouping in grocery lists
 */
export const INGREDIENT_CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat',
  'Seafood',
  'Bakery',
  'Frozen',
  'Pantry',
  'Beverages',
  'Condiments',
  'Spices',
  'Other',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

/**
 * Common ingredient to category mapping for auto-categorization.
 * Keys are lowercase ingredient names or patterns.
 */
const COMMON_INGREDIENT_CATEGORIES: Record<string, IngredientCategory> = {
  // Produce
  'apple': 'Produce',
  'apples': 'Produce',
  'avocado': 'Produce',
  'banana': 'Produce',
  'bananas': 'Produce',
  'basil': 'Produce',
  'bell pepper': 'Produce',
  'bell peppers': 'Produce',
  'broccoli': 'Produce',
  'cabbage': 'Produce',
  'carrot': 'Produce',
  'carrots': 'Produce',
  'celery': 'Produce',
  'cilantro': 'Produce',
  'corn': 'Produce',
  'cucumber': 'Produce',
  'cucumbers': 'Produce',
  'garlic': 'Produce',
  'ginger': 'Produce',
  'green beans': 'Produce',
  'green onion': 'Produce',
  'green onions': 'Produce',
  'kale': 'Produce',
  'lemon': 'Produce',
  'lemons': 'Produce',
  'lettuce': 'Produce',
  'lime': 'Produce',
  'limes': 'Produce',
  'mushroom': 'Produce',
  'mushrooms': 'Produce',
  'onion': 'Produce',
  'onions': 'Produce',
  'orange': 'Produce',
  'oranges': 'Produce',
  'parsley': 'Produce',
  'peas': 'Produce',
  'peppers': 'Produce',
  'potato': 'Produce',
  'potatoes': 'Produce',
  'scallion': 'Produce',
  'scallions': 'Produce',
  'shallot': 'Produce',
  'shallots': 'Produce',
  'spinach': 'Produce',
  'strawberries': 'Produce',
  'tomato': 'Produce',
  'tomatoes': 'Produce',
  'zucchini': 'Produce',

  // Dairy
  'butter': 'Dairy',
  'cheese': 'Dairy',
  'cheddar': 'Dairy',
  'cheddar cheese': 'Dairy',
  'cottage cheese': 'Dairy',
  'cream': 'Dairy',
  'cream cheese': 'Dairy',
  'egg': 'Dairy',
  'eggs': 'Dairy',
  'feta': 'Dairy',
  'feta cheese': 'Dairy',
  'greek yogurt': 'Dairy',
  'half and half': 'Dairy',
  'heavy cream': 'Dairy',
  'milk': 'Dairy',
  'mozzarella': 'Dairy',
  'mozzarella cheese': 'Dairy',
  'parmesan': 'Dairy',
  'parmesan cheese': 'Dairy',
  'sour cream': 'Dairy',
  'whipping cream': 'Dairy',
  'yogurt': 'Dairy',

  // Meat
  'bacon': 'Meat',
  'beef': 'Meat',
  'chicken': 'Meat',
  'chicken breast': 'Meat',
  'chicken breasts': 'Meat',
  'chicken thigh': 'Meat',
  'chicken thighs': 'Meat',
  'ground beef': 'Meat',
  'ground pork': 'Meat',
  'ground turkey': 'Meat',
  'ham': 'Meat',
  'lamb': 'Meat',
  'pork': 'Meat',
  'pork chop': 'Meat',
  'pork chops': 'Meat',
  'sausage': 'Meat',
  'sausages': 'Meat',
  'steak': 'Meat',
  'turkey': 'Meat',

  // Seafood
  'cod': 'Seafood',
  'crab': 'Seafood',
  'fish': 'Seafood',
  'halibut': 'Seafood',
  'lobster': 'Seafood',
  'salmon': 'Seafood',
  'scallops': 'Seafood',
  'shrimp': 'Seafood',
  'tilapia': 'Seafood',
  'tuna': 'Seafood',

  // Bakery
  'bagel': 'Bakery',
  'bagels': 'Bakery',
  'baguette': 'Bakery',
  'bread': 'Bakery',
  'breadcrumbs': 'Bakery',
  'brioche': 'Bakery',
  'croissant': 'Bakery',
  'croissants': 'Bakery',
  'english muffin': 'Bakery',
  'english muffins': 'Bakery',
  'hamburger bun': 'Bakery',
  'hamburger buns': 'Bakery',
  'hot dog bun': 'Bakery',
  'hot dog buns': 'Bakery',
  'pita': 'Bakery',
  'pita bread': 'Bakery',
  'roll': 'Bakery',
  'rolls': 'Bakery',
  'sourdough': 'Bakery',
  'tortilla': 'Bakery',
  'tortillas': 'Bakery',

  // Frozen
  'frozen berries': 'Frozen',
  'frozen corn': 'Frozen',
  'frozen peas': 'Frozen',
  'frozen spinach': 'Frozen',
  'frozen vegetables': 'Frozen',
  'ice cream': 'Frozen',

  // Pantry
  'all-purpose flour': 'Pantry',
  'baking powder': 'Pantry',
  'baking soda': 'Pantry',
  'black beans': 'Pantry',
  'brown rice': 'Pantry',
  'brown sugar': 'Pantry',
  'canned tomatoes': 'Pantry',
  'chickpeas': 'Pantry',
  'coconut milk': 'Pantry',
  'cornstarch': 'Pantry',
  'crushed tomatoes': 'Pantry',
  'diced tomatoes': 'Pantry',
  'flour': 'Pantry',
  'honey': 'Pantry',
  'kidney beans': 'Pantry',
  'lentils': 'Pantry',
  'maple syrup': 'Pantry',
  'oats': 'Pantry',
  'olive oil': 'Pantry',
  'pasta': 'Pantry',
  'peanut butter': 'Pantry',
  'quinoa': 'Pantry',
  'rice': 'Pantry',
  'spaghetti': 'Pantry',
  'sugar': 'Pantry',
  'tomato paste': 'Pantry',
  'tomato sauce': 'Pantry',
  'vanilla': 'Pantry',
  'vanilla extract': 'Pantry',
  'vegetable oil': 'Pantry',
  'vinegar': 'Pantry',
  'white rice': 'Pantry',

  // Beverages
  'beer': 'Beverages',
  'coffee': 'Beverages',
  'juice': 'Beverages',
  'orange juice': 'Beverages',
  'tea': 'Beverages',
  'wine': 'Beverages',
  'red wine': 'Beverages',
  'white wine': 'Beverages',

  // Condiments
  'bbq sauce': 'Condiments',
  'dijon mustard': 'Condiments',
  'fish sauce': 'Condiments',
  'hot sauce': 'Condiments',
  'ketchup': 'Condiments',
  'mayonnaise': 'Condiments',
  'mayo': 'Condiments',
  'mustard': 'Condiments',
  'salsa': 'Condiments',
  'soy sauce': 'Condiments',
  'sriracha': 'Condiments',
  'teriyaki sauce': 'Condiments',
  'worcestershire sauce': 'Condiments',

  // Spices
  'allspice': 'Spices',
  'bay leaf': 'Spices',
  'bay leaves': 'Spices',
  'black pepper': 'Spices',
  'cayenne': 'Spices',
  'cayenne pepper': 'Spices',
  'chili flakes': 'Spices',
  'chili powder': 'Spices',
  'cinnamon': 'Spices',
  'coriander': 'Spices',
  'cumin': 'Spices',
  'curry powder': 'Spices',
  'dried oregano': 'Spices',
  'dried thyme': 'Spices',
  'garlic powder': 'Spices',
  'ginger powder': 'Spices',
  'italian seasoning': 'Spices',
  'nutmeg': 'Spices',
  'onion powder': 'Spices',
  'oregano': 'Spices',
  'paprika': 'Spices',
  'pepper': 'Spices',
  'red pepper flakes': 'Spices',
  'rosemary': 'Spices',
  'sage': 'Spices',
  'salt': 'Spices',
  'smoked paprika': 'Spices',
  'thyme': 'Spices',
  'turmeric': 'Spices',
};

/**
 * Get the auto-category for a common ingredient name.
 * Returns null if the ingredient is not in the common list.
 */
export function getAutoCategory(name: string): IngredientCategory | null {
  const lowerName = name.toLowerCase().trim();
  return COMMON_INGREDIENT_CATEGORIES[lowerName] ?? null;
}

/**
 * Check if a category is a valid ingredient category.
 */
export function isValidCategory(category: string): category is IngredientCategory {
  return INGREDIENT_CATEGORIES.includes(category as IngredientCategory);
}

/**
 * Store section keyword patterns for auto-assignment.
 * Maps keywords to store sections for matching ingredient names.
 */
const STORE_SECTION_KEYWORDS: Record<StoreSection, string[]> = {
  produce: [
    'lettuce', 'tomato', 'onion', 'garlic', 'carrot', 'celery', 'pepper', 'spinach',
    'kale', 'broccoli', 'potato', 'fruit', 'apple', 'banana', 'lemon', 'lime',
    'avocado', 'cucumber', 'mushroom', 'zucchini', 'cabbage', 'corn', 'peas',
    'green bean', 'asparagus', 'cauliflower', 'eggplant', 'squash', 'cilantro',
    'parsley', 'basil', 'mint', 'ginger', 'shallot', 'scallion', 'leek',
    'orange', 'grape', 'strawberr', 'blueberr', 'raspberr', 'melon', 'mango',
    'pineapple', 'peach', 'pear', 'plum', 'cherry', 'radish', 'beet', 'turnip',
  ],
  meat: [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham',
    'ground', 'steak', 'chop', 'roast', 'rib', 'wing', 'thigh', 'breast',
    'drumstick', 'tenderloin', 'brisket', 'meatball', 'veal', 'duck',
  ],
  seafood: [
    'salmon', 'tuna', 'shrimp', 'fish', 'cod', 'tilapia', 'crab', 'lobster',
    'scallop', 'halibut', 'trout', 'bass', 'mahi', 'swordfish', 'anchov',
    'sardine', 'clam', 'mussel', 'oyster', 'calamari', 'squid', 'octopus',
  ],
  dairy: [
    'milk', 'cheese', 'butter', 'cream', 'yogurt', 'egg', 'sour cream',
    'cottage', 'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'feta',
    'gouda', 'brie', 'swiss', 'provolone', 'half and half', 'whipping',
    'greek yogurt', 'kefir', 'buttermilk',
  ],
  bakery: [
    'bread', 'roll', 'tortilla', 'baguette', 'croissant', 'bagel', 'muffin',
    'pita', 'naan', 'focaccia', 'ciabatta', 'sourdough', 'brioche', 'bun',
  ],
  frozen: [
    'frozen', 'ice cream', 'sorbet', 'gelato', 'popsicle', 'pizza frozen',
  ],
  pantry: [
    'rice', 'pasta', 'flour', 'sugar', 'oil', 'bean', 'canned', 'broth',
    'stock', 'lentil', 'quinoa', 'oat', 'cereal', 'nut', 'seed', 'honey',
    'maple syrup', 'peanut butter', 'almond butter', 'jam', 'jelly',
    'chocolate', 'cocoa', 'baking powder', 'baking soda', 'cornstarch',
    'yeast', 'vanilla', 'extract', 'chickpea', 'couscous', 'barley',
    'breadcrumb', 'panko', 'cracker', 'chip', 'tortilla chip', 'popcorn',
    'noodle', 'spaghetti', 'penne', 'macaroni', 'lasagna', 'ravioli',
    'tomato paste', 'tomato sauce', 'crushed tomato', 'diced tomato',
  ],
  beverages: [
    'juice', 'soda', 'water', 'wine', 'beer', 'coffee', 'tea',
    'lemonade', 'sparkling', 'tonic', 'cola', 'ginger ale', 'energy drink',
  ],
  condiments: [
    'ketchup', 'mustard', 'mayonnaise', 'mayo', 'sauce', 'dressing', 'vinegar',
    'salsa', 'hot sauce', 'bbq', 'teriyaki', 'soy sauce', 'fish sauce',
    'hoisin', 'worcestershire', 'sriracha', 'relish', 'pickle',
  ],
  spices: [
    'salt', 'pepper', 'cumin', 'paprika', 'oregano', 'basil', 'thyme',
    'cinnamon', 'spice', 'seasoning', 'curry', 'chili powder', 'cayenne',
    'turmeric', 'nutmeg', 'clove', 'allspice', 'cardamom', 'coriander',
    'rosemary', 'sage', 'dill', 'bay leaf', 'garlic powder', 'onion powder',
    'ginger powder', 'italian seasoning', 'cajun', 'taco seasoning',
  ],
  other: [],
};

/**
 * Get the auto-store-section for an ingredient name.
 * Uses keyword matching to determine the appropriate store section.
 * Returns null if no match is found.
 */
export function getAutoStoreSection(name: string): StoreSection | null {
  const lowerName = name.toLowerCase().trim();

  // Check each section's keywords
  for (const section of STORE_SECTIONS) {
    if (section === 'other') continue; // Skip 'other' as it's the default

    const keywords = STORE_SECTION_KEYWORDS[section];
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return section;
      }
    }
  }

  return null;
}

/** Raw ingredient row from database */
interface IngredientRow {
  id: string;
  name: string;
  category: string | null;
  default_unit: string | null;
  store_section: string | null;
}

/**
 * Convert database row to Ingredient model
 */
function rowToIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    defaultUnit: row.default_unit,
    storeSection: row.store_section as StoreSection | null,
  };
}

export class IngredientRepository {
  constructor(private db: Database) {}

  /**
   * Create a new ingredient
   */
  create(data: CreateIngredient): Ingredient {
    const id = uuid();

    this.db
      .prepare(
        `INSERT INTO ingredients (id, name, category, default_unit, store_section) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, data.name, data.category ?? null, data.defaultUnit ?? null, data.storeSection ?? null);

    return this.getById(id)!;
  }

  /**
   * Get an ingredient by ID
   */
  getById(id: string): Ingredient | null {
    const row = this.db
      .prepare('SELECT * FROM ingredients WHERE id = ?')
      .get(id) as IngredientRow | undefined;

    return row ? rowToIngredient(row) : null;
  }

  /**
   * Get an ingredient by name (case-insensitive)
   */
  getByName(name: string): Ingredient | null {
    const row = this.db
      .prepare('SELECT * FROM ingredients WHERE LOWER(name) = LOWER(?)')
      .get(name) as IngredientRow | undefined;

    return row ? rowToIngredient(row) : null;
  }

  /**
   * Get or create an ingredient by name.
   * If an ingredient with the given name exists, returns it.
   * Otherwise, creates a new ingredient with the given name.
   * Auto-categorizes common ingredients if no category is provided.
   * Auto-assigns store section based on ingredient name keywords.
   */
  getOrCreate(name: string, category?: string | null, defaultUnit?: string | null, storeSection?: StoreSection | null): Ingredient {
    const existing = this.getByName(name);
    if (existing) {
      return existing;
    }

    // Auto-categorize common ingredients if no category specified
    const resolvedCategory = category ?? getAutoCategory(name) ?? null;

    // Auto-assign store section based on ingredient name keywords
    const resolvedStoreSection = storeSection ?? getAutoStoreSection(name) ?? 'other';

    return this.create({
      name,
      category: resolvedCategory,
      defaultUnit: defaultUnit ?? null,
      storeSection: resolvedStoreSection,
    });
  }

  /**
   * Resolve multiple ingredient names to ingredient IDs.
   * Creates ingredients that don't exist.
   * Returns an array of ingredient IDs.
   */
  resolveIngredientNames(names: string[]): string[] {
    return names.map((name) => {
      const ingredient = this.getOrCreate(name);
      return ingredient.id;
    });
  }

  /**
   * List all ingredients, optionally filtered by category
   */
  list(category?: string): Ingredient[] {
    let sql = 'SELECT * FROM ingredients';
    const params: string[] = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name';

    const rows = this.db.prepare(sql).all(...params) as IngredientRow[];
    return rows.map(rowToIngredient);
  }

  /**
   * Delete an ingredient by ID
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Check if an ingredient exists by ID
   */
  exists(id: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM ingredients WHERE id = ?').get(id);
    return row !== undefined;
  }

  /**
   * Update an ingredient's category
   */
  updateCategory(id: string, category: string | null): Ingredient | null {
    const result = this.db
      .prepare('UPDATE ingredients SET category = ? WHERE id = ?')
      .run(category, id);

    if (result.changes === 0) {
      return null;
    }

    return this.getById(id);
  }

  /**
   * Update an ingredient's category by name (case-insensitive)
   */
  updateCategoryByName(name: string, category: string | null): Ingredient | null {
    const existing = this.getByName(name);
    if (!existing) {
      return null;
    }

    return this.updateCategory(existing.id, category);
  }

  /**
   * Update an ingredient's store section
   */
  updateStoreSection(id: string, storeSection: StoreSection | null): Ingredient | null {
    const result = this.db
      .prepare('UPDATE ingredients SET store_section = ? WHERE id = ?')
      .run(storeSection, id);

    if (result.changes === 0) {
      return null;
    }

    return this.getById(id);
  }

  /**
   * Update an ingredient's store section by name (case-insensitive)
   */
  updateStoreSectionByName(name: string, storeSection: StoreSection | null): Ingredient | null {
    const existing = this.getByName(name);
    if (!existing) {
      return null;
    }

    return this.updateStoreSection(existing.id, storeSection);
  }

  /**
   * Update an ingredient with arbitrary fields.
   * Used by PATCH endpoint.
   */
  update(id: string, data: { category?: string | null; storeSection?: StoreSection | null }): Ingredient | null {
    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category);
    }

    if (data.storeSection !== undefined) {
      updates.push('store_section = ?');
      params.push(data.storeSection);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    params.push(id);
    const result = this.db
      .prepare(`UPDATE ingredients SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    if (result.changes === 0) {
      return null;
    }

    return this.getById(id);
  }
}
