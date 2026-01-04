/**
 * Preference service - Business logic layer for user preferences
 *
 * Wraps PreferenceRepository with typed access, default values,
 * and audit logging for mutations.
 */

import type { Database } from 'better-sqlite3';
import { PreferenceRepository, type PreferenceData } from '../repos/preference.repo.js';
import { AuditRepository, type AuditActor } from '../repos/audit.repo.js';
import {
  type PreferenceKey,
  type UserPreferences,
  type PlanningHeuristics,
  type AllergyEntry,
  type CuisinePreferences,
  type PrepDay,
  DEFAULT_PREFERENCES,
  parsePreferenceValue,
  validatePreferenceValue,
} from '../models/index.js';

/**
 * Default actor for operations when not specified.
 */
const DEFAULT_ACTOR: AuditActor = 'user';

export class PreferenceService {
  private prefRepo: PreferenceRepository;
  private auditRepo: AuditRepository;

  constructor(db: Database) {
    this.prefRepo = new PreferenceRepository(db);
    this.auditRepo = new AuditRepository(db);
  }

  /**
   * Get all preferences with defaults for unset values.
   * Returns the complete UserPreferences object.
   */
  getAllPreferences(): UserPreferences {
    const stored = this.prefRepo.getAll();
    const result = { ...DEFAULT_PREFERENCES };

    for (const pref of stored) {
      const key = pref.key as PreferenceKey;
      result[key] = parsePreferenceValue(key, pref.value) as never;
    }

    return result;
  }

  /**
   * Get a single preference by key.
   * Returns the stored value or the default if not set.
   */
  getPreference<K extends PreferenceKey>(key: K): UserPreferences[K] {
    const stored = this.prefRepo.get(key);

    if (!stored) {
      return DEFAULT_PREFERENCES[key];
    }

    return parsePreferenceValue(key, stored.value);
  }

  /**
   * Get the raw preference data if stored, or null if not set.
   * Does not apply defaults.
   */
  getRawPreference(key: PreferenceKey): PreferenceData | null {
    return this.prefRepo.get(key);
  }

  /**
   * Set a preference value.
   * Validates the value against the schema for the key.
   * Logs 'update' action to audit log.
   * Returns the updated preference data.
   */
  setPreference<K extends PreferenceKey>(
    key: K,
    value: UserPreferences[K],
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    // Validate the value
    const validatedValue = validatePreferenceValue(key, value);

    // Get previous value for audit log
    const previous = this.prefRepo.get(key);

    // Set the preference
    const result = this.prefRepo.set(key, validatedValue);

    // Log to audit
    this.auditRepo.log({
      actor,
      action: 'update',
      entityType: 'preference',
      entityId: key,
      details: {
        key,
        previousValue: previous?.value ?? null,
        newValue: validatedValue,
      },
    });

    return result;
  }

  /**
   * Clear a preference, reverting to default.
   * Logs 'delete' action to audit log.
   * Returns true if preference was deleted, false if not found.
   */
  clearPreference(key: PreferenceKey, actor: string = DEFAULT_ACTOR): boolean {
    const previous = this.prefRepo.get(key);
    const deleted = this.prefRepo.delete(key);

    if (deleted && previous) {
      this.auditRepo.log({
        actor,
        action: 'delete',
        entityType: 'preference',
        entityId: key,
        details: {
          key,
          previousValue: previous.value,
        },
      });
    }

    return deleted;
  }

