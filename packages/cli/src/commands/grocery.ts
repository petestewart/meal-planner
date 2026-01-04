import { Command } from 'commander';
import * as fs from 'node:fs';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  GroceryService,
  PlanService,
  type GroceryList,
  type GroceryGroup,
  type PersistentGroceryList,
  type GroceryListItemWithStatus,
  type GroceryItemStatus,
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
 * Initialize database and return a GroceryService instance
 */
function getGroceryService(dbPath?: string): GroceryService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new GroceryService(db);
}

/**
 * Initialize database and return a PlanService instance
 */
function getPlanService(dbPath?: string): PlanService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new PlanService(db);
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
 * Format quantity with unit for display
 */
function formatQuantity(quantity: number, unit: string): string {
  if (quantity === 0 && !unit) {
    return '';
  }
  if (!unit || unit === 'units') {
    return `${quantity}`;
  }
  return `${quantity} ${unit}`;
}

/**
 * Display grocery list in terminal format
 */
function displayGroceryList(list: GroceryList): void {
  console.log('');
  console.log(`Grocery List for ${list.week}`);
  console.log('='.repeat(30));
  console.log('');

  if (list.groups.length === 0) {
    console.log('No items in grocery list.');
    console.log('');
    return;
  }

  for (const group of list.groups) {
    console.log(`## ${group.name}`);
    for (const item of group.items) {
      const qty = formatQuantity(item.totalQuantity, item.unit);
      const recipes = item.recipes.length > 0 ? ` - ${item.recipes.join(', ')}` : '';
      const qtyPart = qty ? ` (${qty})` : '';
      console.log(`- [ ] ${item.ingredient}${qtyPart}${recipes}`);
    }
    console.log('');
  }
}

/**
 * Format grocery list as markdown
 */
