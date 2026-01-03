import { Command } from 'commander';
import * as fs from 'node:fs';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  PlanService,
  RecipeService,
  type MealType,
  type WeeklyPlanWithItems,
} from '@meals/core';
import {
  printJson,
  printSuccess,
  printError,
  getGlobalOptions,
  type GlobalOptions,
} from '../output.js';

/**
 * Initialize database and return a PlanService instance
 */
function getPlanService(dbPath?: string): PlanService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new PlanService(db);
}

/**
 * Initialize database and return a RecipeService instance
 */
function getRecipeService(dbPath?: string): RecipeService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new RecipeService(db);
}

/**
 * Parse week input to ISO week format.
 * Supports: "this-week", "next-week", or ISO format like "2025-W02"
 */
function parseWeek(input: string): string {
  const now = new Date();

  if (input === 'this-week') {
    return getIsoWeek(now);
  }

  if (input === 'next-week') {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return getIsoWeek(nextWeek);
  }

  // Validate ISO week format
  const isoWeekRegex = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;
  if (!isoWeekRegex.test(input)) {
    throw new Error(
      `Invalid week format: "${input}". Expected YYYY-Wnn (e.g., 2025-W02), "this-week", or "next-week"`
    );
  }

  return input;
}

/**
 * Get ISO week string for a given date.
 * Returns format like "2025-W02"
 */
function getIsoWeek(date: Date): string {
  // Create a copy of the date to avoid mutation
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  // Get first day of the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  // Calculate full weeks to nearest Thursday
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Parse day string to day number (1-7, Monday-Sunday)
 */
function parseDay(input: string): number {
  const dayMap: Record<string, number> = {
    mon: 1, monday: 1,
    tue: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
    sun: 7, sunday: 7,
  };

  const day = dayMap[input.toLowerCase()];
  if (!day) {
    throw new Error(
      `Invalid day: "${input}". Expected: mon, tue, wed, thu, fri, sat, or sun`
    );
  }
  return day;
}

/**
 * Get day name from day number (1-7)
 */
function getDayName(dayNum: number): string {
  const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days[dayNum] ?? '';
}

/**
 * Parse meal type string to MealType enum
 */
function parseMealType(input: string): MealType {
  const mealMap: Record<string, MealType> = {
    breakfast: 'breakfast',
    lunch: 'lunch',
    dinner: 'dinner',
  };

  const meal = mealMap[input.toLowerCase()];
  if (!meal) {
    throw new Error(
      `Invalid meal type: "${input}". Expected: breakfast, lunch, or dinner`
    );
  }
  return meal;
}

/**
 * Format plan as a table for display
 */
function displayPlanTable(plan: WeeklyPlanWithItems, recipeService: RecipeService): void {
  console.log('');
  console.log(`Week ${plan.week} (${plan.status})`);
  console.log('');

  // Build a lookup for items by day and meal type
  const itemsBySlot = new Map<string, string>();
  if (plan.items) {
    for (const item of plan.items) {
      const key = `${item.dayOfWeek}-${item.mealType}`;
      if (item.recipeId) {
        // Look up recipe title
        const recipe = recipeService.getRecipe(item.recipeId);
        itemsBySlot.set(key, recipe?.title ?? item.recipeId);
      }
    }
  }

  // Calculate column widths
  const dayWidth = 3;
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];
  const mealWidths: Record<MealType, number> = { breakfast: 9, lunch: 5, dinner: 6 };

  // Find max widths based on recipe titles
  for (let day = 1; day <= 7; day++) {
    for (const meal of mealTypes) {
      const key = `${day}-${meal}`;
      const value = itemsBySlot.get(key) ?? '-';
      mealWidths[meal] = Math.max(mealWidths[meal], value.length);
    }
  }

  // Print header
  const header = `| ${'Day'.padEnd(dayWidth)} | ${'Breakfast'.padEnd(mealWidths.breakfast)} | ${'Lunch'.padEnd(mealWidths.lunch)} | ${'Dinner'.padEnd(mealWidths.dinner)} |`;
  const separator = `|${'-'.repeat(dayWidth + 2)}|${'-'.repeat(mealWidths.breakfast + 2)}|${'-'.repeat(mealWidths.lunch + 2)}|${'-'.repeat(mealWidths.dinner + 2)}|`;

  console.log(header);
  console.log(separator);

  // Print rows
  for (let day = 1; day <= 7; day++) {
    const dayName = getDayName(day);
    const breakfast = itemsBySlot.get(`${day}-breakfast`) ?? '-';
    const lunch = itemsBySlot.get(`${day}-lunch`) ?? '-';
    const dinner = itemsBySlot.get(`${day}-dinner`) ?? '-';

    const row = `| ${dayName.padEnd(dayWidth)} | ${breakfast.padEnd(mealWidths.breakfast)} | ${lunch.padEnd(mealWidths.lunch)} | ${dinner.padEnd(mealWidths.dinner)} |`;
    console.log(row);
  }

  console.log('');

  if (plan.notes) {
    console.log(`Notes: ${plan.notes}`);
    console.log('');
  }
}

