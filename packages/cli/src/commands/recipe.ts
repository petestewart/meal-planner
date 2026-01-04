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
  type UpdateRecipe,
  type CreateRecipeIngredientInput,
  type ImportOptions,
  type RecipeModification,
  type IngredientOverride,
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
 * Apply ingredient overrides to get the display name
 * If an override exists for this ingredient, return the replacement name
 */
function applyIngredientOverride(
  ingredientName: string,
  overrides: IngredientOverride[]
): { name: string; isOverridden: boolean } {
  const override = overrides.find(
    (o) => o.original.toLowerCase() === ingredientName.toLowerCase()
  );
  if (override) {
    return { name: override.replacement, isOverridden: true };
  }
  return { name: ingredientName, isOverridden: false };
}

/**
 * Display recipe details in a nice terminal format
 */
function displayRecipe(
  recipe: RecipeWithRelations,
  ingredientRepo: IngredientRepository,
  tagRepo: TagRepository,
  modifications?: RecipeModification | null
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

  // Personal notes (if modifications exist)
  if (modifications?.userNotes) {
    console.log('  MY NOTES');
    console.log('  --------');
    console.log(`    ${modifications.userNotes}`);
    console.log('');
  }

  // Ingredients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    console.log('  INGREDIENTS');
    console.log('  -----------');
    const overrides = modifications?.ingredientOverrides ?? [];
    for (const ing of recipe.ingredients) {
      const qty = ing.quantity ? `${ing.quantity}` : '';
      const unit = ing.unit || '';
      const prefix = [qty, unit].filter(Boolean).join(' ');
      const notes = ing.notes ? ` (${ing.notes})` : '';
      const optional = ing.optional ? ' [optional]' : '';
      const originalName = resolveIngredientName(ingredientRepo, ing.ingredientId);
      const { name: displayName, isOverridden } = applyIngredientOverride(originalName, overrides);
      const overrideMarker = isOverridden ? ` [was: ${originalName}]` : '';
      console.log(`    - ${prefix ? prefix + ' ' : ''}${displayName}${notes}${optional}${overrideMarker}`);
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
  .option('-s, --servings <n>', 'Scale recipe to specified number of servings')
  .action((id: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const { recipeService, tagRepo, ingredientRepo } = getServices(globalOpts.db);

      // If servings option is provided, scale the recipe
      let recipe;
      if (options.servings) {
        const targetServings = parseInt(options.servings, 10);
        if (isNaN(targetServings) || targetServings <= 0) {
          printError('Servings must be a positive integer');
          process.exit(1);
        }
        recipe = recipeService.scaleRecipe(id, targetServings);
      } else {
        recipe = recipeService.getRecipe(id);
      }

      if (!recipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      // Fetch modifications for this recipe
      const modifications = recipeService.getModifications(id);

      if (globalOpts.json) {
        // Include modifications in JSON output
        printJson({ ...recipe, modifications });
      } else {
        displayRecipe(recipe, ingredientRepo, tagRepo, modifications);
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

// UPDATE command
recipeCommand
  .command('update <id>')
  .description('Update an existing recipe')
  .option('--title <title>', 'New recipe title')
  .option('--description <text>', 'New recipe description')
  .option('--instructions <text>', 'New recipe instructions')
  .option('--servings <n>', 'New number of servings')
  .option('--prep-time <minutes>', 'New prep time in minutes')
  .option('--cook-time <minutes>', 'New cook time in minutes')
  .option('--cuisine <cuisine>', 'New cuisine type')
  .option('--difficulty <level>', 'New difficulty level (easy, medium, hard)')
  .option('--add-ingredient <ingredient>', 'Add ingredient (format: name:quantity unit) - can be repeated', (val: string, prev: string[] | undefined) => prev ? [...prev, val] : [val])
  .option('--remove-ingredient <name>', 'Remove ingredient by name - can be repeated', (val: string, prev: string[] | undefined) => prev ? [...prev, val] : [val])
  .option('--add-tag <tag>', 'Add tag (creates if not exists) - can be repeated', (val: string, prev: string[] | undefined) => prev ? [...prev, val] : [val])
  .option('--remove-tag <tag>', 'Remove tag by name - can be repeated', (val: string, prev: string[] | undefined) => prev ? [...prev, val] : [val])
  .action((id: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const { recipeService, tagRepo, ingredientRepo } = getServices(globalOpts.db);

      // Check if recipe exists
      const existingRecipe = recipeService.getRecipe(id);
      if (!existingRecipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      // Build update data
      const updateData: UpdateRecipe = { id };

      if (options.title !== undefined) updateData.title = options.title;
      if (options.description !== undefined) updateData.description = options.description;
      if (options.instructions !== undefined) updateData.instructions = options.instructions;
      if (options.servings !== undefined) updateData.servings = parseInt(options.servings, 10);
      if (options.prepTime !== undefined) updateData.prepTimeMinutes = parseInt(options.prepTime, 10);
      if (options.cookTime !== undefined) updateData.cookTimeMinutes = parseInt(options.cookTime, 10);
      if (options.cuisine !== undefined) updateData.cuisine = options.cuisine;
      if (options.difficulty !== undefined) updateData.difficulty = options.difficulty;

      // Handle ingredient changes
      let newIngredients: CreateRecipeIngredientInput[] | undefined;
      const hasIngredientChanges = options.addIngredient || options.removeIngredient;

      if (hasIngredientChanges) {
        // Start with existing ingredients (default to empty array if undefined)
        const existingIngredients = existingRecipe.ingredients ?? [];
        newIngredients = existingIngredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
          optional: ing.optional,
        }));

        // Remove ingredients by name
        if (options.removeIngredient) {
          for (const nameToRemove of options.removeIngredient) {
            const lowerName = nameToRemove.toLowerCase();
            newIngredients = newIngredients.filter((ing) => {
              const ingredient = ingredientRepo.getById(ing.ingredientId);
              return ingredient ? ingredient.name.toLowerCase() !== lowerName : true;
            });
          }
        }

        // Add new ingredients
        if (options.addIngredient) {
          for (const ingredientStr of options.addIngredient) {
            const parsed = parseIngredient(ingredientStr);
            const ingredient = ingredientRepo.getOrCreate(parsed.name);
            newIngredients.push({
              ingredientId: ingredient.id,
              quantity: parsed.quantity,
              unit: parsed.unit,
              notes: parsed.notes,
            });
          }
        }
      }

      // Handle tag changes
      let newTagIds: string[] | undefined;
      const hasTagChanges = options.addTag || options.removeTag;

      if (hasTagChanges) {
        // Start with existing tags (default to empty array if undefined)
        const existingTagIds = existingRecipe.tagIds ?? [];
        newTagIds = [...existingTagIds];

        // Remove tags by name
        if (options.removeTag) {
          for (const tagNameToRemove of options.removeTag) {
            const lowerName = tagNameToRemove.toLowerCase();
            newTagIds = newTagIds.filter((tagId) => {
              const tag = tagRepo.getById(tagId);
              return tag ? tag.name.toLowerCase() !== lowerName : true;
            });
          }
        }

        // Add new tags
        if (options.addTag) {
          const addedTagIds = tagRepo.resolveTagNames(options.addTag);
          for (const tagId of addedTagIds) {
            if (!newTagIds.includes(tagId)) {
              newTagIds.push(tagId);
            }
          }
        }
      }

      // Perform the update
      const updatedRecipe = recipeService.updateRecipe(updateData, newIngredients, newTagIds);

      if (!updatedRecipe) {
        printError('Failed to update recipe');
        process.exit(1);
      }

      if (globalOpts.json) {
        printJson(updatedRecipe);
      } else {
        printSuccess(`Updated recipe: ${updatedRecipe.title} (${updatedRecipe.id})`);
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

// NOTE command - Add/show personal notes for a recipe
recipeCommand
  .command('note <id> [note]')
  .description('Add or show personal notes for a recipe')
  .option('--show', 'Show current notes instead of setting')
  .option('--clear', 'Clear the note')
  .action((id: string, note: string | undefined, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const { recipeService } = getServices(globalOpts.db);

      // Verify recipe exists
      const recipe = recipeService.getRecipe(id);
      if (!recipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      // Show mode
      if (options.show) {
        const modifications = recipeService.getModifications(id);
        if (globalOpts.json) {
          printJson({
            recipeId: id,
            recipeTitle: recipe.title,
            userNotes: modifications?.userNotes ?? null,
          });
        } else {
          if (modifications?.userNotes) {
            console.log('');
            console.log(`  Notes for: ${recipe.title}`);
            console.log('  ' + '-'.repeat(recipe.title.length + 11));
            console.log(`  ${modifications.userNotes}`);
            console.log('');
          } else {
            console.log(`No notes for recipe: ${recipe.title}`);
          }
        }
        return;
      }

      // Clear mode
      if (options.clear) {
        recipeService.setRecipeNote(id, null, 'cli');
        if (globalOpts.json) {
          printJson({ recipeId: id, cleared: true });
        } else {
          printSuccess(`Cleared notes for: ${recipe.title}`);
        }
        return;
      }

      // Set mode - note is required
      if (!note) {
        printError('Note text is required. Use --show to view or --clear to remove.');
        process.exit(1);
      }

      const modification = recipeService.setRecipeNote(id, note, 'cli');

      if (globalOpts.json) {
        printJson(modification);
      } else {
        printSuccess(`Added note to: ${recipe.title}`);
        console.log(`  Note: ${note}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// OVERRIDE command - Add/manage ingredient overrides for a recipe
recipeCommand
  .command('override <id>')
  .description('Add/manage ingredient substitutions for a recipe')
  .option('--ingredient <name>', 'Original ingredient to replace')
  .option('--replace <name>', 'Replacement ingredient')
  .option('--remove <name>', 'Remove an override for the specified ingredient')
  .option('--list', 'List all overrides for this recipe')
  .option('--clear', 'Clear all overrides')
  .action((id: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const { recipeService } = getServices(globalOpts.db);

      // Verify recipe exists
      const recipe = recipeService.getRecipe(id);
      if (!recipe) {
        printError(`Recipe not found: ${id}`);
        process.exit(1);
      }

      // List mode
      if (options.list) {
        const modifications = recipeService.getModifications(id);
        const overrides = modifications?.ingredientOverrides ?? [];

        if (globalOpts.json) {
          printJson({
            recipeId: id,
            recipeTitle: recipe.title,
            ingredientOverrides: overrides,
          });
        } else {
          console.log('');
          console.log(`  Ingredient overrides for: ${recipe.title}`);
          console.log('  ' + '-'.repeat(recipe.title.length + 25));
          if (overrides.length === 0) {
            console.log('  No overrides set.');
          } else {
            for (const override of overrides) {
              console.log(`    ${override.original} -> ${override.replacement}`);
            }
          }
          console.log('');
        }
        return;
      }

      // Clear mode
      if (options.clear) {
        const modifications = recipeService.getModifications(id);
        if (modifications) {
          recipeService.updateModifications(id, {
            userNotes: modifications.userNotes,
            ingredientOverrides: [],
            instructionNotes: modifications.instructionNotes,
          }, 'cli');
        }
        if (globalOpts.json) {
          printJson({ recipeId: id, clearedOverrides: true });
        } else {
          printSuccess(`Cleared all ingredient overrides for: ${recipe.title}`);
        }
        return;
      }

      // Remove mode
      if (options.remove) {
        const modification = recipeService.removeIngredientOverride(id, options.remove, 'cli');
        if (globalOpts.json) {
          printJson(modification ?? { recipeId: id, removed: options.remove });
        } else {
          printSuccess(`Removed override for "${options.remove}" from: ${recipe.title}`);
        }
        return;
      }

      // Add mode - both --ingredient and --replace are required
      if (!options.ingredient || !options.replace) {
        printError('Both --ingredient and --replace are required to add an override.');
        printError('Use --list to view, --remove <name> to remove, or --clear to remove all.');
        process.exit(1);
      }

      const modification = recipeService.addIngredientOverride(
        id,
        options.ingredient,
        options.replace,
        'cli'
      );

      if (globalOpts.json) {
        printJson(modification);
      } else {
        printSuccess(`Added override for: ${recipe.title}`);
        console.log(`  ${options.ingredient} -> ${options.replace}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
