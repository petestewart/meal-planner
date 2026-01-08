import { Command } from 'commander';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  IngredientRepository,
  INGREDIENT_CATEGORIES,
  isValidCategory,
  STORE_SECTIONS,
  isValidStoreSection,
  type IngredientCategory,
  type StoreSection,
} from '@meals/core';
import {
  printJson,
  printSuccess,
  printError,
  getGlobalOptions,
  type GlobalOptions,
} from '../output.js';

/**
 * Initialize database and return an IngredientRepository instance
 */
function getIngredientRepo(dbPath?: string): IngredientRepository {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new IngredientRepository(db);
}

export const ingredientCommand = new Command('ingredient')
  .description('Ingredient management commands')
  .action(() => {
    console.log('Ingredient commands - use --help to see available subcommands.');
  });

// SET-CATEGORY command
ingredientCommand
  .command('set-category <name> <category>')
  .description(`Set the category for an ingredient. Valid categories: ${INGREDIENT_CATEGORIES.join(', ')}`)
  .action((name: string, category: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const ingredientRepo = getIngredientRepo(globalOpts.db);

      // Validate category
      if (!isValidCategory(category)) {
        printError(
          `Invalid category "${category}". Valid categories are: ${INGREDIENT_CATEGORIES.join(', ')}`
        );
        process.exit(1);
      }

      // First check if ingredient exists
      const existing = ingredientRepo.getByName(name);
      if (!existing) {
        printError(`Ingredient "${name}" not found. Create it first by using it in a recipe.`);
        process.exit(1);
      }

      // Update the category
      const updated = ingredientRepo.updateCategoryByName(name, category);

      if (!updated) {
        printError(`Failed to update category for ingredient "${name}"`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(updated);
      } else {
        printSuccess(`Set category for "${updated.name}" to "${category}"`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SET-SECTION command
ingredientCommand
  .command('set-section <name> <section>')
  .description(`Set the store section for an ingredient. Valid sections: ${STORE_SECTIONS.join(', ')}`)
  .action((name: string, section: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const ingredientRepo = getIngredientRepo(globalOpts.db);

      // Validate section (case-insensitive)
      const lowerSection = section.toLowerCase();
      if (!isValidStoreSection(lowerSection)) {
        printError(
          `Invalid section "${section}". Valid sections are: ${STORE_SECTIONS.join(', ')}`
        );
        process.exit(1);
      }

      // First check if ingredient exists
      const existing = ingredientRepo.getByName(name);
      if (!existing) {
        printError(`Ingredient "${name}" not found. Create it first by using it in a recipe.`);
        process.exit(1);
      }

      // Update the store section
      const updated = ingredientRepo.updateStoreSectionByName(name, lowerSection as StoreSection);

      if (!updated) {
        printError(`Failed to update store section for ingredient "${name}"`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(updated);
      } else {
        printSuccess(`Set store section for "${updated.name}" to "${lowerSection}"`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// LIST command
ingredientCommand
  .command('list')
  .description('List all ingredients')
  .option('--category <category>', 'Filter by category')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const ingredientRepo = getIngredientRepo(globalOpts.db);

      // Validate category if provided
      if (options.category && !isValidCategory(options.category)) {
        printError(
          `Invalid category "${options.category}". Valid categories are: ${INGREDIENT_CATEGORIES.join(', ')}`
        );
        process.exit(1);
      }

      const ingredients = ingredientRepo.list(options.category);

      if (globalOpts.json) {
        printJson(ingredients);
      } else {
        if (ingredients.length === 0) {
          console.log('No ingredients found.');
        } else {
          console.log('');
          console.log('Ingredients:');
          console.log('='.repeat(40));

          // Group by category for display
          const byCategory = new Map<string, typeof ingredients>();
          for (const ing of ingredients) {
            const cat = ing.category || 'Uncategorized';
            if (!byCategory.has(cat)) {
              byCategory.set(cat, []);
            }
            byCategory.get(cat)!.push(ing);
          }

          // Sort categories alphabetically with Uncategorized last
          const sortedCategories = Array.from(byCategory.keys()).sort((a, b) => {
            if (a === 'Uncategorized') return 1;
            if (b === 'Uncategorized') return -1;
            return a.localeCompare(b);
          });

          for (const cat of sortedCategories) {
            console.log(`\n## ${cat}`);
            for (const ing of byCategory.get(cat)!) {
              const unit = ing.defaultUnit ? ` (${ing.defaultUnit})` : '';
              console.log(`  - ${ing.name}${unit}`);
            }
          }
          console.log('');
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// CATEGORIES command
ingredientCommand
  .command('categories')
  .description('List valid ingredient categories')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    if (globalOpts.json) {
      printJson(INGREDIENT_CATEGORIES);
    } else {
      console.log('');
      console.log('Valid ingredient categories:');
      console.log('='.repeat(30));
      for (const cat of INGREDIENT_CATEGORIES) {
        console.log(`  - ${cat}`);
      }
      console.log('');
    }
  });

// SECTIONS command
ingredientCommand
  .command('sections')
  .description('List valid store sections')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    if (globalOpts.json) {
      printJson(STORE_SECTIONS);
    } else {
      console.log('');
      console.log('Valid store sections:');
      console.log('='.repeat(30));
      for (const section of STORE_SECTIONS) {
        console.log(`  - ${section}`);
      }
      console.log('');
    }
  });
