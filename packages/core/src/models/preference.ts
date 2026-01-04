import { z } from 'zod';

/**
 * Planning heuristics schema for meal planning behavior.
 */
export const PlanningHeuristicsSchema = z.object({
  preferVariety: z.boolean().default(true),
  balanceCuisines: z.boolean().default(true),
  avoidRepeatInWeek: z.boolean().default(true),
});

export type PlanningHeuristics = z.infer<typeof PlanningHeuristicsSchema>;

/**
 * Full user preferences schema matching PLAN.md Deliverable C.
 */
export const UserPreferencesSchema = z.object({
  dietaryRestrictions: z.array(z.string()).default([]),
  dislikedIngredients: z.array(z.string()).default([]),
  favoriteCuisines: z.array(z.string()).default([]),
  defaultServings: z.number().int().positive().default(2),
  maxPrepTimeMinutes: z.number().int().positive().nullable().default(null),
  planningHeuristics: PlanningHeuristicsSchema.default({
    preferVariety: true,
    balanceCuisines: true,
    avoidRepeatInWeek: true,
  }),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * All valid preference keys.
 */
export const PreferenceKeyEnum = z.enum([
  'dietaryRestrictions',
  'dislikedIngredients',
  'favoriteCuisines',
  'defaultServings',
  'maxPrepTimeMinutes',
  'planningHeuristics',
]);

export type PreferenceKey = z.infer<typeof PreferenceKeyEnum>;

/**
 * Default values for all preferences.
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  dietaryRestrictions: [],
  dislikedIngredients: [],
  favoriteCuisines: [],
  defaultServings: 2,
  maxPrepTimeMinutes: null,
  planningHeuristics: {
    preferVariety: true,
    balanceCuisines: true,
    avoidRepeatInWeek: true,
  },
};

/**
 * Schema for a single preference row as stored in the database.
 * The value is stored as JSON text.
 */
export const PreferenceRowSchema = z.object({
  key: PreferenceKeyEnum,
  value: z.string(), // JSON encoded value
  updatedAt: z.string(), // ISO timestamp
});

export type PreferenceRow = z.infer<typeof PreferenceRowSchema>;

/**
 * Schema for creating/updating a preference.
 */
export const SetPreferenceSchema = z.object({
  key: PreferenceKeyEnum,
  value: z.unknown(), // Will be JSON serialized
});

export type SetPreference = z.infer<typeof SetPreferenceSchema>;

/**
 * Type-safe schema for individual preference values based on key.
 */
export const PreferenceValueSchemas = {
  dietaryRestrictions: z.array(z.string()),
  dislikedIngredients: z.array(z.string()),
  favoriteCuisines: z.array(z.string()),
  defaultServings: z.number().int().positive(),
  maxPrepTimeMinutes: z.number().int().positive().nullable(),
  planningHeuristics: PlanningHeuristicsSchema,
} as const;

/**
 * Get the default value for a preference key.
 */
export function getDefaultPreference<K extends PreferenceKey>(key: K): UserPreferences[K] {
  return DEFAULT_PREFERENCES[key];
}

/**
 * Validate a preference value for a given key.
 * Returns the validated value or throws a Zod error.
 */
export function validatePreferenceValue<K extends PreferenceKey>(
  key: K,
  value: unknown
): UserPreferences[K] {
  const schema = PreferenceValueSchemas[key];
  return schema.parse(value) as UserPreferences[K];
}

/**
 * Safely parse a preference value, returning default on failure.
 */
export function parsePreferenceValue<K extends PreferenceKey>(
  key: K,
  value: unknown
): UserPreferences[K] {
  try {
    return validatePreferenceValue(key, value);
  } catch {
    return getDefaultPreference(key);
  }
}
