/**
 * PrepDay service - Aggregates and organizes prep tasks for a designated prep day
 *
 * Extracts prep tasks from recipe instructions (dice, chop, marinate, etc.),
 * groups by task type, aggregates quantities, calculates total time,
 * and identifies common equipment needed.
 */

import type { Database } from 'better-sqlite3';
import { PlanRepository } from '../repos/plan.repo.js';
import { PrepBatchRepository } from '../repos/prep-batch.repo.js';
import { RecipeRepository } from '../repos/recipe.repo.js';
import { IngredientRepository } from '../repos/ingredient.repo.js';
import type {
  WeeklyPlanWithItems,
  PlanItem,
  RecipeWithRelations,
  RecipeIngredient,
  PrepBatchWithRecipe,
} from '../models/index.js';

/**
 * Represents an item within a prep task (e.g., "3 onions" for a "Dice" task)
 */
export interface PrepTaskItem {
  ingredient: string;
  quantity: string;
  recipes: string[];
}

/**
 * Represents a prep task category (e.g., all dicing tasks)
 */
export interface PrepTask {
  taskType: string;
  items: PrepTaskItem[];
  estimatedTime?: number;
}

/**
 * Represents a batch that's part of the prep day
 */
export interface PrepDayBatch {
  id: string;
  recipeId: string;
  recipeTitle: string;
  prepDate: string;
  totalServings: number;
  notes: string | null;
}

/**
 * Represents a recipe summary for the prep day
 */
export interface RecipeSummary {
  id: string;
  title: string;
  prepTimeMinutes: number | null;
  servings: number;
  mealCount: number; // How many times it appears in the week
  needsFullPrep: boolean; // true if not from a batch
}

/**
 * The complete prep day summary
 */
export interface PrepDaySummary {
  week: string;
  totalPrepTime: number; // minutes
  batches: PrepDayBatch[];
  tasks: PrepTask[];
  equipment: string[];
  recipes: RecipeSummary[];
}

/**
 * Task types and their associated action verbs
 */
const TASK_TYPES: Record<string, string[]> = {
  'Marinate': ['marinate', 'brine', 'season'],
  'Chop': ['chop', 'dice', 'mince', 'slice', 'julienne', 'cube', 'cut'],
  'Wash': ['wash', 'rinse', 'clean'],
  'Measure': ['measure', 'portion', 'weigh'],
  'Mix': ['mix', 'combine', 'whisk', 'blend', 'stir together'],
  'Peel': ['peel', 'skin'],
  'Grate': ['grate', 'shred', 'zest'],
};

/**
 * Equipment patterns to detect in recipe instructions
 */
const EQUIPMENT_PATTERNS: string[] = [
  'knife',
  'cutting board',
  'mixing bowl',
  'bowl',
  'food processor',
  'blender',
  'grill',
  'oven',
  'pot',
  'pan',
  'sheet pan',
  'baking sheet',
  'skillet',
  'wok',
  'dutch oven',
  'slow cooker',
  'instant pot',
  'pressure cooker',
  'whisk',
  'tongs',
  'spatula',
  'measuring cups',
  'measuring spoons',
  'colander',
  'strainer',
  'peeler',
  'grater',
  'mandoline',
  'mortar and pestle',
  'rolling pin',
];

/**
 * Task type priority for ordering (lower = do first)
 */
const TASK_PRIORITY: Record<string, number> = {
  'Marinate': 1, // Time-sensitive, do first
  'Measure': 2,
  'Wash': 3,
  'Peel': 4,
  'Chop': 5,
  'Grate': 6,
  'Mix': 7, // Do last after components ready
};

export class PrepDayService {
  private planRepo: PlanRepository;
  private prepBatchRepo: PrepBatchRepository;
  private recipeRepo: RecipeRepository;
  private ingredientRepo: IngredientRepository;

