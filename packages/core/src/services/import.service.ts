/**
 * Recipe Import Service
 *
 * Imports recipes from URLs by parsing schema.org JSON-LD Recipe data.
 * Falls back to Open Graph meta tags if no JSON-LD is found.
 */

import * as cheerio from 'cheerio';
import type { Database } from 'better-sqlite3';
import type { CreateRecipe, Recipe } from '../models/index.js';
import { RecipeService } from './recipe.service.js';

/**
 * Input structure for creating a recipe from imported data.
 * Similar to CreateRecipe but with raw ingredient strings.
 */
export interface ImportedRecipeData {
  title: string;
  description: string | null;
  instructions: string;
  ingredients: string[];
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  sourceUrl: string;
}

/**
 * Result of parsing a recipe from a URL.
 */
export interface ImportResult {
  success: boolean;
  recipe?: ImportedRecipeData;
  error?: string;
}

/**
 * Result of importing and saving a recipe.
 */
export interface SaveImportResult {
  success: boolean;
  recipe?: Recipe;
  error?: string;
}

/**
 * Schema.org Recipe JSON-LD structure (simplified).
 */
interface SchemaRecipe {
  '@type'?: string | string[];
  '@graph'?: SchemaRecipe[];
  name?: string;
  description?: string;
  recipeIngredient?: string[];
  recipeInstructions?: string | (string | SchemaInstruction)[] | SchemaInstruction;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number | string[];
  image?: string | string[] | { url?: string };
}

interface SchemaInstruction {
  '@type'?: string;
  text?: string;
  name?: string;
  itemListElement?: SchemaInstruction[];
}

// Maximum size of HTML to fetch (5MB)
const MAX_FETCH_SIZE = 5 * 1024 * 1024;

// Default User-Agent for fetching
const USER_AGENT = 'Mozilla/5.0 (compatible; MealPlannerBot/1.0; +https://github.com/meal-planner)';

/**
 * Parse ISO 8601 duration (e.g., PT15M, PT1H30M) to minutes.
 */
function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;

  // Match ISO 8601 duration format: PT[H]H[M]M[S]S
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return null;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 60 + minutes + Math.round(seconds / 60);
}

/**
 * Parse recipe yield to a number of servings.
 */
function parseServings(recipeYield: string | number | string[] | undefined): number {
  if (!recipeYield) return 4;

  if (typeof recipeYield === 'number') {
    return recipeYield > 0 ? recipeYield : 4;
  }

  // Handle array - take first value
  if (Array.isArray(recipeYield)) {
    recipeYield = recipeYield[0];
    if (typeof recipeYield === 'number') {
      return recipeYield > 0 ? recipeYield : 4;
    }
  }

  if (typeof recipeYield === 'string') {
    // Try to extract a number from the string
    const match = recipeYield.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      return num > 0 ? num : 4;
    }
  }

  return 4;
}

/**
 * Extract plain text instructions from schema.org recipeInstructions.
 * Instructions can be a string, single object, or array of strings/objects.
 */
function parseInstructions(
  instructions: string | (string | SchemaInstruction)[] | SchemaInstruction | undefined
): string {
  if (!instructions) return '';

  // Simple string
  if (typeof instructions === 'string') {
    return instructions.trim();
  }

  // Single instruction object
  if (!Array.isArray(instructions)) {
    if (instructions.text) return instructions.text.trim();
    if (instructions.name) return instructions.name.trim();
    return '';
  }

  // Array of instructions (can be strings or objects)
  const steps: string[] = [];
  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i];

    // Handle string instruction
    if (typeof instruction === 'string') {
      steps.push(instruction.trim());
      continue;
    }

    // Handle HowToSection with nested steps
    if (instruction.itemListElement && Array.isArray(instruction.itemListElement)) {
      for (const step of instruction.itemListElement) {
        if (step.text) {
          steps.push(step.text.trim());
        } else if (step.name) {
          steps.push(step.name.trim());
        }
      }
    } else if (instruction.text) {
      steps.push(instruction.text.trim());
    } else if (instruction.name) {
      steps.push(instruction.name.trim());
    }
  }

  // Format as numbered steps
  return steps
    .filter((s) => s.length > 0)
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
}

/**
 * Find Recipe in JSON-LD data, handling @graph arrays.
 */
function findRecipeInJsonLd(data: unknown): SchemaRecipe | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as SchemaRecipe;

  // Check if this is a Recipe
  const type = obj['@type'];
  if (type) {
    const types = Array.isArray(type) ? type : [type];
    if (types.includes('Recipe')) {
      return obj;
    }
  }

  // Check @graph array
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) return recipe;
    }
  }

  return null;
}

export class ImportService {
  private recipeService: RecipeService | null;