/**
 * Format plan as markdown for export
 */
function formatPlanMarkdown(plan: WeeklyPlanWithItems, recipeService: RecipeService): string {
  const lines: string[] = [];

  lines.push(`# Meal Plan: ${plan.week}`);
  lines.push('');
  lines.push(`**Status:** ${plan.status}`);
  lines.push('');

  if (plan.notes) {
    lines.push(`**Notes:** ${plan.notes}`);
    lines.push('');
  }

  // Build a lookup for items by day and meal type
  const itemsBySlot = new Map<string, { title: string; servings: number; notes: string | null }>();
  if (plan.items) {
    for (const item of plan.items) {
      const key = `${item.dayOfWeek}-${item.mealType}`;
      if (item.recipeId) {
        const recipe = recipeService.getRecipe(item.recipeId);
        itemsBySlot.set(key, {
          title: recipe?.title ?? item.recipeId,
          servings: item.servings,
          notes: item.notes,
        });
      }
    }
  }

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

  // Print table header
  lines.push('| Day | Breakfast | Lunch | Dinner |');
  lines.push('|-----|-----------|-------|--------|');

  // Print rows
  for (let day = 1; day <= 7; day++) {
    const dayName = getDayName(day);
    const cells = mealTypes.map((meal) => {
      const item = itemsBySlot.get(`${day}-${meal}`);
      return item ? item.title : '-';
    });
    lines.push(`| ${dayName} | ${cells.join(' | ')} |`);
  }

  lines.push('');
  lines.push(`*Generated on ${new Date().toISOString().split('T')[0]}*`);
  lines.push('');

  return lines.join('\n');
}

export const planCommand = new Command('plan')
  .description('Weekly plan management')
  .action(() => {
    console.log('Plan commands - use --help to see available subcommands.');
  });

