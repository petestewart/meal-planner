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
import { IngredientRepository } from '../repos/ingredient.repo.js';
import type { CreateRecipeIngredientInput } from '../repos/recipe.repo.js';

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

// Browser-like User-Agent for fetching (helps avoid some basic bot blocking)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// HTTP status codes that indicate blocking/protection
const BLOCKING_STATUS_CODES = [403, 503, 429];

// Content patterns that indicate blocking (Cloudflare, etc.)
const BLOCKING_PATTERNS = [
  'cf-browser-verification',
  'cloudflare',
  'just a moment',
  'checking your browser',
  'please enable javascript',
  'ray id:',
];

/**
 * Options for the import service fetch behavior.
 */
export interface ImportOptions {
  /** Disable headless browser fallback */
  noBrowser?: boolean;
}

/**
 * Check if playwright is available (optional dependency).
 */
async function getPlaywright(): Promise<typeof import('playwright') | null> {
  try {
    // Dynamic import to lazy-load playwright
    const playwright = await import('playwright');
    return playwright;
  } catch {
    return null;
  }
}

/**
 * Detect if HTML content indicates bot blocking/protection.
 */
function isBlockingResponse(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  return BLOCKING_PATTERNS.some(pattern => lowerHtml.includes(pattern));
}

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

/**
 * Parse a raw ingredient string into components.
 * Handles formats like:
 *   "1 cup flour"
 *   "2 tablespoons olive oil"
 *   "1/2 teaspoon salt"
 *   "3 large eggs"
 *   "salt and pepper to taste"
 */
function parseIngredientString(raw: string): { name: string; quantity: number | null; unit: string | null } {
  const trimmed = raw.trim();

  // Common units to look for
  const units = [
    'cups?', 'tablespoons?', 'tbsp', 'teaspoons?', 'tsp',
    'ounces?', 'oz', 'pounds?', 'lbs?', 'grams?', 'g',
    'kilograms?', 'kg', 'milliliters?', 'ml', 'liters?', 'l',
    'pinch(?:es)?', 'dash(?:es)?', 'cloves?', 'slices?', 'pieces?',
    'cans?', 'packages?', 'bunche?s?', 'heads?', 'stalks?',
    'sprigs?', 'leaves?', 'whole', 'large', 'medium', 'small',
  ];
  const unitPattern = units.join('|');

  // Pattern: optional quantity (number, fraction, or range) + optional unit + ingredient name
  // Examples: "1 cup flour", "1/2 tsp salt", "2-3 cloves garlic", "salt to taste"
  const pattern = new RegExp(
    `^([\\d\\/\\-\\.\\s]+)?\\s*(${unitPattern})?\\s*(.+)$`,
    'i'
  );

  const match = trimmed.match(pattern);

  if (!match) {
    return { name: trimmed, quantity: null, unit: null };
  }

  const [, quantityStr, unit, name] = match;

  // Parse quantity (handle fractions like "1/2", ranges like "2-3")
  let quantity: number | null = null;
  if (quantityStr) {
    const cleanQty = quantityStr.trim();
    if (cleanQty.includes('/')) {
      // Handle fractions like "1/2" or "1 1/2"
      const parts = cleanQty.split(/\s+/);
      let total = 0;
      for (const part of parts) {
        if (part.includes('/')) {
          const [num, denom] = part.split('/');
          total += parseInt(num) / parseInt(denom);
        } else {
          total += parseFloat(part) || 0;
        }
      }
      quantity = total;
    } else if (cleanQty.includes('-')) {
      // Handle ranges like "2-3", take the first number
      const [first] = cleanQty.split('-');
      quantity = parseFloat(first) || null;
    } else {
      quantity = parseFloat(cleanQty) || null;
    }
  }

  return {
    name: name?.trim() || trimmed,
    quantity,
    unit: unit?.toLowerCase() || null,
  };
}

export class ImportService {
  private recipeService: RecipeService | null;
  private ingredientRepo: IngredientRepository | null;
  private db: Database | null;

  /**
   * Create an ImportService.
   * @param db Optional database connection for saving imported recipes.
   *           If not provided, only parsing is available.
   */
  constructor(db?: Database) {
    this.db = db ?? null;
    this.recipeService = db ? new RecipeService(db) : null;
    this.ingredientRepo = db ? new IngredientRepository(db) : null;
  }