  /**
   * Create an ImportService.
   * @param db Optional database connection for saving imported recipes.
   *           If not provided, only parsing is available.
   */
  constructor(db?: Database) {
    this.recipeService = db ? new RecipeService(db) : null;
  }

  /**
   * Fetch HTML from a URL with proper error handling and size limits.
   */
  private async fetchHtml(url: string): Promise<string> {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }

    // Fetch with timeout and size limit
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        throw new Error('URL does not return HTML content');
      }

      // Check content length if available
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_FETCH_SIZE) {
        throw new Error('Response too large');
      }

      // Read with size limit
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalSize += value.length;
        if (totalSize > MAX_FETCH_SIZE) {
          reader.cancel();
          throw new Error('Response too large');
        }

        chunks.push(value);
      }

      const decoder = new TextDecoder('utf-8');
      return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('');
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Extract JSON-LD Recipe data from HTML.
   */
  private extractJsonLdRecipe(html: string): SchemaRecipe | null {
    const $ = cheerio.load(html);
    const scripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < scripts.length; i++) {
      const content = $(scripts[i]).html();
      if (!content) continue;

      try {
        const data = JSON.parse(content);

        // Handle array of objects
        if (Array.isArray(data)) {
          for (const item of data) {
            const recipe = findRecipeInJsonLd(item);
            if (recipe) return recipe;
          }
        } else {
          const recipe = findRecipeInJsonLd(data);
          if (recipe) return recipe;
        }
      } catch {
        // Invalid JSON, skip this script
        continue;
      }
    }

    return null;
  }

  /**
   * Extract recipe data from Open Graph meta tags as fallback.
   */
  private extractOpenGraphRecipe(html: string, url: string): ImportedRecipeData | null {
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') || $('title').text().trim();

    if (!title) return null;

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;

    // Without JSON-LD, we can't reliably extract ingredients and instructions
    // Return a minimal recipe that user will need to complete
    return {
      title,
      description,
      instructions: 'Instructions not available - please visit the source URL.',
      ingredients: [],
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      sourceUrl: url,
    };
  }

  /**
   * Parse a URL and extract recipe data without saving.
   */
  async parseRecipeFromUrl(url: string): Promise<ImportResult> {
    try {
      const html = await this.fetchHtml(url);

      // Try JSON-LD first
      const jsonLdRecipe = this.extractJsonLdRecipe(html);
      if (jsonLdRecipe) {
        // Validate required fields
        if (!jsonLdRecipe.name) {
          return { success: false, error: 'Recipe name not found in JSON-LD' };
        }

        const instructions = parseInstructions(jsonLdRecipe.recipeInstructions);
        if (!instructions) {
          return { success: false, error: 'Recipe instructions not found in JSON-LD' };
        }

        const recipe: ImportedRecipeData = {
          title: jsonLdRecipe.name,
          description: jsonLdRecipe.description?.trim() || null,
          instructions,
          ingredients: jsonLdRecipe.recipeIngredient || [],
          servings: parseServings(jsonLdRecipe.recipeYield),
          prepTimeMinutes: parseDuration(jsonLdRecipe.prepTime),
          cookTimeMinutes: parseDuration(jsonLdRecipe.cookTime),
          sourceUrl: url,
        };

        return { success: true, recipe };
      }

      // Fall back to Open Graph
      const ogRecipe = this.extractOpenGraphRecipe(html, url);
      if (ogRecipe) {
        return { success: true, recipe: ogRecipe };
      }

      return { success: false, error: 'No recipe data found on page' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to import recipe: ${message}` };
    }
  }

  /**
   * Parse a URL and save the recipe to the database.
   */
  async importRecipeFromUrl(
    url: string,
    actor?: string
  ): Promise<SaveImportResult> {
    if (!this.recipeService) {
      return { success: false, error: 'Database not available - cannot save recipe' };
    }

    const parseResult = await this.parseRecipeFromUrl(url);
    if (!parseResult.success || !parseResult.recipe) {
      return { success: false, error: parseResult.error };
    }

    const imported = parseResult.recipe;

    // Convert to CreateRecipe format
    const createRecipe: CreateRecipe = {
      title: imported.title,
      description: imported.description,
      instructions: imported.instructions,
      servings: imported.servings,
      prepTimeMinutes: imported.prepTimeMinutes,
      cookTimeMinutes: imported.cookTimeMinutes,
      sourceUrl: imported.sourceUrl,
      sourceType: 'imported',
      cuisine: null,
      difficulty: null,
    };

    try {
      // Note: We're not creating ingredients as structured data here.
      // The raw ingredient strings are available in imported.ingredients
      // but would need ingredient matching/creation logic to link them.
      const recipe = this.recipeService.createRecipe(
        createRecipe,
        undefined, // No structured ingredients
        undefined, // No tags
        actor || 'import'
      );

      return { success: true, recipe };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: `Failed to save recipe: ${message}` };
    }
  }
}