  /**
   * Update multiple preferences at once.
   * Validates all values before setting.
   * Logs 'update' action for each changed preference.
   * Returns the complete updated UserPreferences object.
   */
  updatePreferences(
    updates: Partial<UserPreferences>,
    actor: string = DEFAULT_ACTOR
  ): UserPreferences {
    const validatedUpdates: Partial<Record<PreferenceKey, unknown>> = {};

    // Validate all values first
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const prefKey = key as PreferenceKey;
        validatedUpdates[prefKey] = validatePreferenceValue(prefKey, value);
      }
    }

    // Get previous values for audit log
    const previousValues: Partial<Record<PreferenceKey, unknown>> = {};
    for (const key of Object.keys(validatedUpdates) as PreferenceKey[]) {
      const prev = this.prefRepo.get(key);
      previousValues[key] = prev?.value ?? null;
    }

    // Set all preferences
    if (Object.keys(validatedUpdates).length > 0) {
      this.prefRepo.setMany(validatedUpdates as Record<PreferenceKey, unknown>);
    }

    // Log each update
    for (const [key, value] of Object.entries(validatedUpdates)) {
      this.auditRepo.log({
        actor,
        action: 'update',
        entityType: 'preference',
        entityId: key,
        details: {
          key,
          previousValue: previousValues[key as PreferenceKey],
          newValue: value,
        },
      });
    }

    return this.getAllPreferences();
  }

  /**
   * Reset all preferences to defaults.
   * Logs 'delete' action for each cleared preference.
   * Returns the number of preferences cleared.
   */
  resetAllPreferences(actor: string = DEFAULT_ACTOR): number {
    const stored = this.prefRepo.getAll();
    const count = this.prefRepo.clearAll();

    // Log each deleted preference
    for (const pref of stored) {
      this.auditRepo.log({
        actor,
        action: 'delete',
        entityType: 'preference',
        entityId: pref.key,
        details: {
          key: pref.key,
          previousValue: pref.value,
          reason: 'reset_all',
        },
      });
    }

    return count;
  }

  // ========================
  // Convenience typed getters
  // ========================

  /**
   * Get dietary restrictions list.
   */
  getDietaryRestrictions(): string[] {
    return this.getPreference('dietaryRestrictions');
  }

  /**
   * Get disliked ingredients list.
   */
  getDislikedIngredients(): string[] {
    return this.getPreference('dislikedIngredients');
  }

  /**
   * Get favorite cuisines list.
   */
  getFavoriteCuisines(): string[] {
    return this.getPreference('favoriteCuisines');
  }

  /**
   * Get default servings.
   */
  getDefaultServings(): number {
    return this.getPreference('defaultServings');
  }

  /**
   * Get max prep time in minutes, or null if no limit.
   */
  getMaxPrepTimeMinutes(): number | null {
    return this.getPreference('maxPrepTimeMinutes');
  }

  /**
   * Get planning heuristics.
   */
  getPlanningHeuristics(): PlanningHeuristics {
    return this.getPreference('planningHeuristics');
  }

  // New enhanced preference getters (T044)

  /**
   * Get household size.
   */
  getHouseholdSize(): number {
    return this.getPreference('householdSize');
  }

  /**
   * Get meal types to plan.
   */
  getMealTypes(): string[] {
    return this.getPreference('mealTypes');
  }

  /**
   * Get allergies with severity levels.
   */
  getAllergies(): AllergyEntry[] {
    return this.getPreference('allergies');
  }

  /**
   * Get preferred prep day, or null if not set.
   */
  getPrepDay(): PrepDay | null {
    return this.getPreference('prepDay');
  }

  /**
   * Get cuisine preferences (liked and disliked).
   */
  getCuisinePreferences(): CuisinePreferences {
    return this.getPreference('cuisinePreferences');
  }

  // ========================
  // Convenience typed setters
  // ========================

  /**
   * Set dietary restrictions list.
   */
  setDietaryRestrictions(
    restrictions: string[],
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('dietaryRestrictions', restrictions, actor);
  }

  /**
   * Set disliked ingredients list.
   */
  setDislikedIngredients(
    ingredients: string[],
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('dislikedIngredients', ingredients, actor);
  }

  /**
   * Set favorite cuisines list.
   */
  setFavoriteCuisines(
    cuisines: string[],
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('favoriteCuisines', cuisines, actor);
  }

  /**
   * Set default servings.
   */
  setDefaultServings(
    servings: number,
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('defaultServings', servings, actor);
  }

  /**
   * Set max prep time in minutes.
   */
  setMaxPrepTimeMinutes(
    minutes: number | null,
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('maxPrepTimeMinutes', minutes, actor);
  }

  /**
   * Set planning heuristics.
   */
  setPlanningHeuristics(
    heuristics: PlanningHeuristics,
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('planningHeuristics', heuristics, actor);
  }

  // New enhanced preference setters (T044)

  /**
   * Set household size.
   */
  setHouseholdSize(
    size: number,
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('householdSize', size, actor);
  }

  /**
   * Set meal types to plan.
   */
  setMealTypes(
    mealTypes: string[],
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('mealTypes', mealTypes, actor);
  }

  /**
   * Set allergies with severity levels.
   */
  setAllergies(
    allergies: AllergyEntry[],
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('allergies', allergies, actor);
  }

  /**
   * Set preferred prep day.
   */
  setPrepDay(
    prepDay: PrepDay | null,
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('prepDay', prepDay, actor);
  }

  /**
   * Set cuisine preferences (liked and disliked).
   */
  setCuisinePreferences(
    cuisinePreferences: CuisinePreferences,
    actor: string = DEFAULT_ACTOR
  ): PreferenceData {
    return this.setPreference('cuisinePreferences', cuisinePreferences, actor);
  }

  /**
   * Get audit log entries for preferences.
   */
  getPreferenceAuditLog() {
    return this.auditRepo.getByEntityType('preference');
  }
}
