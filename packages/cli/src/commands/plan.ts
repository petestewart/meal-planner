import { Command } from 'commander';
import * as fs from 'node:fs';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  PlanService,
  RecipeService,
  SuggestionService,
  type MealType,
  type SlotType,
  type WeeklyPlanWithItems,
  type RecipeSuggestion,
  type PlanItem,
} from '@meals/core';
import {
  printJson,
  printSuccess,
  printError,
  printInfo,
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
 * Initialize database and return a SuggestionService instance
 */
function getSuggestionService(dbPath?: string): SuggestionService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new SuggestionService(db);
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
 * Format slot display text based on slot type
 */
function getSlotDisplayText(
  item: PlanItem,
  recipeService: RecipeService,
  planItems: PlanItem[]
): string {
  const slotType = item.slotType ?? 'recipe';

  switch (slotType) {
    case 'dining_out':
      return item.notes ? `Dining Out (${item.notes})` : 'Dining Out';
    case 'skip':
      return 'Skip';
    case 'leftovers': {
      if (item.leftoversSourceId) {
        const sourceItem = planItems.find(i => i.id === item.leftoversSourceId);
        if (sourceItem) {
          const dayName = getDayName(sourceItem.dayOfWeek);
          return `Leftovers (from ${dayName} ${sourceItem.mealType})`;
        }
      }
      return 'Leftovers';
    }
    case 'recipe':
    default:
      if (item.recipeId) {
        const recipe = recipeService.getRecipe(item.recipeId);
        return recipe?.title ?? item.recipeId;
      }
      return '-';
  }
}

/**
 * Format plan as a table for display
 */
function displayPlanTable(plan: WeeklyPlanWithItems, recipeService: RecipeService): void {
  console.log('');
  console.log(`Week ${plan.week} (${plan.status})`);
  console.log('');

  const planItems = plan.items || [];

  // Build a lookup for items by day and meal type
  const itemsBySlot = new Map<string, string>();
  for (const item of planItems) {
    const key = `${item.dayOfWeek}-${item.mealType}`;
    const displayText = getSlotDisplayText(item, recipeService, planItems);
    if (displayText !== '-') {
      itemsBySlot.set(key, displayText);
    }
  }

  // Calculate column widths
  const dayWidth = 3;
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];
  const mealWidths: Record<MealType, number> = { breakfast: 9, lunch: 5, dinner: 6 };

  // Find max widths based on display text
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

/**
 * Display suggestions in a nice format
 */
function displaySuggestions(
  suggestions: RecipeSuggestion[],
  context: { dayOfWeek?: number; mealType?: MealType; header?: string }
): void {
  const { dayOfWeek, mealType, header } = context;

  console.log('');
  if (header) {
    console.log(header);
    console.log('-'.repeat(header.length));
  } else if (dayOfWeek !== undefined && mealType) {
    const dayName = getDayName(dayOfWeek);
    console.log(`Suggestions for ${dayName} ${mealType}:`);
    console.log('-'.repeat(30));
  }
  console.log('');

  if (suggestions.length === 0) {
    console.log('  No suggestions available.');
    console.log('');
    return;
  }

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    const recipe = suggestion.recipe;

    // Recipe name
    console.log(`${i + 1}. ${recipe.title}`);

    // Score
    console.log(`   Score: ${suggestion.score.toFixed(2)} (higher is better)`);

    // Reasoning - show all reasons except base score
    const significantReasons = suggestion.reasons.filter(r => r.type !== 'base');
    if (significantReasons.length > 0) {
      console.log('   Reasoning:');
      for (const reason of significantReasons) {
        const sign = reason.scoreImpact >= 0 ? '+' : '';
        console.log(`     - ${reason.description} (${sign}${reason.scoreImpact.toFixed(2)})`);
      }
    } else {
      console.log('   Reasoning: Base score (no special factors)');
    }

    // Additional recipe info
    const info: string[] = [];
    if (recipe.cuisine) info.push(recipe.cuisine);
    if (recipe.prepTimeMinutes) info.push(`${recipe.prepTimeMinutes} min prep`);
    if (recipe.difficulty) info.push(recipe.difficulty);
    if (info.length > 0) {
      console.log(`   (${info.join(', ')})`);
    }

    console.log('');
  }
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

// SUGGEST command
planCommand
  .command('suggest [week]')
  .description('Get suggestions to fill empty slots')
  .option('--limit <n>', 'Number of suggestions per slot', '3')
  .option('--day <day>', 'Only suggest for specific day (mon-sun)')
  .option('--meal <meal>', 'Only suggest for specific meal (breakfast/lunch/dinner)')
  .action((week: string | undefined, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const planService = getPlanService(globalOpts.db);
      const suggestionService = getSuggestionService(globalOpts.db);

      // Get the plan
      let plan: WeeklyPlanWithItems | null;
      let isoWeek: string;

      if (week) {
        isoWeek = parseWeek(week);
        plan = planService.getPlanByWeek(isoWeek);
      } else {
        // Get active plan or current week's plan
        const plans = planService.listPlans({ status: 'active', limit: 1 });
        if (plans.length > 0) {
          plan = plans[0];
          isoWeek = plan.week;
        } else {
          // Try to get this week's plan
          isoWeek = getIsoWeek(new Date());
          plan = planService.getPlanByWeek(isoWeek);
        }
      }

      const limit = parseInt(options.limit, 10) || 3;

      // If no plan exists, create one so we can still suggest
      if (!plan) {
        plan = planService.createPlan({
          week: isoWeek!,
          status: 'draft',
          notes: null,
        });
        if (!globalOpts.json) {
          printInfo(`Created new plan for week ${isoWeek}`);
        }
      }

      // Build a lookup of existing meals
      const existingMeals = new Map<string, string>();
      if (plan.items) {
        for (const item of plan.items) {
          if (item.recipeId) {
            const key = `${item.dayOfWeek}-${item.mealType}`;
            existingMeals.set(key, item.recipeId);
          }
        }
      }

      // Determine which slots to suggest for
      const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];
      const slotsToFill: Array<{ dayOfWeek: number; mealType: MealType }> = [];

      if (options.day && options.meal) {
        // Specific slot
        const dayOfWeek = parseDay(options.day);
        const mealType = parseMealType(options.meal);
        const key = `${dayOfWeek}-${mealType}`;
        if (!existingMeals.has(key)) {
          slotsToFill.push({ dayOfWeek, mealType });
        }
      } else if (options.day) {
        // All meals for a specific day
        const dayOfWeek = parseDay(options.day);
        for (const mealType of mealTypes) {
          const key = `${dayOfWeek}-${mealType}`;
          if (!existingMeals.has(key)) {
            slotsToFill.push({ dayOfWeek, mealType });
          }
        }
      } else if (options.meal) {
        // Specific meal type for all days
        const mealType = parseMealType(options.meal);
        for (let day = 1; day <= 7; day++) {
          const key = `${day}-${mealType}`;
          if (!existingMeals.has(key)) {
            slotsToFill.push({ dayOfWeek: day, mealType });
          }
        }
      } else {
        // All empty slots
        for (let day = 1; day <= 7; day++) {
          for (const mealType of mealTypes) {
            const key = `${day}-${mealType}`;
            if (!existingMeals.has(key)) {
              slotsToFill.push({ dayOfWeek: day, mealType });
            }
          }
        }
      }

      if (slotsToFill.length === 0) {
        if (globalOpts.json) {
          printJson({ week: plan.week, suggestions: [], message: 'All slots are filled' });
        } else {
          console.log('');
          console.log(`Week ${plan.week}: All meal slots are already filled.`);
          console.log('');
        }
        return;
      }

      // Get suggestions for each empty slot
      const allSuggestions: Array<{
        dayOfWeek: number;
        mealType: MealType;
        suggestions: RecipeSuggestion[];
      }> = [];

      for (const slot of slotsToFill) {
        const suggestions = suggestionService.getSuggestions(
          slot.dayOfWeek,
          slot.mealType,
          {
            limit,
            planId: plan.id,
          }
        );

        allSuggestions.push({
          dayOfWeek: slot.dayOfWeek,
          mealType: slot.mealType,
          suggestions,
        });
      }

      if (globalOpts.json) {
        printJson({
          week: plan.week,
          slots: allSuggestions.map(s => ({
            dayOfWeek: s.dayOfWeek,
            day: getDayName(s.dayOfWeek),
            mealType: s.mealType,
            suggestions: s.suggestions.map(sg => ({
              recipeId: sg.recipe.id,
              title: sg.recipe.title,
              score: sg.score,
              cuisine: sg.recipe.cuisine,
              prepTime: sg.recipe.prepTimeMinutes,
              reasons: sg.reasons,
            })),
          })),
        });
      } else {
        console.log('');
        console.log(`Meal Suggestions for Week ${plan.week}`);
        console.log('='.repeat(40));

        for (const slot of allSuggestions) {
          displaySuggestions(slot.suggestions, {
            dayOfWeek: slot.dayOfWeek,
            mealType: slot.mealType,
          });
        }

        // Show tip about setting a meal
        if (allSuggestions.some(s => s.suggestions.length > 0)) {
          console.log('Tip: Use "meals plan set <week> <day> <meal> <recipe-id>" to assign a suggestion.');
          console.log('');
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SET command
planCommand
  .command('set <week> <day> <meal> [recipe-id]')
  .description('Set a specific meal (day: mon-sun, meal: breakfast/lunch/dinner)')
  .option('-s, --servings <n>', 'Number of servings', '2')
  .option('-n, --notes <text>', 'Notes for this meal')
  .option('--dining-out', 'Mark this slot as dining out (no recipe needed)')
  .option('--skip', 'Mark this slot as skipped')
  .option('--leftovers-from <day-meal>', 'Mark as leftovers from another meal (e.g., "mon dinner")')
  .action((week: string, day: string, meal: string, recipeId: string | undefined, options, command) => {
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

      // Determine slot type based on flags
      let slotType: SlotType = 'recipe';
      let leftoversSourceId: string | null = null;
      let displayMessage = '';
      const dayName = getDayName(dayOfWeek);

      if (options.diningOut) {
        slotType = 'dining_out';
        displayMessage = options.notes
          ? `Set ${dayName} ${mealType} to Dining Out (${options.notes}) for week ${isoWeek}`
          : `Set ${dayName} ${mealType} to Dining Out for week ${isoWeek}`;
      } else if (options.skip) {
        slotType = 'skip';
        displayMessage = `Set ${dayName} ${mealType} to Skip for week ${isoWeek}`;
      } else if (options.leftoversFrom) {
        slotType = 'leftovers';
        // Parse the leftovers-from option (e.g., "mon dinner")
        const parts = options.leftoversFrom.trim().split(/\s+/);
        if (parts.length !== 2) {
          printError('Invalid --leftovers-from format. Expected "<day> <meal>" (e.g., "mon dinner")');
          process.exit(1);
        }
        const [sourceDay, sourceMeal] = parts;
        const sourceDayOfWeek = parseDay(sourceDay);
        const sourceMealType = parseMealType(sourceMeal);

        // Find the source meal in the plan
        const sourceMealItem = plan.items?.find(
          item => item.dayOfWeek === sourceDayOfWeek && item.mealType === sourceMealType
        );
        if (!sourceMealItem) {
          printError(`No meal found at ${getDayName(sourceDayOfWeek)} ${sourceMealType} to use as leftovers source`);
          process.exit(1);
        }
        leftoversSourceId = sourceMealItem.id;
        displayMessage = `Set ${dayName} ${mealType} to Leftovers (from ${getDayName(sourceDayOfWeek)} ${sourceMealType}) for week ${isoWeek}`;
      } else {
        // Regular recipe slot - recipe-id is required
        if (!recipeId) {
          printError('Recipe ID is required unless using --dining-out, --skip, or --leftovers-from');
          process.exit(1);
        }

        // Verify recipe exists
        const recipe = recipeService.getRecipe(recipeId);
        if (!recipe) {
          printError(`Recipe not found: ${recipeId}`);
          process.exit(1);
        }
        displayMessage = `Set ${dayName} ${mealType} to "${recipe.title}" for week ${isoWeek}`;
      }

      // Set the meal
      const item = service.setMeal(
        plan.id,
        dayOfWeek,
        mealType,
        slotType === 'recipe' ? recipeId! : null,
        servings,
        options.notes,
        'user',
        slotType,
        leftoversSourceId
      );

      if (!item) {
        printError('Failed to set meal');
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(item);
      } else {
        printSuccess(displayMessage);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SWAP command
planCommand
  .command('swap <week> <day> <meal>')
  .description('Get alternatives for an existing meal')
  .option('-r, --reason <text>', 'Reason for swapping (e.g., "want something simpler", "missing ingredients")')
  .option('--limit <n>', 'Number of alternatives to show', '3')
  .action((week: string, day: string, meal: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const isoWeek = parseWeek(week);
      const dayOfWeek = parseDay(day);
      const mealType = parseMealType(meal);
      const limit = parseInt(options.limit, 10) || 3;

      const planService = getPlanService(globalOpts.db);
      const recipeService = getRecipeService(globalOpts.db);
      const suggestionService = getSuggestionService(globalOpts.db);

      // Get the plan
      const plan = planService.getPlanByWeek(isoWeek);
      if (!plan) {
        printError(`No plan found for week ${isoWeek}`);
        process.exit(1);
      }

      // Find the current meal for this slot
      const currentMeal = plan.items?.find(
        item => item.dayOfWeek === dayOfWeek && item.mealType === mealType
      );

      if (!currentMeal?.recipeId) {
        printError(
          `No meal set for ${getDayName(dayOfWeek)} ${mealType}. ` +
          `Use "meals plan suggest" to get suggestions for empty slots.`
        );
        process.exit(1);
      }

      // Get the current recipe for display
      const currentRecipe = recipeService.getRecipe(currentMeal.recipeId);
      const currentTitle = currentRecipe?.title ?? currentMeal.recipeId;

      // Get swap alternatives
      const alternatives = suggestionService.getSwapAlternatives(
        plan.id,
        dayOfWeek,
        mealType,
        currentMeal.recipeId,
        options.reason,
        limit
      );

      if (globalOpts.json) {
        printJson({
          week: plan.week,
          day: getDayName(dayOfWeek),
          dayOfWeek,
          mealType,
          currentRecipe: {
            id: currentMeal.recipeId,
            title: currentTitle,
          },
          reason: options.reason ?? null,
          alternatives: alternatives.map(alt => ({
            recipeId: alt.recipe.id,
            title: alt.recipe.title,
            score: alt.score,
            cuisine: alt.recipe.cuisine,
            prepTime: alt.recipe.prepTimeMinutes,
            reasons: alt.reasons,
          })),
        });
      } else {
        const dayName = getDayName(dayOfWeek);

        console.log('');
        console.log(`Swap Alternatives for ${dayName} ${mealType}`);
        console.log('='.repeat(40));
        console.log('');
        console.log(`Current: ${currentTitle}`);
        if (options.reason) {
          console.log(`Reason: ${options.reason}`);
        }

        displaySuggestions(alternatives, {
          header: 'Alternatives:',
        });

        if (alternatives.length > 0) {
          console.log(`Tip: Use "meals plan set ${isoWeek} ${day} ${meal} <recipe-id>" to swap.`);
          console.log('');
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
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
