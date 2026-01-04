import { Command } from 'commander';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  PreferenceService,
  DEFAULT_PREFERENCES,
  type PreferenceKey,
  type UserPreferences,
  type AllergyEntry,
  type CuisinePreferences,
  type PrepDay,
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
 * Initialize database and return a PreferenceService instance
 */
function getService(dbPath?: string): PreferenceService {
  const db = getDb({ dbPath });
  migrate(db, getDefaultMigrationsDir());
  return new PreferenceService(db);
}

/**
 * Map CLI key format to internal preference key.
 * CLI uses kebab-case, internal uses camelCase.
 */
const KEY_MAP: Record<string, PreferenceKey> = {
  'dietary-restrictions': 'dietaryRestrictions',
  'disliked-ingredients': 'dislikedIngredients',
  'favorite-cuisines': 'favoriteCuisines',
  'default-servings': 'defaultServings',
  'max-prep-time': 'maxPrepTimeMinutes',
  'planning-heuristics': 'planningHeuristics',
  // New enhanced preference keys (T044)
  'household-size': 'householdSize',
  'meal-types': 'mealTypes',
  'allergies': 'allergies',
  'prep-day': 'prepDay',
  'cuisine-preferences': 'cuisinePreferences',
};

/**
 * Map internal preference key to CLI key format for display.
 */
const REVERSE_KEY_MAP: Record<PreferenceKey, string> = {
  'dietaryRestrictions': 'dietary-restrictions',
  'dislikedIngredients': 'disliked-ingredients',
  'favoriteCuisines': 'favorite-cuisines',
  'defaultServings': 'default-servings',
  'maxPrepTimeMinutes': 'max-prep-time',
  'planningHeuristics': 'planning-heuristics',
  // New enhanced preference keys (T044)
  'householdSize': 'household-size',
  'mealTypes': 'meal-types',
  'allergies': 'allergies',
  'prepDay': 'prep-day',
  'cuisinePreferences': 'cuisine-preferences',
};

/**
 * Valid preference keys for display
 */
const VALID_KEYS = Object.keys(KEY_MAP);

/**
 * Parse CLI key to internal preference key
 */
function parseKey(cliKey: string): PreferenceKey {
  const key = KEY_MAP[cliKey.toLowerCase()];
  if (!key) {
    throw new Error(
      `Invalid preference key: "${cliKey}". Valid keys: ${VALID_KEYS.join(', ')}`
    );
  }
  return key;
}

/**
 * Valid prep days for validation
 */
const VALID_PREP_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse allergies string in format "ingredient:severity,ingredient:severity"
 * e.g., "peanuts:strict,shellfish:avoid"
 */
function parseAllergies(valueStr: string): AllergyEntry[] {
  if (!valueStr || valueStr.trim() === '') {
    return [];
  }

  const entries = valueStr.split(',').map((s) => s.trim()).filter(Boolean);
  const allergies: AllergyEntry[] = [];

  for (const entry of entries) {
    const parts = entry.split(':');
    if (parts.length !== 2) {
      throw new Error(
        `Invalid allergy format: "${entry}". Expected "ingredient:severity" (e.g., "peanuts:strict" or "shellfish:avoid")`
      );
    }

    const ingredient = parts[0].trim();
    const severity = parts[1].trim().toLowerCase();

    if (severity !== 'avoid' && severity !== 'strict') {
      throw new Error(
        `Invalid allergy severity: "${severity}". Must be "avoid" or "strict".`
      );
    }

    allergies.push({ ingredient, severity });
  }

  return allergies;
}

/**
 * Parse cuisine preferences string in format "liked:cuisine1,cuisine2;disliked:cuisine3,cuisine4"
 * or simple format for liked only: "cuisine1,cuisine2"
 */
function parseCuisinePreferences(valueStr: string): CuisinePreferences {
  if (!valueStr || valueStr.trim() === '') {
    return { liked: [], disliked: [] };
  }

  // Try JSON format first
  if (valueStr.startsWith('{')) {
    try {
      const parsed = JSON.parse(valueStr);
      return {
        liked: Array.isArray(parsed.liked) ? parsed.liked : [],
        disliked: Array.isArray(parsed.disliked) ? parsed.disliked : [],
      };
    } catch {
      throw new Error(
        `Invalid cuisine-preferences JSON. Expected format: '{"liked":["italian"],"disliked":["indian"]}'`
      );
    }
  }

  // Try "liked:a,b;disliked:c,d" format
  if (valueStr.includes(':')) {
    const result: CuisinePreferences = { liked: [], disliked: [] };
    const parts = valueStr.split(';');

    for (const part of parts) {
      const [category, cuisinesStr] = part.split(':').map((s) => s.trim());
      if (category && cuisinesStr) {
        const cuisines = cuisinesStr.split(',').map((s) => s.trim()).filter(Boolean);
        if (category.toLowerCase() === 'liked') {
          result.liked = cuisines;
        } else if (category.toLowerCase() === 'disliked') {
          result.disliked = cuisines;
        }
      }
    }

    return result;
  }

  // Simple comma-separated format (all liked)
  return {
    liked: valueStr.split(',').map((s) => s.trim()).filter(Boolean),
    disliked: [],
  };
}

/**
 * Parse a value string based on the preference key type.
 */