  constructor(db: Database) {
    this.planRepo = new PlanRepository(db);
    this.prepBatchRepo = new PrepBatchRepository(db);
    this.recipeRepo = new RecipeRepository(db);
    this.ingredientRepo = new IngredientRepository(db);
  }

  /**
   * Generate a prep day summary for a given week.
   *
   * @param week - ISO week string (e.g., "2025-W02")
   * @returns PrepDaySummary or null if plan not found
   */
  generatePrepDay(week: string): PrepDaySummary | null {
    // Get the plan for this week
    const plan = this.planRepo.getByWeek(week);
    if (!plan) {
      return null;
    }

    // Get all batches for recipes in this plan
    const batches = this.getBatchesForPlan(plan);

    // Get all unique recipes from the plan
    const recipeMap = this.getRecipesForPlan(plan);

    // Build recipe summaries
    const recipeSummaries = this.buildRecipeSummaries(plan, recipeMap, batches);

    // Extract prep tasks from all recipes
    const tasks = this.extractPrepTasks(recipeMap, plan);

    // Extract equipment from all recipes
    const equipment = this.extractEquipment(recipeMap);

    // Calculate total prep time
    const totalPrepTime = this.calculateTotalPrepTime(recipeSummaries);

    // Convert batches to PrepBatch format
    const prepBatches = batches.map((batch) => ({
      id: batch.id,
      recipeId: batch.recipeId,
      recipeTitle: batch.recipeTitle ?? 'Unknown Recipe',
      prepDate: batch.prepDate,
      totalServings: batch.totalServings,
      notes: batch.notes,
    }));

    return {
      week,
      totalPrepTime,
      batches: prepBatches,
      tasks: this.sortTasksByPriority(tasks),
      equipment: [...equipment].sort(),
      recipes: recipeSummaries,
    };
  }

  /**
   * Get batches that are linked to plan items in this week's plan.
   */
  private getBatchesForPlan(plan: WeeklyPlanWithItems): PrepBatchWithRecipe[] {
    const batchIds = new Set<string>();

    for (const item of plan.items ?? []) {
      if (item.batchId) {
        batchIds.add(item.batchId);
      }
    }

    const batches: PrepBatchWithRecipe[] = [];
    for (const batchId of batchIds) {
      const batch = this.prepBatchRepo.getByIdWithRecipe(batchId);
      if (batch) {
        batches.push(batch);
      }
    }

    return batches;
  }

  /**
   * Get all unique recipes from the plan with their full data.
   */
  private getRecipesForPlan(
    plan: WeeklyPlanWithItems
  ): Map<string, RecipeWithRelations> {
    const recipeMap = new Map<string, RecipeWithRelations>();

    for (const item of plan.items ?? []) {
      if (item.recipeId && !recipeMap.has(item.recipeId)) {
        const recipe = this.recipeRepo.getById(item.recipeId);
        if (recipe) {
          recipeMap.set(item.recipeId, recipe);
        }
      }
    }

    return recipeMap;
  }

  /**
   * Build recipe summaries with meal counts and batch info.
   */
  private buildRecipeSummaries(
    plan: WeeklyPlanWithItems,
    recipeMap: Map<string, RecipeWithRelations>,
    batches: PrepBatchWithRecipe[]
  ): RecipeSummary[] {
    const batchRecipeIds = new Set(batches.map((b) => b.recipeId));
    const mealCounts = new Map<string, number>();
    const batchLinked = new Map<string, boolean>();

    // Count meals and track batch linkage per recipe
    for (const item of plan.items ?? []) {
      if (item.recipeId) {
        mealCounts.set(item.recipeId, (mealCounts.get(item.recipeId) ?? 0) + 1);
        if (item.batchId) {
          batchLinked.set(item.recipeId, true);
        }
      }
    }

    const summaries: RecipeSummary[] = [];

    for (const [recipeId, recipe] of recipeMap) {
      const isFromBatch = batchRecipeIds.has(recipeId) || batchLinked.get(recipeId);

      summaries.push({
        id: recipeId,
        title: recipe.title,
        prepTimeMinutes: recipe.prepTimeMinutes,
        servings: recipe.servings,
        mealCount: mealCounts.get(recipeId) ?? 1,
        needsFullPrep: !isFromBatch,
      });
    }

    return summaries;
  }

