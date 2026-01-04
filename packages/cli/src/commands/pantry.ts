import { Command } from 'commander';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  PantryService,
  type PantryItemWithIngredient,
  PANTRY_LOCATIONS,
  isValidPantryLocation,
} from '@meals/core';
import {
  printJson,
  printSuccess,
  printError,
  printWarning,
  getGlobalOptions,
  type GlobalOptions,
} from '../output.js';

/**
 * Initialize database and return a PantryService instance
 */
function getPantryService(dbPath?: string): PantryService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new PantryService(db);
}

/**
 * Format quantity with unit for display
 */
function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null || quantity === 0) {
    return '';
  }
  if (!unit) {
    return `${quantity}`;
  }
  return `${quantity} ${unit}`;
}

/**
 * Format expiration date for display
 */
function formatExpiration(expiresAt: string | null): string {
  if (!expiresAt) {
    return '';
  }

  const expires = new Date(expiresAt);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const daysUntil = Math.ceil(
    (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 0) {
    return `EXPIRED (${expiresAt})`;
  } else if (daysUntil === 0) {
    return `expires TODAY`;
  } else if (daysUntil === 1) {
    return `expires tomorrow`;
  } else if (daysUntil <= 7) {
    return `expires in ${daysUntil} days`;
  }

  return `expires ${expiresAt}`;
}

/**
 * Display a single pantry item
 */
function displayPantryItem(item: PantryItemWithIngredient): void {
  const qty = formatQuantity(item.quantity, item.unit);
  const exp = formatExpiration(item.expiresAt);
  const loc = item.location ? `[${item.location}]` : '';
  const staple = item.isStaple ? ' (staple)' : '';
  const prepared = item.isPrepared
    ? ` - PREPARED${item.preparationNotes ? `: ${item.preparationNotes}` : ''}`
    : '';

  console.log(
    `- ${item.ingredientName}${qty ? ` (${qty})` : ''} ${loc}${staple}${prepared}${exp ? ` - ${exp}` : ''}`
  );
}

/**
 * Display pantry items grouped by location
 */
function displayPantryList(items: PantryItemWithIngredient[]): void {
  if (items.length === 0) {
    console.log('Pantry is empty.');
    return;
  }

  // Group by location
  const byLocation = new Map<string, PantryItemWithIngredient[]>();
  for (const item of items) {
    const loc = item.location || 'unspecified';
    if (!byLocation.has(loc)) {
      byLocation.set(loc, []);
    }
    byLocation.get(loc)!.push(item);
  }

  // Sort locations: fridge, freezer, pantry, unspecified
  const locationOrder = ['fridge', 'freezer', 'pantry', 'unspecified'];
  const sortedLocations = Array.from(byLocation.keys()).sort((a, b) => {
    return locationOrder.indexOf(a) - locationOrder.indexOf(b);
  });

  console.log('');
  console.log('Pantry Items');
  console.log('='.repeat(40));

  for (const loc of sortedLocations) {
    const locItems = byLocation.get(loc)!;
    // Sort items by name within location
    locItems.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

    const displayLoc = loc === 'unspecified' ? 'Unspecified Location' : loc.charAt(0).toUpperCase() + loc.slice(1);
    console.log(`\n## ${displayLoc}`);

    for (const item of locItems) {
      displayPantryItem(item);
    }
  }

  console.log('');
}

export const pantryCommand = new Command('pantry')
  .description('Pantry management commands')
  .action(() => {
    console.log('Pantry commands - use --help to see available subcommands.');
  });

// LIST command
pantryCommand
  .command('list')
  .description('List all pantry items')
  .option('--location <loc>', `Filter by location (${PANTRY_LOCATIONS.join(', ')})`)
  .option('--prepared', 'Show only prepared items')
  .option('--staples', 'Show only staple items')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const pantryService = getPantryService(globalOpts.db);

      // Validate location if provided
      if (options.location && !isValidPantryLocation(options.location)) {
        printError(
          `Invalid location "${options.location}". Valid locations are: ${PANTRY_LOCATIONS.join(', ')}`
        );
        process.exit(1);
      }

      const filterOptions: {
        location?: 'fridge' | 'freezer' | 'pantry';
        isPrepared?: boolean;
        isStaple?: boolean;
      } = {};

      if (options.location) {
        filterOptions.location = options.location;
      }
      if (options.prepared) {
        filterOptions.isPrepared = true;
      }
      if (options.staples) {
        filterOptions.isStaple = true;
      }

      const items = pantryService.listItems(filterOptions);

      if (globalOpts.json) {
        printJson(items);
      } else {
        displayPantryList(items);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// ADD command
pantryCommand
  .command('add <ingredient>')
  .description('Add an item to the pantry')
  .option('--quantity <n>', 'Quantity to add', parseFloat)
  .option('--unit <unit>', 'Unit of measurement')
  .option('--expires <date>', 'Expiration date (YYYY-MM-DD)')
  .option('--location <loc>', `Storage location (${PANTRY_LOCATIONS.join(', ')})`)
  .option('--prepared', 'Mark as prepared/cooked')
  .option('--notes <text>', 'Preparation notes (use with --prepared)')
  .option('--staple', 'Mark as staple item (always have on hand)')
  .action((ingredient: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const pantryService = getPantryService(globalOpts.db);

      // Validate location if provided
      if (options.location && !isValidPantryLocation(options.location)) {
        printError(
          `Invalid location "${options.location}". Valid locations are: ${PANTRY_LOCATIONS.join(', ')}`
        );
        process.exit(1);
      }

      // Validate date format if provided
      if (options.expires) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(options.expires)) {
          printError('Invalid date format. Use YYYY-MM-DD (e.g., 2026-01-15)');
          process.exit(1);
        }
      }

      const result = pantryService.addItem({
        ingredientName: ingredient,
        quantity: options.quantity ?? null,
        unit: options.unit ?? null,
        expiresAt: options.expires ?? null,
        location: options.location ?? null,
        isPrepared: options.prepared ?? false,
        preparationNotes: options.notes ?? null,
        isStaple: options.staple ?? false,
      });

      if (globalOpts.json) {
        printJson(result);
      } else {
        const action = result.created ? 'Added' : 'Updated';
        const qty = formatQuantity(result.item.quantity, result.item.unit);
        printSuccess(
          `${action} "${result.item.ingredientName}"${qty ? ` (${qty})` : ''} to pantry`
        );
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// REMOVE command
pantryCommand
  .command('remove <ingredient>')
  .description('Remove an item from the pantry')
  .action((ingredient: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const pantryService = getPantryService(globalOpts.db);

      const removed = pantryService.removeItem(ingredient);

      if (!removed) {
        printError(`Item "${ingredient}" not found in pantry`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson({ removed: true, ingredient });
      } else {
        printSuccess(`Removed "${ingredient}" from pantry`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// USE command
pantryCommand
  .command('use <ingredient>')
  .description('Use (decrement quantity of) a pantry item')
  .option('--quantity <n>', 'Quantity to use', parseFloat, 1)
  .action((ingredient: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const pantryService = getPantryService(globalOpts.db);

      const updated = pantryService.useItem(ingredient, options.quantity);

      if (!updated) {
        printError(`Item "${ingredient}" not found in pantry`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(updated);
      } else {
        const remaining = formatQuantity(updated.quantity, updated.unit);
        printSuccess(
          `Used ${options.quantity} of "${updated.ingredientName}". Remaining: ${remaining || '0'}`
        );
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// EXPIRING command
pantryCommand
  .command('expiring')
  .description('Show items expiring within 7 days')
  .option('--days <n>', 'Number of days to check', parseInt, 7)
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const pantryService = getPantryService(globalOpts.db);

      const items = pantryService.listExpiringItems(options.days);

      if (globalOpts.json) {
        printJson(items);
      } else {
        if (items.length === 0) {
          console.log(`\nNo items expiring within ${options.days} days.\n`);
        } else {
          console.log('');
          console.log(`Items Expiring Within ${options.days} Days`);
          console.log('='.repeat(40));

          // Sort by expiration date
          items.sort((a, b) => {
            if (!a.expiresAt) return 1;
            if (!b.expiresAt) return -1;
            return a.expiresAt.localeCompare(b.expiresAt);
          });

          for (const item of items) {
            displayPantryItem(item);
          }
          console.log('');

          if (items.length > 0) {
            printWarning(`${items.length} item(s) expiring soon!`);
          }
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// UPDATE command (for changing item properties)
pantryCommand
  .command('update <ingredient>')
  .description('Update a pantry item\'s properties')
  .option('--quantity <n>', 'Set new quantity', parseFloat)
  .option('--unit <unit>', 'Set unit of measurement')
  .option('--expires <date>', 'Set expiration date (YYYY-MM-DD)')
  .option('--location <loc>', `Set storage location (${PANTRY_LOCATIONS.join(', ')})`)
  .option('--prepared', 'Mark as prepared/cooked')
  .option('--not-prepared', 'Mark as not prepared')
  .option('--notes <text>', 'Set preparation notes')
  .option('--staple', 'Mark as staple item')
  .option('--not-staple', 'Remove staple marking')
  .action((ingredient: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const pantryService = getPantryService(globalOpts.db);

      // Check if item exists
      const existing = pantryService.getByIngredientName(ingredient);
      if (!existing) {
        printError(`Item "${ingredient}" not found in pantry`);
        process.exit(1);
      }

      // Validate location if provided
      if (options.location && !isValidPantryLocation(options.location)) {
        printError(
          `Invalid location "${options.location}". Valid locations are: ${PANTRY_LOCATIONS.join(', ')}`
        );
        process.exit(1);
      }

      // Validate date format if provided
      if (options.expires) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(options.expires)) {
          printError('Invalid date format. Use YYYY-MM-DD (e.g., 2026-01-15)');
          process.exit(1);
        }
      }

      // Build update object
      const updates: {
        quantity?: number | null;
        unit?: string | null;
        expiresAt?: string | null;
        location?: 'fridge' | 'freezer' | 'pantry' | null;
        isPrepared?: boolean;
        preparationNotes?: string | null;
        isStaple?: boolean;
      } = {};

      if (options.quantity !== undefined) {
        updates.quantity = options.quantity;
      }
      if (options.unit !== undefined) {
        updates.unit = options.unit;
      }
      if (options.expires !== undefined) {
        updates.expiresAt = options.expires;
      }
      if (options.location !== undefined) {
        updates.location = options.location;
      }
      if (options.prepared) {
        updates.isPrepared = true;
      }
      if (options.notPrepared) {
        updates.isPrepared = false;
      }
      if (options.notes !== undefined) {
        updates.preparationNotes = options.notes;
      }
      if (options.staple) {
        updates.isStaple = true;
      }
      if (options.notStaple) {
        updates.isStaple = false;
      }

      const updated = pantryService.updateItem(ingredient, updates);

      if (!updated) {
        printError(`Failed to update "${ingredient}"`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(updated);
      } else {
        printSuccess(`Updated "${updated.ingredientName}"`);
        displayPantryItem(updated);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
