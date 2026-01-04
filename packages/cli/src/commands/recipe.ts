import { Command } from 'commander';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  RecipeService,
  ImportService,
  TagRepository,
  IngredientRepository,
  type RecipeWithRelations,
  type CreateRecipe,
  type CreateRecipeIngredientInput,
  type ImportOptions,
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
 * Initialize database and return a RecipeService instance along with TagRepository and IngredientRepository
 */
function getServices(dbPath?: string): { recipeService: RecipeService; tagRepo: TagRepository; ingredientRepo: IngredientRepository } {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return {
    recipeService: new RecipeService(db),
    tagRepo: new TagRepository(db),
    ingredientRepo: new IngredientRepository(db),
  };
}

/**
 * Initialize database and return a RecipeService instance
 * @deprecated Use getServices() instead for operations that need tag resolution
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
 * Resolve ingredient ID to name using the ingredient repository
 */
function resolveIngredientName(ingredientRepo: IngredientRepository, ingredientId: string): string {
  const ingredient = ingredientRepo.getById(ingredientId);
  return ingredient ? ingredient.name : ingredientId;
}

/**
 * Resolve tag IDs to names using the tag repository
 */
function resolveTagNames(tagRepo: TagRepository, tagIds: string[]): string[] {
  return tagIds.map((tagId) => {
    const tag = tagRepo.getById(tagId);
    return tag ? tag.name : tagId;
  });
}

/**
 * Format a recipe as markdown
 */