  /**
   * Extract prep tasks from recipe ingredients and instructions.
   * Groups similar tasks and aggregates quantities.
   */
  private extractPrepTasks(
    recipeMap: Map<string, RecipeWithRelations>,
    plan: WeeklyPlanWithItems
  ): PrepTask[] {
    // Map: taskType -> ingredientName -> { quantity: string, recipes: Set<string> }
    const taskAggregation = new Map<
      string,
      Map<string, { quantities: string[]; recipes: Set<string> }>
    >();

    for (const [recipeId, recipe] of recipeMap) {
      // Get the number of servings needed for this recipe in the plan
      let totalServingsNeeded = 0;
      for (const item of plan.items ?? []) {
        if (item.recipeId === recipeId) {
          totalServingsNeeded += item.servings;
        }
      }
      const servingMultiplier = totalServingsNeeded / recipe.servings;

      // Extract tasks from ingredients
      for (const ing of recipe.ingredients ?? []) {
        const ingredient = this.ingredientRepo.getById(ing.ingredientId);
        if (!ingredient) continue;

        const ingredientName = ingredient.name;
        const notes = ing.notes?.toLowerCase() ?? '';

        // Determine which task type applies based on notes
        for (const [taskType, verbs] of Object.entries(TASK_TYPES)) {
          if (verbs.some((verb) => notes.includes(verb))) {
            this.addToTaskAggregation(
              taskAggregation,
              taskType,
              ingredientName,
              this.formatQuantity(ing, servingMultiplier),
              recipe.title
            );
            break; // Only assign to one task type
          }
        }

        // Also check if ingredient is produce (likely needs washing/chopping)
        const isProduceKeyword = ['lettuce', 'tomato', 'onion', 'pepper', 'carrot',
          'celery', 'broccoli', 'spinach', 'kale', 'cucumber', 'mushroom',
          'garlic', 'zucchini', 'potato', 'corn', 'peas', 'cabbage'].some(
            k => ingredientName.toLowerCase().includes(k)
          );

        if (isProduceKeyword && !notes) {
          // Default to chop for produce without specific notes
          this.addToTaskAggregation(
            taskAggregation,
            'Chop',
            ingredientName,
            this.formatQuantity(ing, servingMultiplier),
            recipe.title
          );
        }
      }

      // Extract tasks from instructions
      const instructions = recipe.instructions.toLowerCase();
      for (const [taskType, verbs] of Object.entries(TASK_TYPES)) {
        for (const verb of verbs) {
          // Simple pattern: "verb the ingredient"
          const pattern = new RegExp(`${verb}\\s+(?:the\\s+)?([\\w\\s]+?)(?:\\.|,|;|and|then|$)`, 'gi');
          let match;
          while ((match = pattern.exec(instructions)) !== null) {
            const extractedItem = match[1].trim();
            // Only add if it looks like an ingredient (not too long)
            if (extractedItem.length < 30 && extractedItem.split(' ').length <= 4) {
              this.addToTaskAggregation(
                taskAggregation,
                taskType,
                extractedItem,
                '',
                recipe.title
              );
            }
          }
        }
      }
    }

    // Convert aggregation to PrepTask array
    const tasks: PrepTask[] = [];

    for (const [taskType, ingredients] of taskAggregation) {
      const items: PrepTaskItem[] = [];

      for (const [ingredientName, data] of ingredients) {
        // Combine quantities, removing duplicates and empties
        const uniqueQuantities = [...new Set(data.quantities.filter((q) => q))];
        const combinedQuantity = uniqueQuantities.join(' + ') || 'as needed';

        items.push({
          ingredient: ingredientName,
          quantity: combinedQuantity,
          recipes: [...data.recipes],
        });
      }

      if (items.length > 0) {
        tasks.push({
          taskType,
          items: items.sort((a, b) => a.ingredient.localeCompare(b.ingredient)),
          estimatedTime: this.estimateTaskTime(taskType, items.length),
        });
      }
    }

    return tasks;
  }