  /**
   * Fetch HTML from a URL using native fetch.
   * Returns { html, blocked } where blocked indicates if the response appears to be a blocking page.
   */
  private async fetchHtmlNative(url: string): Promise<{ html: string; blocked: boolean; statusCode: number }> {
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
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      const statusCode = response.status;

      // Check if response indicates blocking
      if (BLOCKING_STATUS_CODES.includes(statusCode)) {
        return { html: '', blocked: true, statusCode };
      }

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
      const html = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('');

      // Check if the response content indicates blocking (even with 200 status)
      const blocked = isBlockingResponse(html);

      return { html, blocked, statusCode };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch HTML from a URL using a headless browser (playwright).
   * This is used as a fallback when native fetch is blocked.
   */
  private async fetchHtmlWithBrowser(url: string): Promise<string> {
    const playwright = await getPlaywright();
    if (!playwright) {
      throw new Error('Headless browser (playwright) is not available. Install it with: pnpm add playwright');
    }

    let browser = null;
    try {
      // Use chromium for best compatibility
      browser = await playwright.chromium.launch({
        headless: true,
      });

      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1280, height: 720 },
        locale: 'en-US',
      });

      const page = await context.newPage();

      // Navigate to the URL and wait for DOM to be ready
      // Using 'domcontentloaded' instead of 'networkidle' because:
      // - 'networkidle' waits for no network activity for 500ms, which can timeout
      //   on sites with continuous background requests (ads, analytics, trackers)
      // - 'domcontentloaded' fires when HTML is parsed, which is sufficient for
      //   extracting JSON-LD recipe data that's embedded in the initial HTML
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });

      // Wait for body to be available and give time for any critical JS to run
      // This handles cases where JSON-LD is injected via JavaScript
      await page.waitForSelector('body', { timeout: 10000 });
      await page.waitForTimeout(3000);

      // Get the full page HTML after JavaScript execution
      const html = await page.content();

      return html;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Fetch HTML from a URL with proper error handling and size limits.
   * Tries native fetch first, falls back to headless browser if blocked.
   */
  private async fetchHtml(url: string, options: ImportOptions = {}): Promise<string> {
    // Try native fetch first
    const nativeResult = await this.fetchHtmlNative(url);

    // If not blocked, return the HTML
    if (!nativeResult.blocked) {
      return nativeResult.html;
    }

    // If blocked and browser fallback is disabled, throw an error
    if (options.noBrowser) {
      if (BLOCKING_STATUS_CODES.includes(nativeResult.statusCode)) {
        throw new Error(`HTTP ${nativeResult.statusCode}: Site is blocking automated requests. Use headless browser fallback (remove --no-browser flag) to bypass.`);
      }
      throw new Error('Site is blocking automated requests (detected anti-bot protection). Use headless browser fallback (remove --no-browser flag) to bypass.');
    }

    // Fall back to headless browser
    return this.fetchHtmlWithBrowser(url);
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
   * @param url The URL to import from
   * @param options Import options (e.g., noBrowser to disable headless browser fallback)
   */
  async parseRecipeFromUrl(url: string, options: ImportOptions = {}): Promise<ImportResult> {
    try {
      const html = await this.fetchHtml(url, options);

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
   * @param url The URL to import from
   * @param actor The actor performing the import
   * @param options Import options (e.g., noBrowser to disable headless browser fallback)
   */
  async importRecipeFromUrl(
    url: string,
    actor?: string,
    options: ImportOptions = {}
  ): Promise<SaveImportResult> {
    if (!this.recipeService) {
      return { success: false, error: 'Database not available - cannot save recipe' };
    }

    const parseResult = await this.parseRecipeFromUrl(url, options);
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
      // Parse raw ingredient strings and create structured ingredients
      let ingredients: CreateRecipeIngredientInput[] | undefined;

      if (imported.ingredients.length > 0 && this.ingredientRepo) {
        ingredients = [];
        for (const rawIngredient of imported.ingredients) {
          const parsed = parseIngredientString(rawIngredient);
          // Get or create the ingredient in the database
          const ingredient = this.ingredientRepo.getOrCreate(parsed.name);
          ingredients.push({
            ingredientId: ingredient.id,
            quantity: parsed.quantity,
            unit: parsed.unit,
            notes: null,
            optional: false,
          });
        }
      }

      const recipe = this.recipeService.createRecipe(
        createRecipe,
        ingredients,
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