function formatGroceryListMarkdown(list: GroceryList): string {
  const lines: string[] = [];

  lines.push(`# Grocery List for ${list.week}`);
  lines.push('');

  if (list.groups.length === 0) {
    lines.push('No items in grocery list.');
    lines.push('');
    return lines.join('\n');
  }

  for (const group of list.groups) {
    lines.push(`## ${group.name}`);
    for (const item of group.items) {
      const qty = formatQuantity(item.totalQuantity, item.unit);
      const recipes = item.recipes.length > 0 ? ` - ${item.recipes.join(', ')}` : '';
      const qtyPart = qty ? ` (${qty})` : '';
      lines.push(`- [ ] ${item.ingredient}${qtyPart}${recipes}`);
    }
    lines.push('');
  }

  lines.push(`*Generated on ${new Date().toISOString().split('T')[0]}*`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format grocery list as plain text
 */
function formatGroceryListText(list: GroceryList): string {
  const lines: string[] = [];

  lines.push(`Grocery List for ${list.week}`);
  lines.push('='.repeat(30));
  lines.push('');

  if (list.groups.length === 0) {
    lines.push('No items in grocery list.');
    lines.push('');
    return lines.join('\n');
  }

  for (const group of list.groups) {
    lines.push(`${group.name}:`);
    for (const item of group.items) {
      const qty = formatQuantity(item.totalQuantity, item.unit);
      const recipes = item.recipes.length > 0 ? ` (for: ${item.recipes.join(', ')})` : '';
      const qtyPart = qty ? ` - ${qty}` : '';
      lines.push(`  [ ] ${item.ingredient}${qtyPart}${recipes}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get current week's plan or active plan
 */
function getCurrentPlanWeek(planService: PlanService): string | null {
  // Try to get active plan first
  const activePlans = planService.listPlans({ status: 'active', limit: 1 });
  if (activePlans.length > 0) {
    return activePlans[0].week;
  }

  // Try this week's plan
  const thisWeek = getIsoWeek(new Date());
  const plan = planService.getPlanByWeek(thisWeek);
  if (plan) {
    return thisWeek;
  }

  return null;
}

export const groceryCommand = new Command('grocery')
  .description('Grocery list generation')
  .action(() => {
    console.log('Grocery commands - use --help to see available subcommands.');
  });

/**
 * Get status symbol for display
 */
function getStatusSymbol(status: GroceryItemStatus): string {
  switch (status) {
    case 'already_have':
      return '[x]';
    case 'partial':
      return '[~]';
    case 'need_to_buy':
    default:
      return '[ ]';
  }
}

/**
 * Format quantity with optional have quantity for partial items
 */
function formatItemQuantity(item: GroceryListItemWithStatus): string {
  if (item.quantity === null || item.quantity === 0) {
    return '';
  }

  const unit = item.unit || '';
  const qty = `${item.quantity}${unit ? ' ' + unit : ''}`;

  if (item.status === 'partial' && item.haveQuantity !== null) {
    return `${qty} (have: ${item.haveQuantity}${unit ? ' ' + unit : ''})`;
  }

  return qty;
}

/**
 * Display persistent grocery list in terminal format
 */
function displayPersistentGroceryList(list: PersistentGroceryList): void {
  console.log('');
  console.log(`Grocery List for ${list.week}`);
  console.log('='.repeat(40));
  console.log(`Status: ${list.counts.needToBuy} to buy, ${list.counts.alreadyHave} have, ${list.counts.partial} partial`);
  console.log('');

  if (list.items.length === 0) {
    console.log('No items in grocery list.');
    console.log('');
    return;
  }

  // Group items by status for display
  const needToBuy = list.items.filter(i => i.status === 'need_to_buy');
  const partial = list.items.filter(i => i.status === 'partial');
  const alreadyHave = list.items.filter(i => i.status === 'already_have');

  if (needToBuy.length > 0) {
    console.log('## Need to Buy');
    for (const item of needToBuy) {
      const qty = formatItemQuantity(item);
      const recipes = item.recipes.length > 0 ? ` - ${item.recipes.join(', ')}` : '';
      const manual = item.isManual ? ' (manual)' : '';
      const qtyPart = qty ? ` (${qty})` : '';
      console.log(`- ${getStatusSymbol(item.status)} ${item.name}${qtyPart}${recipes}${manual}`);
    }
    console.log('');
  }

  if (partial.length > 0) {
    console.log('## Partial');
    for (const item of partial) {
      const qty = formatItemQuantity(item);
      const recipes = item.recipes.length > 0 ? ` - ${item.recipes.join(', ')}` : '';
      const manual = item.isManual ? ' (manual)' : '';
      const qtyPart = qty ? ` (${qty})` : '';
      console.log(`- ${getStatusSymbol(item.status)} ${item.name}${qtyPart}${recipes}${manual}`);
    }
    console.log('');
  }

  if (alreadyHave.length > 0) {
    console.log('## Already Have');
    for (const item of alreadyHave) {
      const qty = formatItemQuantity(item);
      const recipes = item.recipes.length > 0 ? ` - ${item.recipes.join(', ')}` : '';
      const manual = item.isManual ? ' (manual)' : '';
      const qtyPart = qty ? ` (${qty})` : '';
      console.log(`- ${getStatusSymbol(item.status)} ${item.name}${qtyPart}${recipes}${manual}`);
    }
    console.log('');
  }
}

// GENERATE command - now persists the grocery list
groceryCommand
  .command('generate [week]')
  .description('Generate and persist grocery list for a week (week format: YYYY-Wnn, this-week, or next-week)')
  .option('--include-pantry', 'Include items already in pantry')
  .option('--group-by <method>', 'Group by: category, recipe, or aisle', 'category')
  .action((week: string | undefined, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const groceryService = getGroceryService(globalOpts.db);
      const planService = getPlanService(globalOpts.db);

      let targetWeek: string;

      if (week) {
        targetWeek = parseWeek(week);
      } else {
        // Get current plan week
        const currentWeek = getCurrentPlanWeek(planService);
        if (!currentWeek) {
          printError('No active plan found. Specify a week or create a plan first.');
          process.exit(1);
        }
        targetWeek = currentWeek;
      }

      // Use the new generateAndPersist method
      const list = groceryService.generateAndPersist(targetWeek);

      if (!list) {
        printError(`No plan found for week ${targetWeek}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(list);
      } else {
        printSuccess(`Generated grocery list for ${targetWeek}`);
        displayPersistentGroceryList(list);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// LIST command - shows current persistent grocery list
groceryCommand
  .command('list [week]')
  .description('Show the current grocery list for a week')
  .option('--status <status>', 'Filter by status: need_to_buy, already_have, partial')
  .action((week: string | undefined, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const groceryService = getGroceryService(globalOpts.db);
      const planService = getPlanService(globalOpts.db);

      let targetWeek: string;

      if (week) {
        targetWeek = parseWeek(week);
      } else {
        // Get current plan week
        const currentWeek = getCurrentPlanWeek(planService);
        if (!currentWeek) {
          printError('No active plan found. Specify a week or create a plan first.');
          process.exit(1);
        }
        targetWeek = currentWeek;
      }

      const list = groceryService.getPersistentList(targetWeek);

      if (!list) {
        printError(`No grocery list found for week ${targetWeek}. Generate one first with 'grocery generate ${targetWeek}'`);
        process.exit(1);
      }

      // Filter by status if specified
      if (options.status) {
        const status = options.status as GroceryItemStatus;
        list.items = list.items.filter(item => item.status === status);
      }

      if (globalOpts.json) {
        printJson(list);
      } else {
        displayPersistentGroceryList(list);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// CHECK command - marks an item as already_have
groceryCommand
  .command('check <week> <item>')
  .description('Mark an item as already have (checked off)')
  .option('--partial <quantity>', 'Mark as partial with have quantity', parseFloat)
  .action((week: string, item: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const groceryService = getGroceryService(globalOpts.db);
      const targetWeek = parseWeek(week);

      let updatedItem: GroceryListItemWithStatus | null;

      if (options.partial !== undefined) {
        // Mark as partial
        updatedItem = groceryService.checkItemPartial(targetWeek, item, options.partial);
      } else {
        // Mark as already have
        updatedItem = groceryService.checkItem(targetWeek, item);
      }

      if (!updatedItem) {
        printError(`Item "${item}" not found in grocery list for week ${targetWeek}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(updatedItem);
      } else {
        if (options.partial !== undefined) {
          printSuccess(`Marked "${updatedItem.name}" as partial (have: ${options.partial})`);
        } else {
          printSuccess(`Marked "${updatedItem.name}" as already have`);
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// UNCHECK command - marks an item back to need_to_buy
groceryCommand
  .command('uncheck <week> <item>')
  .description('Mark an item as need to buy (unchecked)')
  .action((week: string, item: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const groceryService = getGroceryService(globalOpts.db);
      const targetWeek = parseWeek(week);

      const updatedItem = groceryService.uncheckItem(targetWeek, item);

      if (!updatedItem) {
        printError(`Item "${item}" not found in grocery list for week ${targetWeek}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(updatedItem);
      } else {
        printSuccess(`Marked "${updatedItem.name}" as need to buy`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// ADD command - adds a manual item
groceryCommand
  .command('add <week> <item>')
  .description('Add a manual item to the grocery list')
  .option('--quantity <n>', 'Quantity to add', parseFloat)
  .option('--unit <unit>', 'Unit of measurement')
  .action((week: string, item: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const groceryService = getGroceryService(globalOpts.db);
      const targetWeek = parseWeek(week);

      const addedItem = groceryService.addManualItem(
        targetWeek,
        item,
        options.quantity ?? null,
        options.unit ?? null
      );

      if (!addedItem) {
        printError(`Failed to add item "${item}" to grocery list for week ${targetWeek}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(addedItem);
      } else {
        const qty = options.quantity ? ` (${options.quantity}${options.unit ? ' ' + options.unit : ''})` : '';
        printSuccess(`Added "${addedItem.name}"${qty} to grocery list for ${targetWeek}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// CHECK-PANTRY command - bulk marks items from pantry
groceryCommand
  .command('check-pantry <week>')
  .description('Bulk-mark items from pantry as already have')
  .action((week: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const groceryService = getGroceryService(globalOpts.db);
      const targetWeek = parseWeek(week);

      const result = groceryService.checkPantry(targetWeek);

      if (globalOpts.json) {
        printJson(result);
      } else {
        if (result.warning) {
          printWarning(result.warning);
        }
        console.log(`Checked ${result.itemsChecked} items, marked ${result.itemsMarked} as already have`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// EXPORT command
groceryCommand
  .command('export [week]')
  .description('Export grocery list to file')
  .option('-o, --output <file>', 'Output file path')
  .option('--format <fmt>', 'Output format: md, txt, or json', 'md')
  .action((week: string | undefined, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const groceryService = getGroceryService(globalOpts.db);
      const planService = getPlanService(globalOpts.db);

      let targetWeek: string;

      if (week) {
        targetWeek = parseWeek(week);
      } else {
        // Get current plan week
        const currentWeek = getCurrentPlanWeek(planService);
        if (!currentWeek) {
          printError('No active plan found. Specify a week or create a plan first.');
          process.exit(1);
        }
        targetWeek = currentWeek;
      }

      const list = groceryService.generateList(targetWeek);

      if (!list) {
        printError(`No plan found for week ${targetWeek}`);
        process.exit(1);
      }

      let content: string;
      const format = options.format?.toLowerCase() || 'md';

      switch (format) {
        case 'json':
          content = JSON.stringify(list, null, 2);
          break;
        case 'txt':
        case 'text':
          content = formatGroceryListText(list);
          break;
        case 'md':
        case 'markdown':
        default:
          content = formatGroceryListMarkdown(list);
          break;
      }

      if (options.output) {
        fs.writeFileSync(options.output, content, 'utf-8');
        if (!globalOpts.json) {
          printSuccess(`Exported grocery list to: ${options.output}`);
        } else {
          printJson({ exported: true, file: options.output, week: list.week, format });
        }
      } else {
        // Output to stdout
        console.log(content);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