  /**
   * Add an item to the task aggregation structure.
   */
  private addToTaskAggregation(
    aggregation: Map<string, Map<string, { quantities: string[]; recipes: Set<string> }>>,
    taskType: string,
    ingredient: string,
    quantity: string,
    recipeTitle: string
  ): void {
    if (!aggregation.has(taskType)) {
      aggregation.set(taskType, new Map());
    }

    const ingredients = aggregation.get(taskType)!;
    const normalizedIngredient = ingredient.toLowerCase().trim();

    if (!ingredients.has(normalizedIngredient)) {
      ingredients.set(normalizedIngredient, { quantities: [], recipes: new Set() });
    }

    const data = ingredients.get(normalizedIngredient)!;
    if (quantity) {
      data.quantities.push(quantity);
    }
    data.recipes.add(recipeTitle);
  }

  /**
   * Format ingredient quantity with unit, scaled by multiplier.
   */
  private formatQuantity(ing: RecipeIngredient, multiplier: number): string {
    if (!ing.quantity) return '';

    const scaledQty = ing.quantity * multiplier;
    const unit = ing.unit ?? '';

    // Round to reasonable precision
    const roundedQty = Math.round(scaledQty * 4) / 4; // Round to nearest quarter

    return unit ? `${roundedQty} ${unit}` : `${roundedQty}`;
  }

  /**
   * Estimate time for a task type based on number of items.
   */
  private estimateTaskTime(taskType: string, itemCount: number): number {
    const baseTime: Record<string, number> = {
      'Marinate': 5, // Setup time, actual marinating is passive
      'Chop': 5,
      'Wash': 2,
      'Measure': 2,
      'Mix': 3,
      'Peel': 3,
      'Grate': 3,
    };

    const perItemTime: Record<string, number> = {
      'Marinate': 2,
      'Chop': 3,
      'Wash': 1,
      'Measure': 1,
      'Mix': 2,
      'Peel': 2,
      'Grate': 2,
    };

    const base = baseTime[taskType] ?? 3;
    const perItem = perItemTime[taskType] ?? 2;

    return base + perItem * itemCount;
  }

  /**
   * Extract equipment needed from recipe instructions.
   */
  private extractEquipment(
    recipeMap: Map<string, RecipeWithRelations>
  ): Set<string> {
    const equipment = new Set<string>();

    for (const [, recipe] of recipeMap) {
      const instructions = recipe.instructions.toLowerCase();

      for (const item of EQUIPMENT_PATTERNS) {
        if (instructions.includes(item.toLowerCase())) {
          // Capitalize first letter
          equipment.add(item.charAt(0).toUpperCase() + item.slice(1));
        }
      }
    }

    return equipment;
  }

  /**
   * Calculate total prep time from recipe summaries.
   * Only counts recipes that need full prep.
   */
  private calculateTotalPrepTime(recipes: RecipeSummary[]): number {
    let total = 0;

    for (const recipe of recipes) {
      if (recipe.needsFullPrep && recipe.prepTimeMinutes) {
        total += recipe.prepTimeMinutes;
      }
    }

    return total;
  }

  /**
   * Sort tasks by priority (marinating first, mixing last).
   */
  private sortTasksByPriority(tasks: PrepTask[]): PrepTask[] {
    return tasks.sort((a, b) => {
      const priorityA = TASK_PRIORITY[a.taskType] ?? 99;
      const priorityB = TASK_PRIORITY[b.taskType] ?? 99;
      return priorityA - priorityB;
    });
  }
}