function formatRecipeMarkdown(
  recipe: RecipeWithRelations,
  ingredientRepo: IngredientRepository,
  tagRepo: TagRepository
): string {
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
      const ingredientName = resolveIngredientName(ingredientRepo, ing.ingredientId);
      lines.push(`- ${prefix ? prefix + ' ' : ''}${ingredientName}${notes}${optional}`);
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
    const tagNames = resolveTagNames(tagRepo, recipe.tagIds);
    lines.push('---');
    lines.push(`Tags: ${tagNames.join(', ')}`);
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
function displayRecipe(
  recipe: RecipeWithRelations,
  ingredientRepo: IngredientRepository,
  tagRepo: TagRepository
): void {
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
      const ingredientName = resolveIngredientName(ingredientRepo, ing.ingredientId);
      console.log(`    - ${prefix ? prefix + ' ' : ''}${ingredientName}${notes}${optional}`);
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
    const tagNames = resolveTagNames(tagRepo, recipe.tagIds);
    console.log(`  Tags: ${tagNames.join(', ')}`);
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

/** Parsed ingredient data from CLI input (name is not yet resolved to ID) */
interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

/**
 * Parse ingredient string in format "name:quantity unit" or "name:quantity:unit"
 * Examples:
 *   "pasta:400g" -> { name: "pasta", quantity: 400, unit: "g" }
 *   "olive oil:2 tbsp" -> { name: "olive oil", quantity: 2, unit: "tbsp" }
 *   "salt::" -> { name: "salt", quantity: null, unit: null }
 */
function parseIngredient(input: string): ParsedIngredient {
  const parts = input.split(':');
  const name = parts[0]?.trim() || '';

  if (parts.length === 1) {
    return { name, quantity: null, unit: null, notes: null };
  }

  const quantityPart = parts[1]?.trim() || '';

  // Try to parse "400g" or "2 tbsp" or just "2"
  const match = quantityPart.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match) {
    const quantity = parseFloat(match[1]);
    const unit = match[2]?.trim() || (parts[2]?.trim() || null);
    return { name, quantity, unit: unit || null, notes: null };
  }

  // If no number found, treat the whole thing as unit
  return { name, quantity: null, unit: quantityPart || null, notes: null };
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
      const { recipeService, tagRepo } = getServices(globalOpts.db);

      // Resolve tag names to IDs for filtering
      let tagIds: string[] | undefined;
      if (options.tag && options.tag.length > 0) {
        tagIds = [];
        for (const tagName of options.tag) {
          const tag = tagRepo.getByName(tagName);
          if (tag) {
            tagIds.push(tag.id);
          } else {
            // Tag doesn't exist, so no recipes can match this filter
            // Return empty results immediately
            if (globalOpts.json) {
              printJson([]);
            } else {
              console.log('No recipes found.');
            }
            return;
          }
        }
      }

      const recipes = recipeService.listRecipes({
        search: options.query,
        tagIds,
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
            id: r.id,
            title: r.title,
            time: formatTime(r.prepTimeMinutes, r.cookTimeMinutes),
            cuisine: r.cuisine || '-',
          })),
          [
            { key: 'id', header: 'ID', width: 36 },
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
      const { recipeService, tagRepo, ingredientRepo } = getServices(globalOpts.db);
      const recipe = recipeService.getRecipe(id);

      if (!recipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(recipe);
      } else {
        displayRecipe(recipe, ingredientRepo, tagRepo);
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
  .option('--tag <tag>', 'Tag name (creates if not exists) - can be repeated', (val: string, prev: string[] | undefined) => prev ? [...prev, val] : [val])
  .option('--cuisine <cuisine>', 'Cuisine type')
  .option('--servings <n>', 'Number of servings', '4')
  .option('--prep-time <minutes>', 'Prep time in minutes')
  .option('--cook-time <minutes>', 'Cook time in minutes')
  .option('--description <text>', 'Recipe description')
  .option('--difficulty <level>', 'Difficulty level (easy, medium, hard)')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const { recipeService, tagRepo, ingredientRepo } = getServices(globalOpts.db);

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
        difficulty: options.difficulty || null,
      };

      // Parse and resolve ingredients (creates ingredients if they don't exist)
      let ingredients: CreateRecipeIngredientInput[] | undefined;
      if (options.ingredient) {
        const parsedIngredients = options.ingredient.map(parseIngredient);
        ingredients = parsedIngredients.map((parsed: ParsedIngredient): CreateRecipeIngredientInput => {
          const ingredient = ingredientRepo.getOrCreate(parsed.name);
          return {
            ingredientId: ingredient.id,
            quantity: parsed.quantity,
            unit: parsed.unit,
            notes: parsed.notes,
          };
        });
      }

      // Resolve tag names to IDs (creates tags if they don't exist)
      const tagIds = options.tag
        ? tagRepo.resolveTagNames(options.tag)
        : undefined;

      // Create recipe
      const recipe = recipeService.createRecipe(recipeData, ingredients, tagIds);

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
      const { recipeService, tagRepo, ingredientRepo } = getServices(globalOpts.db);
      const recipe = recipeService.getRecipe(id);

      if (!recipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      const markdown = formatRecipeMarkdown(recipe, ingredientRepo, tagRepo);

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

// IMPORT command
recipeCommand
  .command('import <url>')
  .description('Import recipe from URL (supports sites with schema.org JSON-LD)')
  .option('--no-browser', 'Disable headless browser fallback for blocked sites')
  .action(async (url: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const db = getDb({ dbPath: globalOpts.db });
      migrate(db, getDefaultMigrationsDir());
      const importService = new ImportService(db);

      // Build import options from CLI flags
      const importOptions: ImportOptions = {
        noBrowser: options.browser === false, // commander inverts --no-browser to browser: false
      };

      if (!globalOpts.json) {
        console.log(`Importing recipe from: ${url}`);
        if (importOptions.noBrowser) {
          console.log('(headless browser fallback disabled)');
        }
        console.log('');
      }

      const result = await importService.importRecipeFromUrl(url, undefined, importOptions);

      if (!result.success || !result.recipe) {
        printError(result.error || 'Failed to import recipe');
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(result.recipe);
      } else {
        printSuccess(`Imported: ${result.recipe.title}`);
        console.log(`  ID: ${result.recipe.id}`);
        if (result.recipe.servings) {
          console.log(`  Servings: ${result.recipe.servings}`);
        }
        if (result.recipe.prepTimeMinutes) {
          console.log(`  Prep time: ${result.recipe.prepTimeMinutes} min`);
        }
        if (result.recipe.cookTimeMinutes) {
          console.log(`  Cook time: ${result.recipe.cookTimeMinutes} min`);
        }
        console.log('');
        console.log(`Use "meals recipe show ${result.recipe.id}" to view full details.`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
