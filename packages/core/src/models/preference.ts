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
 * Allergy severity levels
 */
export const AllergySeverityEnum = z.enum(['avoid', 'strict']);
export type AllergySeverity = z.infer<typeof AllergySeverityEnum>;

/**
 * Single allergy entry with ingredient and severity
 */
export const AllergyEntrySchema = z.object({
  ingredient: z.string(),
  severity: AllergySeverityEnum,
});
export type AllergyEntry = z.infer<typeof AllergyEntrySchema>;

/**
 * Cuisine preferences with liked and disliked arrays
 */
export const CuisinePreferencesSchema = z.object({
  liked: z.array(z.string()).default([]),
  disliked: z.array(z.string()).default([]),
});
export type CuisinePreferences = z.infer<typeof CuisinePreferencesSchema>;

/**
 * Valid days for prep day preference
 */
export const PrepDayEnum = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);
export type PrepDay = z.infer<typeof PrepDayEnum>;

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
  // New enhanced preferences (T044)
  householdSize: z.number().int().positive().default(2),
  mealTypes: z.array(z.string()).default(['lunch', 'dinner']),
  allergies: z.array(AllergyEntrySchema).default([]),
  prepDay: PrepDayEnum.nullable().default(null),
  cuisinePreferences: CuisinePreferencesSchema.default({
    liked: [],
    disliked: [],
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
  // New enhanced preference keys (T044)
  'householdSize',
  'mealTypes',
  'allergies',
  'prepDay',
  'cuisinePreferences',
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
  // New enhanced preference defaults (T044)
  householdSize: 2,
  mealTypes: ['lunch', 'dinner'],
  allergies: [],
  prepDay: null,
  cuisinePreferences: {
    liked: [],
    disliked: [],
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
  // New enhanced preference value schemas (T044)
  householdSize: z.number().int().positive(),
  mealTypes: z.array(z.string()),
  allergies: z.array(AllergyEntrySchema),
  prepDay: PrepDayEnum.nullable(),
  cuisinePreferences: CuisinePreferencesSchema,
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
