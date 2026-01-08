import { Command } from 'commander';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  SubstitutionService,
  type Substitution,
  DIETARY_TAGS,
} from '@meals/core';
import {
  printJson,
  printSuccess,
  printError,
  getGlobalOptions,
  type GlobalOptions,
} from '../output.js';

/**
 * Initialize database and return a SubstitutionService instance
 */
function getSubstitutionService(dbPath?: string): SubstitutionService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new SubstitutionService(db);
}

/**
 * Format dietary tags for display
 */
function formatDietaryTags(tags: string[]): string {
  if (tags.length === 0) {
    return '';
  }
  return `[${tags.join(', ')}]`;
}

/**
 * Display a single substitution
 */
function displaySubstitution(sub: Substitution): void {
  const tags = formatDietaryTags(sub.dietaryTags);
  const userDefined = sub.isUserDefined ? ' (user-defined)' : '';

  console.log(`  -> ${sub.substituteIngredients}${tags}${userDefined}`);
  if (sub.substituteDescription) {
    console.log(`     ${sub.substituteDescription}`);
  }
}

/**
 * Display substitutions grouped by original ingredient
 */
function displaySubstitutionList(substitutions: Substitution[]): void {
  if (substitutions.length === 0) {
    console.log('No substitutions found.');
    return;
  }

  // Group by original ingredient
  const byIngredient = new Map<string, Substitution[]>();
  for (const sub of substitutions) {
    const key = sub.originalIngredient.toLowerCase();
    if (!byIngredient.has(key)) {
      byIngredient.set(key, []);
    }
    byIngredient.get(key)!.push(sub);
  }

  console.log('');
  console.log('Ingredient Substitutions');
  console.log('='.repeat(40));

  for (const [ingredient, subs] of byIngredient) {
    console.log(`\n${ingredient}:`);
    for (const sub of subs) {
      displaySubstitution(sub);
    }
  }

  console.log('');
}

export const substitutionCommand = new Command('substitution')
  .description('Ingredient substitution commands')
  .action(() => {
    console.log('Substitution commands - use --help to see available subcommands.');
  });

// LIST command - list substitutions for an ingredient
substitutionCommand
  .command('list <ingredient>')
  .description('List substitutions for an ingredient')
  .option('--dietary <tags>', 'Filter by dietary tags (comma-separated)')
  .action((ingredient: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getSubstitutionService(globalOpts.db);

      let substitutions: Substitution[];

      if (options.dietary) {
        const tags = options.dietary.split(',').map((t: string) => t.trim());
        substitutions = service.findSubstitutionsWithDietaryTags(ingredient, tags);
      } else {
        substitutions = service.findSubstitutions(ingredient);
      }

      if (globalOpts.json) {
        printJson(substitutions);
      } else {
        if (substitutions.length === 0) {
          console.log(`\nNo substitutions found for "${ingredient}".\n`);
        } else {
          console.log('');
          console.log(`Substitutions for "${ingredient}"`);
          console.log('='.repeat(40));
          for (const sub of substitutions) {
            displaySubstitution(sub);
          }
          console.log('');
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// ADD command - add a user-defined substitution
substitutionCommand
  .command('add <original> <substitute>')
  .description('Add a user-defined substitution')
  .option('--description <text>', 'Description of how to use the substitution')
  .option('--dietary <tags>', `Dietary tags (comma-separated). Valid: ${DIETARY_TAGS.join(', ')}`)
  .action((original: string, substitute: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getSubstitutionService(globalOpts.db);

      const dietaryTags = options.dietary
        ? options.dietary.split(',').map((t: string) => t.trim())
        : [];

      const substitution = service.addSubstitution({
        originalIngredient: original,
        substituteIngredients: substitute,
        substituteDescription: options.description ?? null,
        dietaryTags,
        isUserDefined: true,
      });

      if (globalOpts.json) {
        printJson(substitution);
      } else {
        printSuccess(`Added substitution: ${original} -> ${substitute}`);
        displaySubstitution(substitution);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// DELETE command - delete a user-defined substitution
substitutionCommand
  .command('delete <id>')
  .description('Delete a user-defined substitution by ID')
  .action((id: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getSubstitutionService(globalOpts.db);

      const deleted = service.deleteSubstitution(id);

      if (!deleted) {
        printError(`Substitution "${id}" not found`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson({ deleted: true, id });
      } else {
        printSuccess(`Deleted substitution "${id}"`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SEARCH command - search for substitutions
substitutionCommand
  .command('search <query>')
  .description('Search for substitutions by ingredient name')
  .action((query: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getSubstitutionService(globalOpts.db);

      const substitutions = service.searchSubstitutions(query);

      if (globalOpts.json) {
        printJson(substitutions);
      } else {
        displaySubstitutionList(substitutions);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// INGREDIENTS command - list all ingredients with substitutions
substitutionCommand
  .command('ingredients')
  .description('List all ingredients that have substitutions available')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getSubstitutionService(globalOpts.db);

      const ingredients = service.getAvailableIngredients();

      if (globalOpts.json) {
        printJson(ingredients);
      } else {
        if (ingredients.length === 0) {
          console.log('\nNo substitutions available.\n');
        } else {
          console.log('');
          console.log('Ingredients with Available Substitutions');
          console.log('='.repeat(40));
          for (const ing of ingredients) {
            console.log(`  - ${ing}`);
          }
          console.log(`\nTotal: ${ingredients.length} ingredients\n`);
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// DIETARY command - find substitutions by dietary tag
substitutionCommand
  .command('dietary <tag>')
  .description(`Find all substitutions with a dietary tag. Valid: ${DIETARY_TAGS.join(', ')}`)
  .action((tag: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getSubstitutionService(globalOpts.db);

      const substitutions = service.findByDietaryTag(tag);

      if (globalOpts.json) {
        printJson(substitutions);
      } else {
        if (substitutions.length === 0) {
          console.log(`\nNo substitutions found with dietary tag "${tag}".\n`);
        } else {
          console.log('');
          console.log(`Substitutions with "${tag}" Tag`);
          console.log('='.repeat(40));
          displaySubstitutionList(substitutions);
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