// CREATE command
planCommand
  .command('create <week>')
  .description('Create a new weekly plan (week format: YYYY-Wnn, this-week, or next-week)')
  .action((week: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const isoWeek = parseWeek(week);
      const service = getPlanService(globalOpts.db);

      // Check if plan already exists
      const existing = service.getPlanByWeek(isoWeek);
      if (existing) {
        printError(`Plan for week ${isoWeek} already exists (ID: ${existing.id})`);
        process.exit(1);
      }

      const plan = service.createPlan({
        week: isoWeek,
        status: 'draft',
        notes: null,
      });

      if (globalOpts.json) {
        printJson(plan);
      } else {
        printSuccess(`Created plan for week ${plan.week} (ID: ${plan.id})`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SHOW command
planCommand
  .command('show [week]')
  .description('Show current plan')
  .action((week: string | undefined, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getPlanService(globalOpts.db);
      const recipeService = getRecipeService(globalOpts.db);

      let plan: WeeklyPlanWithItems | null;

      if (week) {
        const isoWeek = parseWeek(week);
        plan = service.getPlanByWeek(isoWeek);
      } else {
        // Get active plan or current week's plan
        const plans = service.listPlans({ status: 'active', limit: 1 });
        if (plans.length > 0) {
          plan = plans[0];
        } else {
          // Try to get this week's plan
          const thisWeek = getIsoWeek(new Date());
          plan = service.getPlanByWeek(thisWeek);
        }
      }

      if (!plan) {
        printError(
          week
            ? `No plan found for week ${parseWeek(week)}`
            : 'No active plan found. Create one with: meals plan create this-week'
        );
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(plan);
      } else {
        displayPlanTable(plan, recipeService);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SUGGEST command (placeholder)
planCommand
  .command('suggest [week]')
  .description('Get AI suggestions to fill empty slots')
  .option('--max-prep <minutes>', 'Maximum prep time in minutes')
  .option('--cuisine <cuisine...>', 'Preferred cuisines')
  .action(() => {
    console.log('Meal suggestion feature coming soon.');
  });

// SET command
planCommand
  .command('set <week> <day> <meal> <recipe-id>')
  .description('Set a specific meal (day: mon-sun, meal: breakfast/lunch/dinner)')
  .option('-s, --servings <n>', 'Number of servings', '2')
  .option('-n, --notes <text>', 'Notes for this meal')
  .action((week: string, day: string, meal: string, recipeId: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const isoWeek = parseWeek(week);
      const dayOfWeek = parseDay(day);
      const mealType = parseMealType(meal);
      const servings = parseInt(options.servings, 10);

      const service = getPlanService(globalOpts.db);
      const recipeService = getRecipeService(globalOpts.db);

      // Get or create plan for this week
      let plan = service.getPlanByWeek(isoWeek);
      if (!plan) {
        plan = service.createPlan({
          week: isoWeek,
          status: 'draft',
          notes: null,
        });
      }

      // Verify recipe exists
      const recipe = recipeService.getRecipe(recipeId);
      if (!recipe) {
        printError(`Recipe not found: ${recipeId}`);
        process.exit(1);
      }

      // Set the meal
      const item = service.setMeal(
        plan.id,
        dayOfWeek,
        mealType,
        recipeId,
        servings,
        options.notes
      );

      if (!item) {
        printError('Failed to set meal');
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(item);
      } else {
        const dayName = getDayName(dayOfWeek);
        printSuccess(
          `Set ${dayName} ${mealType} to "${recipe.title}" for week ${isoWeek}`
        );
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SWAP command (placeholder)
planCommand
  .command('swap <week> <day> <meal>')
  .description('Swap a meal (get alternatives)')
  .option('-r, --reason <text>', 'Reason for swapping')
  .action(() => {
    console.log('Meal suggestion feature coming soon.');
  });

// ACTIVATE command
planCommand
  .command('activate <week>')
  .description('Mark plan as active')
  .action((week: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const isoWeek = parseWeek(week);
      const service = getPlanService(globalOpts.db);

      const plan = service.getPlanByWeek(isoWeek);
      if (!plan) {
        printError(`No plan found for week ${isoWeek}`);
        process.exit(1);
      }

      const updated = service.setStatus(plan.id, 'active');

      if (!updated) {
        printError('Failed to activate plan');
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(updated);
      } else {
        printSuccess(`Activated plan for week ${isoWeek}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// EXPORT command
planCommand
  .command('export [week]')
  .description('Export plan to markdown')
  .option('-o, --output <file>', 'Output file path')
  .action((week: string | undefined, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getPlanService(globalOpts.db);
      const recipeService = getRecipeService(globalOpts.db);

      let plan: WeeklyPlanWithItems | null;

      if (week) {
        const isoWeek = parseWeek(week);
        plan = service.getPlanByWeek(isoWeek);
      } else {
        // Get active plan or current week's plan
        const plans = service.listPlans({ status: 'active', limit: 1 });
        if (plans.length > 0) {
          plan = plans[0];
        } else {
          // Try to get this week's plan
          const thisWeek = getIsoWeek(new Date());
          plan = service.getPlanByWeek(thisWeek);
        }
      }

      if (!plan) {
        printError(
          week
            ? `No plan found for week ${parseWeek(week)}`
            : 'No active plan found. Create one with: meals plan create this-week'
        );
        process.exit(1);
      }

      const markdown = formatPlanMarkdown(plan, recipeService);

      if (options.output) {
        fs.writeFileSync(options.output, markdown, 'utf-8');
        if (!globalOpts.json) {
          printSuccess(`Exported plan to: ${options.output}`);
        } else {
          printJson({ exported: true, file: options.output, week: plan.week });
        }
      } else {
        // Output to stdout
        console.log(markdown);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
