#!/usr/bin/env node
import { Command } from 'commander';
import { version } from '../index.js';
import { recipeCommand } from '../commands/recipe.js';
import { planCommand } from '../commands/plan.js';
import { groceryCommand } from '../commands/grocery.js';
import { prefsCommand } from '../commands/prefs.js';
import { dbCommand } from '../commands/db.js';

const program = new Command();

program
  .name('meals')
  .description('Meal planning CLI - manage recipes, weekly plans, and grocery lists')
  .version(version)
  .option('--json', 'Output as JSON instead of human-readable')
  .option('--quiet', 'Suppress non-essential output')
  .option('--verbose', 'Show debug information')
  .option('--db <path>', 'Use alternate database file');

// Add subcommands
program.addCommand(recipeCommand);
program.addCommand(planCommand);
program.addCommand(groceryCommand);
program.addCommand(prefsCommand);
program.addCommand(dbCommand);

program.parse();
