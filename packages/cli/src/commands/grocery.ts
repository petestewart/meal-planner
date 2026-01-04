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
} from '@meals/core';
import {
  printJson,
  printSuccess,
  printError,
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

// GENERATE command
groceryCommand
  .command('generate [week]')
  .description('Generate grocery list for a week (week format: YYYY-Wnn, this-week, or next-week)')
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

      const list = groceryService.generateList(targetWeek);

      if (!list) {
        printError(`No plan found for week ${targetWeek}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(list);
      } else {
        displayGroceryList(list);
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