function parseValue(key: PreferenceKey, valueStr: string): UserPreferences[PreferenceKey] {
  switch (key) {
    case 'dietaryRestrictions':
    case 'dislikedIngredients':
    case 'favoriteCuisines':
    case 'mealTypes':
      // Comma-separated list
      return valueStr.split(',').map((s) => s.trim()).filter(Boolean);

    case 'defaultServings':
      const servings = parseInt(valueStr, 10);
      if (isNaN(servings) || servings < 1) {
        throw new Error(`Invalid servings value: "${valueStr}". Must be a positive integer.`);
      }
      return servings;

    case 'householdSize':
      const size = parseInt(valueStr, 10);
      if (isNaN(size) || size < 1) {
        throw new Error(`Invalid household-size value: "${valueStr}". Must be a positive integer.`);
      }
      return size;

    case 'maxPrepTimeMinutes':
      if (valueStr.toLowerCase() === 'null' || valueStr === '') {
        return null;
      }
      const minutes = parseInt(valueStr, 10);
      if (isNaN(minutes) || minutes < 0) {
        throw new Error(`Invalid max-prep-time value: "${valueStr}". Must be a non-negative integer or "null".`);
      }
      return minutes;

    case 'prepDay':
      if (valueStr.toLowerCase() === 'null' || valueStr === '') {
        return null;
      }
      const day = valueStr.toLowerCase() as PrepDay;
      if (!VALID_PREP_DAYS.includes(day)) {
        throw new Error(
          `Invalid prep-day value: "${valueStr}". Must be one of: ${VALID_PREP_DAYS.join(', ')}, or "null".`
        );
      }
      return day;

    case 'planningHeuristics':
      // Parse as JSON
      try {
        return JSON.parse(valueStr);
      } catch {
        throw new Error(
          `Invalid planning-heuristics value. Expected JSON object, e.g., '{"varietyWeight":0.5}'`
        );
      }

    case 'allergies':
      return parseAllergies(valueStr);

    case 'cuisinePreferences':
      return parseCuisinePreferences(valueStr);
  }
}

/**
 * Format a preference value for display
 */
function formatValue(key: PreferenceKey, value: unknown): string {
  if (value === null) {
    return 'null';
  }

  // Special formatting for allergies
  if (key === 'allergies' && Array.isArray(value)) {
    if (value.length === 0) {
      return '(none)';
    }
    return value.map((a: AllergyEntry) => `${a.ingredient}:${a.severity}`).join(', ');
  }

  // Special formatting for cuisinePreferences
  if (key === 'cuisinePreferences' && typeof value === 'object') {
    const prefs = value as CuisinePreferences;
    const parts: string[] = [];
    if (prefs.liked.length > 0) {
      parts.push(`liked: ${prefs.liked.join(', ')}`);
    }
    if (prefs.disliked.length > 0) {
      parts.push(`disliked: ${prefs.disliked.join(', ')}`);
    }
    return parts.length > 0 ? parts.join('; ') : '(none)';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '(none)';
    }
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Display all preferences in a nice terminal format
 */
function displayPreferences(prefs: UserPreferences, service: PreferenceService): void {
  console.log('');
  console.log('User Preferences');
  console.log('================');
  console.log('');

  const rows: Array<{ key: string; value: string; status: string }> = [];

  for (const [internalKey, value] of Object.entries(prefs)) {
    const cliKey = REVERSE_KEY_MAP[internalKey as PreferenceKey];
    if (!cliKey) continue;

    // Check if value differs from default
    const defaultValue = DEFAULT_PREFERENCES[internalKey as PreferenceKey];
    const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue);

    rows.push({
      key: cliKey,
      value: formatValue(internalKey as PreferenceKey, value),
      status: isDefault ? '(default)' : '(custom)',
    });
  }

  printTable(rows, [
    { key: 'key', header: 'KEY', width: 22 },
    { key: 'value', header: 'VALUE', width: 40 },
    { key: 'status', header: 'STATUS', width: 10 },
  ]);

  console.log('');
}

export const prefsCommand = new Command('prefs')
  .description('Preferences management')
  .action(() => {
    console.log('Preferences commands - use --help to see available subcommands.');
  });

// SHOW command
prefsCommand
  .command('show')
  .description('Show all preferences')
  .action((options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getService(globalOpts.db);
      const prefs = service.getAllPreferences();

      if (globalOpts.json) {
        printJson(prefs);
      } else {
        displayPreferences(prefs, service);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// SET command
prefsCommand
  .command('set <key> <value>')
  .description(`Set a preference. Valid keys: ${VALID_KEYS.join(', ')}`)
  .action((key: string, value: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getService(globalOpts.db);

      const prefKey = parseKey(key);
      const parsedValue = parseValue(prefKey, value);

      // Set the preference
      service.setPreference(prefKey, parsedValue as never, 'cli');

      if (globalOpts.json) {
        printJson({
          key: REVERSE_KEY_MAP[prefKey],
          value: parsedValue,
          updated: true,
        });
      } else {
        printSuccess(`Set ${REVERSE_KEY_MAP[prefKey]} = ${formatValue(prefKey, parsedValue)}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// CLEAR command
prefsCommand
  .command('clear <key>')
  .description('Clear a preference (reset to default)')
  .action((key: string, options, command) => {
    const globalOpts = getGlobalOptions(command) as GlobalOptions;

    try {
      const service = getService(globalOpts.db);

      const prefKey = parseKey(key);
      const cliKey = REVERSE_KEY_MAP[prefKey];

      const cleared = service.clearPreference(prefKey, 'cli');

      if (globalOpts.json) {
        printJson({
          key: cliKey,
          cleared,
          defaultValue: DEFAULT_PREFERENCES[prefKey],
        });
      } else {
        if (cleared) {
          printSuccess(`Cleared ${cliKey} (reset to default: ${formatValue(prefKey, DEFAULT_PREFERENCES[prefKey])})`);
        } else {
          console.log(`${cliKey} was not set (already using default).`);
        }
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });
