import { Command } from 'commander';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  RecipeService,
  type RecipeWithRelations,
  type CreateRecipe,
} from '@meals/core';
import {
  printJson,
  printTable,
  printSuccess,
  printError,
  getGlobalOptions,
  type GlobalOptions,
} from '../output.js';

/**
 * Initialize database and return a RecipeService instance
 */
function getService(dbPath?: string): RecipeService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new RecipeService(db);
}

/**
 * Format prep/cook time for display
 */
function formatTime(prepMinutes: number | null, cookMinutes: number | null): string {
  const parts: string[] = [];
  if (prepMinutes) parts.push(`${prepMinutes}m prep`);
  if (cookMinutes) parts.push(`${cookMinutes}m cook`);
  if (parts.length === 0) return '-';
  return parts.join(', ');
}

/**
 * Format a recipe as markdown
 */
function formatRecipeMarkdown(recipe: RecipeWithRelations): string {
  const lines: string[] = [];

  lines.push(`# ${recipe.title}`);
  lines.push('');

  if (recipe.description) {
    lines.push(recipe.description);
    lines.push('');
  }

  // Metadata
  const meta: string[] = [];
  if (recipe.servings) meta.push(`**Servings:** ${recipe.servings}`);
  if (recipe.prepTimeMinutes) meta.push(`**Prep Time:** ${recipe.prepTimeMinutes} minutes`);
  if (recipe.cookTimeMinutes) meta.push(`**Cook Time:** ${recipe.cookTimeMinutes} minutes`);
  if (recipe.cuisine) meta.push(`**Cuisine:** ${recipe.cuisine}`);
  if (recipe.difficulty) meta.push(`**Difficulty:** ${recipe.difficulty}`);

  if (meta.length > 0) {
    lines.push(meta.join(' | '));
    lines.push('');
  }

  // Ingredients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    lines.push('## Ingredients');
    lines.push('');
    for (const ing of recipe.ingredients) {
      const qty = ing.quantity ? `${ing.quantity}` : '';
      const unit = ing.unit || '';
      const prefix = [qty, unit].filter(Boolean).join(' ');
      const notes = ing.notes ? ` (${ing.notes})` : '';
      const optional = ing.optional ? ' [optional]' : '';
      lines.push(`- ${prefix ? prefix + ' ' : ''}${ing.ingredientId}${notes}${optional}`);
    }
    lines.push('');
  }

  // Instructions
  lines.push('## Instructions');
  lines.push('');
  lines.push(recipe.instructions);
  lines.push('');

  // Tags
  if (recipe.tagIds && recipe.tagIds.length > 0) {
    lines.push('---');
    lines.push(`Tags: ${recipe.tagIds.join(', ')}`);
    lines.push('');
  }

  // Source
  if (recipe.sourceUrl) {
    lines.push(`Source: ${recipe.sourceUrl}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Display recipe details in a nice terminal format
 */
function displayRecipe(recipe: RecipeWithRelations): void {
  console.log('');
  console.log(`  ${recipe.title}`);
  console.log('  ' + '='.repeat(recipe.title.length));
  console.log('');

  if (recipe.description) {
    console.log(`  ${recipe.description}`);
    console.log('');
  }

  // Metadata line
  const meta: string[] = [];
  if (recipe.servings) meta.push(`Servings: ${recipe.servings}`);
  if (recipe.prepTimeMinutes) meta.push(`Prep: ${recipe.prepTimeMinutes}m`);
  if (recipe.cookTimeMinutes) meta.push(`Cook: ${recipe.cookTimeMinutes}m`);
  if (recipe.cuisine) meta.push(`Cuisine: ${recipe.cuisine}`);
  if (recipe.difficulty) meta.push(`Difficulty: ${recipe.difficulty}`);

  if (meta.length > 0) {
    console.log(`  ${meta.join(' | ')}`);
    console.log('');
  }

  // Ingredients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    console.log('  INGREDIENTS');
    console.log('  -----------');
    for (const ing of recipe.ingredients) {
      const qty = ing.quantity ? `${ing.quantity}` : '';
      const unit = ing.unit || '';
      const prefix = [qty, unit].filter(Boolean).join(' ');
      const notes = ing.notes ? ` (${ing.notes})` : '';
      const optional = ing.optional ? ' [optional]' : '';
      console.log(`    - ${prefix ? prefix + ' ' : ''}${ing.ingredientId}${notes}${optional}`);
    }
    console.log('');
  }

  // Instructions
  console.log('  INSTRUCTIONS');
  console.log('  ------------');
  // Indent each line of instructions
  const instructionLines = recipe.instructions.split('\n');
  for (const line of instructionLines) {
    console.log(`    ${line}`);
  }
  console.log('');

  // Tags
  if (recipe.tagIds && recipe.tagIds.length > 0) {
    console.log(`  Tags: ${recipe.tagIds.join(', ')}`);
    console.log('');
  }

  // Source
  if (recipe.sourceUrl) {
    console.log(`  Source: ${recipe.sourceUrl}`);
    console.log('');
  }

  console.log(`  ID: ${recipe.id}`);
  console.log('');
}

/**
 * Parse ingredient string in format "name:quantity unit" or "name:quantity:unit"
 * Examples:
 *   "pasta:400g" -> { ingredientId: "pasta", quantity: 400, unit: "g" }
 *   "olive oil:2 tbsp" -> { ingredientId: "olive oil", quantity: 2, unit: "tbsp" }
 *   "salt::" -> { ingredientId: "salt", quantity: null, unit: null }
 */
function parseIngredient(input: string): { ingredientId: string; quantity: number | null; unit: string | null; notes: string | null } {
  const parts = input.split(':');
  const ingredientId = parts[0]?.trim() || '';

  if (parts.length === 1) {
    return { ingredientId, quantity: null, unit: null, notes: null };
  }

  const quantityPart = parts[1]?.trim() || '';

  // Try to parse "400g" or "2 tbsp" or just "2"
  const match = quantityPart.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match) {
    const quantity = parseFloat(match[1]);
    const unit = match[2]?.trim() || (parts[2]?.trim() || null);
    return { ingredientId, quantity, unit: unit || null, notes: null };
  }

  // If no number found, treat the whole thing as unit
  return { ingredientId, quantity: null, unit: quantityPart || null, notes: null };
}

/**
 * Prompt for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export const recipeCommand = new Command('recipe')
  .description('Recipe management')
  .action(() => {
    console.log('Recipe commands - use --help to see available subcommands.');
  });

// LIST command
recipeCommand
  .command('list')
  .description('List/search recipes')
  .option('-q, --query <text>', 'Search query')
  .option('-t, --tag <tag>', 'Filter by tag (can be repeated)', (val: string, prev: string[] | undefined) => prev ? [...prev, val] : [val])
  .option('--cuisine <cuisine>', 'Filter by cuisine')
  .option('-l, --limit <n>', 'Limit results', '20')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getService(globalOpts.db);

      const recipes = service.listRecipes({
        search: options.query,
        tagIds: options.tag,
        cuisine: options.cuisine,
        limit: parseInt(options.limit, 10),
      });

      if (globalOpts.json) {
        printJson(recipes);
      } else {
        if (recipes.length === 0) {
          console.log('No recipes found.');
          return;
        }

        printTable(
          recipes.map((r) => ({
            id: r.id.slice(0, 8) + '...',
            title: r.title,
            time: formatTime(r.prepTimeMinutes, r.cookTimeMinutes),
            cuisine: r.cuisine || '-',
          })),
          [
            { key: 'id', header: 'ID', width: 12 },
            { key: 'title', header: 'TITLE', width: 30 },
            { key: 'time', header: 'TIME', width: 20 },
            { key: 'cuisine', header: 'CUISINE', width: 15 },
          ]
        );

        console.log(`\nShowing ${recipes.length} recipe(s).`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SHOW command
recipeCommand
  .command('show <id>')
  .description('Show recipe details')
  .action((id: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getService(globalOpts.db);
      const recipe = service.getRecipe(id);

      if (!recipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(recipe);
      } else {
        displayRecipe(recipe);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// ADD command
recipeCommand
  .command('add')
  .description('Add a recipe manually')
  .requiredOption('--title <title>', 'Recipe title')
  .requiredOption('--instructions <text>', 'Recipe instructions')
  .option('--ingredient <ingredient>', 'Ingredient (format: name:quantity unit) - can be repeated', (val: string, prev: string[] | undefined) => prev ? [...prev, val] : [val])
  .option('--tag <tag>', 'Tag ID - can be repeated', (val: string, prev: string[] | undefined) => prev ? [...prev, val] : [val])
  .option('--cuisine <cuisine>', 'Cuisine type')
  .option('--servings <n>', 'Number of servings', '4')
  .option('--prep-time <minutes>', 'Prep time in minutes')
  .option('--cook-time <minutes>', 'Cook time in minutes')
  .option('--description <text>', 'Recipe description')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getService(globalOpts.db);

      // Build recipe data
      const recipeData: CreateRecipe = {
        title: options.title,
        instructions: options.instructions,
        description: options.description || null,
        servings: parseInt(options.servings, 10),
        prepTimeMinutes: options.prepTime ? parseInt(options.prepTime, 10) : null,
        cookTimeMinutes: options.cookTime ? parseInt(options.cookTime, 10) : null,
        cuisine: options.cuisine || null,
        sourceType: 'manual',
        sourceUrl: null,
        difficulty: null,
      };

      // Parse ingredients
      const ingredients = options.ingredient
        ? options.ingredient.map(parseIngredient)
        : undefined;

      // Create recipe
      const recipe = service.createRecipe(recipeData, ingredients, options.tag);

      if (globalOpts.json) {
        printJson(recipe);
      } else {
        printSuccess(`Created recipe: ${recipe.title} (${recipe.id})`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// DELETE command
recipeCommand
  .command('delete <id>')
  .description('Delete a recipe')
  .option('-f, --force', 'Skip confirmation')
  .action(async (id: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getService(globalOpts.db);

      // Check if recipe exists
      const recipe = service.getRecipe(id);
      if (!recipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      // Confirm deletion unless --force is used
      if (!options.force) {
        const confirmed = await confirm(`Delete recipe "${recipe.title}"?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      const deleted = service.deleteRecipe(id);

      if (deleted) {
        if (globalOpts.json) {
          printJson({ deleted: true, id, title: recipe.title });
        } else {
          printSuccess(`Deleted recipe: ${recipe.title}`);
        }
      } else {
        printError('Failed to delete recipe');
        process.exit(1);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// EXPORT command
recipeCommand
  .command('export <id>')
  .description('Export recipe to markdown')
  .option('-o, --output <file>', 'Output file path')
  .action((id: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getService(globalOpts.db);
      const recipe = service.getRecipe(id);

      if (!recipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      const markdown = formatRecipeMarkdown(recipe);

      if (options.output) {
        fs.writeFileSync(options.output, markdown, 'utf-8');
        if (!globalOpts.json) {
          printSuccess(`Exported recipe to: ${options.output}`);
        } else {
          printJson({ exported: true, file: options.output });
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

// Import command (placeholder - not in scope for this ticket)
recipeCommand
  .command('import <url>')
  .description('Import recipe from URL')
  .option('--no-normalize', 'Skip ingredient normalization')
  .action((url: string) => {
    console.log(`Not implemented yet: recipe import ${url}`);
  });
