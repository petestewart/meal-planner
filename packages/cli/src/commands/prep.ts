import { Command } from 'commander';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  PrepBatchService,
  RecipeService,
  type PrepBatchWithRemaining,
} from '@meals/core';
import {
  printJson,
  printSuccess,
  printError,
  getGlobalOptions,
  type GlobalOptions,
} from '../output.js';

/**
 * Initialize database and return a PrepBatchService instance
 */
function getPrepBatchService(dbPath?: string): PrepBatchService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new PrepBatchService(db);
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
 * Parse date input to ISO date format.
 * Supports: day names (sunday, monday, etc.), "today", "tomorrow", or ISO format like "2025-01-05"
 */
function parseDate(input: string): string {
  const now = new Date();
  const lowerInput = input.toLowerCase();

  // Day name mapping
  const dayMap: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };

  if (lowerInput === 'today') {
    return now.toISOString().split('T')[0];
  }

  if (lowerInput === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // Check if it's a day name
  if (dayMap[lowerInput] !== undefined) {
    const targetDay = dayMap[lowerInput];
    const currentDay = now.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) {
      daysUntil += 7; // Next week
    }
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntil);
    return targetDate.toISOString().split('T')[0];
  }

  // Validate ISO date format
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(input)) {
    throw new Error(
      `Invalid date format: "${input}". Expected YYYY-MM-DD, day name (sunday, monday, etc.), "today", or "tomorrow"`
    );
  }

  return input;
}

/**
 * Display prep batch in a nice format
 */
function displayBatch(batch: PrepBatchWithRemaining): void {
  console.log(`  ID: ${batch.id}`);
  console.log(`  Recipe: ${batch.recipeTitle ?? batch.recipeId}`);
  console.log(`  Prep Date: ${batch.prepDate}`);
  console.log(`  Total Servings: ${batch.totalServings}`);
  console.log(`  Allocated: ${batch.allocatedServings} (${batch.linkedMeals} meals)`);
  console.log(`  Remaining: ${batch.remainingServings}`);
  if (batch.notes) {
    console.log(`  Notes: ${batch.notes}`);
  }
  console.log('');
}

export const prepCommand = new Command('prep')
  .description('Batch cooking and meal prep tracking')
  .action(() => {
    console.log('Prep commands - use --help to see available subcommands.');
  });

