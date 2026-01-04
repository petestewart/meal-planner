import { Command } from 'commander';
import {
  getDb,
  migrate,
  getDefaultMigrationsDir,
  PreferenceService,
  DEFAULT_PREFERENCES,
  type PreferenceKey,
  type UserPreferences,
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
 * Parse a value string based on the preference key type.
 */
function parseValue(key: PreferenceKey, valueStr: string): UserPreferences[PreferenceKey] {
  switch (key) {
    case 'dietaryRestrictions':
    case 'dislikedIngredients':
    case 'favoriteCuisines':
      // Comma-separated list
      return valueStr.split(',').map((s) => s.trim()).filter(Boolean);

    case 'defaultServings':
      const servings = parseInt(valueStr, 10);
      if (isNaN(servings) || servings < 1) {
        throw new Error(`Invalid servings value: "${valueStr}". Must be a positive integer.`);
      }
      return servings;

    case 'maxPrepTimeMinutes':
      if (valueStr.toLowerCase() === 'null' || valueStr === '') {
        return null;
      }
      const minutes = parseInt(valueStr, 10);
      if (isNaN(minutes) || minutes < 0) {
        throw new Error(`Invalid max-prep-time value: "${valueStr}". Must be a non-negative integer or "null".`);
      }
      return minutes;

    case 'planningHeuristics':
      // Parse as JSON
      try {
        return JSON.parse(valueStr);
      } catch {
        throw new Error(
          `Invalid planning-heuristics value. Expected JSON object, e.g., '{"varietyWeight":0.5}'`
        );
      }
  }
}

/**
 * Format a preference value for display
 */
function formatValue(key: PreferenceKey, value: unknown): string {
  if (value === null) {
    return 'null';
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