// CREATE command
prepCommand
  .command('create <recipe-id>')
  .description('Create a new prep batch for a recipe')
  .option('-s, --servings <n>', 'Total servings to prepare', '8')
  .option('-d, --date <date>', 'Prep date (day name, today, tomorrow, or YYYY-MM-DD)', 'today')
  .option('-n, --notes <text>', 'Notes for this batch')
  .action((recipeId: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const prepService = getPrepBatchService(globalOpts.db);
      const recipeService = getRecipeService(globalOpts.db);

      // Verify recipe exists
      const recipe = recipeService.getRecipe(recipeId);
      if (!recipe) {
        printError(`Recipe not found: ${recipeId}`);
        process.exit(1);
      }

      const prepDate = parseDate(options.date);
      const servings = parseInt(options.servings, 10);

      if (isNaN(servings) || servings <= 0) {
        printError('Servings must be a positive number');
        process.exit(1);
      }

      const batch = prepService.createBatch({
        recipeId,
        prepDate,
        totalServings: servings,
        notes: options.notes ?? null,
      });

      if (globalOpts.json) {
        printJson(batch);
      } else {
        printSuccess(`Created prep batch for "${recipe.title}"`);
        console.log('');
        console.log(`  ID: ${batch.id}`);
        console.log(`  Prep Date: ${batch.prepDate}`);
        console.log(`  Total Servings: ${batch.totalServings}`);
        if (batch.notes) {
          console.log(`  Notes: ${batch.notes}`);
        }
        console.log('');
        console.log('Use this batch ID with "meals plan set ... --batch <batch-id>" to link meals.');
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// LIST command
prepCommand
  .command('list')
  .description('Show active prep batches with remaining servings')
  .option('--all', 'Show all batches including those with no remaining servings')
  .option('--recipe <recipe-id>', 'Filter by recipe ID')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const prepService = getPrepBatchService(globalOpts.db);

      let batches: PrepBatchWithRemaining[];

      if (options.all) {
        batches = prepService.listBatchesWithRemaining({
          recipeId: options.recipe,
        });
      } else {
        batches = prepService.listActiveBatches({
          recipeId: options.recipe,
        });
      }

      if (globalOpts.json) {
        printJson(batches);
      } else {
        if (batches.length === 0) {
          console.log('');
          console.log(options.all
            ? 'No prep batches found.'
            : 'No active prep batches with remaining servings.');
          console.log('');
          console.log('Create a batch with: meals prep create <recipe-id> --servings 16 --date sunday');
          console.log('');
          return;
        }

        console.log('');
        console.log(options.all ? 'All Prep Batches' : 'Active Prep Batches');
        console.log('='.repeat(40));
        console.log('');

        for (const batch of batches) {
          displayBatch(batch);
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SHOW command
prepCommand
  .command('show <batch-id>')
  .description('Show details of a specific prep batch')
  .action((batchId: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const prepService = getPrepBatchService(globalOpts.db);

      const batch = prepService.getBatchWithRemaining(batchId);

      if (!batch) {
        printError(`Prep batch not found: ${batchId}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(batch);
      } else {
        console.log('');
        console.log('Prep Batch Details');
        console.log('='.repeat(40));
        console.log('');
        displayBatch(batch);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// DELETE command
prepCommand
  .command('delete <batch-id>')
  .description('Delete a prep batch (linked meals will be unlinked)')
  .action((batchId: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const prepService = getPrepBatchService(globalOpts.db);

      // Get batch info before deletion
      const batch = prepService.getBatchWithRemaining(batchId);
      if (!batch) {
        printError(`Prep batch not found: ${batchId}`);
        process.exit(1);
      }

      const deleted = prepService.deleteBatch(batchId);

      if (!deleted) {
        printError('Failed to delete prep batch');
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson({ deleted: true, batchId, linkedMealsUnlinked: batch.linkedMeals });
      } else {
        printSuccess(`Deleted prep batch for "${batch.recipeTitle}"`);
        if (batch.linkedMeals > 0) {
          console.log(`  ${batch.linkedMeals} linked meals have been unlinked.`);
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// UPDATE command
prepCommand
  .command('update <batch-id>')
  .description('Update a prep batch')
  .option('-s, --servings <n>', 'Update total servings')
  .option('-d, --date <date>', 'Update prep date')
  .option('-n, --notes <text>', 'Update notes')
  .action((batchId: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const prepService = getPrepBatchService(globalOpts.db);

      // Check if batch exists
      if (!prepService.batchExists(batchId)) {
        printError(`Prep batch not found: ${batchId}`);
        process.exit(1);
      }

      // Build update data
      const updateData: {
        id: string;
        totalServings?: number;
        prepDate?: string;
        notes?: string | null;
      } = { id: batchId };

      if (options.servings) {
        const servings = parseInt(options.servings, 10);
        if (isNaN(servings) || servings <= 0) {
          printError('Servings must be a positive number');
          process.exit(1);
        }
        updateData.totalServings = servings;
      }

      if (options.date) {
        updateData.prepDate = parseDate(options.date);
      }

      if (options.notes !== undefined) {
        updateData.notes = options.notes || null;
      }

      const batch = prepService.updateBatch(updateData);

      if (!batch) {
        printError('Failed to update prep batch');
        process.exit(1);
      }

      // Get full details including remaining
      const fullBatch = prepService.getBatchWithRemaining(batchId);

      if (globalOpts.json) {
        printJson(fullBatch);
      } else {
        printSuccess('Updated prep batch');
        console.log('');
        if (fullBatch) {
          displayBatch(fullBatch);
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
