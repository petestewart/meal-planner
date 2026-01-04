/**
 * Unit tests for PreferenceRepository and PreferenceService
 *
 * Tests preference CRUD operations, typed access, defaults,
 * and audit logging for mutations.
 */

import { test, expect, describe } from 'vitest';

import { getDb, closeDb } from '../src/db/connection.js';
import { migrate, getDefaultMigrationsDir } from '../src/db/migrate.js';
import { PreferenceRepository } from '../src/repos/preference.repo.js';
import { PreferenceService } from '../src/services/preference.service.js';
import {
  DEFAULT_PREFERENCES,
  validatePreferenceValue,
  parsePreferenceValue,
  getDefaultPreference,
} from '../src/models/preference.js';
import type { Database } from 'better-sqlite3';

// Database setup helpers
function setupTestDb(): { db: Database; cleanup: () => void } {
  const db = getDb({ dbPath: ':memory:' });
  migrate(db, getDefaultMigrationsDir());
  return {
    db,
    cleanup: () => closeDb(db),
  };
}

function setupRepoTest(): { db: Database; repo: PreferenceRepository; cleanup: () => void } {
  const { db, cleanup } = setupTestDb();
  const repo = new PreferenceRepository(db);
  return { db, repo, cleanup };
}

function setupServiceTest(): { db: Database; service: PreferenceService; cleanup: () => void } {
  const { db, cleanup } = setupTestDb();
  const service = new PreferenceService(db);
  return { db, service, cleanup };
}

// Helper to get audit entries for an entity
function getAuditEntries(db: Database, entityId: string) {
  return db
    .prepare('SELECT * FROM audit_log WHERE entity_id = ? ORDER BY timestamp DESC')
    .all(entityId) as Array<{
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: string | null;
  }>;
}

function getPreferenceAuditEntries(db: Database) {
  return db
    .prepare('SELECT * FROM audit_log WHERE entity_type = ? ORDER BY timestamp DESC')
    .all('preference') as Array<{
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: string | null;
  }>;
}

// ========================
// Model Helper Tests
// ========================

test('getDefaultPreference returns correct defaults', () => {
  expect(getDefaultPreference('dietaryRestrictions')).toStrictEqual([]);
  expect(getDefaultPreference('dislikedIngredients')).toStrictEqual([]);
  expect(getDefaultPreference('favoriteCuisines')).toStrictEqual([]);
  expect(getDefaultPreference('defaultServings')).toStrictEqual(2);
  expect(getDefaultPreference('maxPrepTimeMinutes')).toStrictEqual(null);
  expect(getDefaultPreference('planningHeuristics')).toStrictEqual({ preferVariety: true, balanceCuisines: true, avoidRepeatInWeek: true });
});

test('validatePreferenceValue validates correctly', () => {
  // Valid values
  expect(validatePreferenceValue('dietaryRestrictions', ['vegetarian', 'gluten-free'])).toStrictEqual(['vegetarian', 'gluten-free']);
  expect(validatePreferenceValue('defaultServings', 4)).toStrictEqual(4);
  expect(validatePreferenceValue('maxPrepTimeMinutes', null)).toStrictEqual(null);
  expect(validatePreferenceValue('planningHeuristics', { preferVariety: false, balanceCuisines: true, avoidRepeatInWeek: false })).toStrictEqual({ preferVariety: false, balanceCuisines: true, avoidRepeatInWeek: false });
});

test('validatePreferenceValue throws on invalid value', () => {
  expect(() => validatePreferenceValue('defaultServings', -1)).toThrow();
  expect(() => validatePreferenceValue('dietaryRestrictions', 'not-an-array')).toThrow();
  expect(() => validatePreferenceValue('planningHeuristics', { preferVariety: 'yes' })).toThrow();
});

test('parsePreferenceValue returns default on invalid value', () => {
  expect(parsePreferenceValue('defaultServings', -1)).toStrictEqual(2);
  expect(parsePreferenceValue('dietaryRestrictions', 'not-an-array')).toStrictEqual([]);
});

// ========================
// Repository Tests
// ========================

test('repo.get returns null for non-existent key', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    const result = repo.get('dietaryRestrictions');
    expect(result).toBe(null);
  } finally {
    cleanup();
  }
});

test('repo.set creates new preference', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    const result = repo.set('dietaryRestrictions', ['vegetarian']);

    expect(result.key).toBe('dietaryRestrictions');
    expect(result.value).toStrictEqual(['vegetarian']);
    expect(result.updatedAt.length > 0).toBe(true);
  } finally {
    cleanup();
  }
});

test('repo.set updates existing preference', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    repo.set('defaultServings', 2);
    const result = repo.set('defaultServings', 4);

    expect(result.value).toBe(4);

    // Verify only one row exists
    const all = repo.getAll();
    expect(all.length).toBe(1);
  } finally {
    cleanup();
  }
});

test('repo.get returns stored preference', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    repo.set('favoriteCuisines', ['italian', 'mexican']);

    const result = repo.get('favoriteCuisines');
    expect(result).toBeDefined();
    expect(result.value).toStrictEqual(['italian', 'mexican']);
  } finally {
    cleanup();
  }
});

test('repo.getAll returns all preferences', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    repo.set('dietaryRestrictions', ['vegetarian']);
    repo.set('defaultServings', 4);
    repo.set('maxPrepTimeMinutes', 30);

    const all = repo.getAll();
    expect(all.length).toBe(3);

    // Should be ordered by key
    expect(all[0].key).toBe('defaultServings');
    expect(all[1].key).toBe('dietaryRestrictions');
    expect(all[2].key).toBe('maxPrepTimeMinutes');
  } finally {
    cleanup();
  }
});

test('repo.delete removes preference', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    repo.set('defaultServings', 4);

    const deleted = repo.delete('defaultServings');
    expect(deleted).toBe(true);

    const result = repo.get('defaultServings');
    expect(result).toBe(null);
  } finally {
    cleanup();
  }
});

test('repo.delete returns false for non-existent key', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    const deleted = repo.delete('defaultServings');
    expect(deleted).toBe(false);
  } finally {
    cleanup();
  }
});

test('repo.exists returns correct value', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    expect(repo.exists('defaultServings')).toBe(false);

    repo.set('defaultServings', 4);
    expect(repo.exists('defaultServings')).toBe(true);

    repo.delete('defaultServings');
    expect(repo.exists('defaultServings')).toBe(false);
  } finally {
    cleanup();
  }
});

test('repo.clearAll removes all preferences', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    repo.set('dietaryRestrictions', ['vegetarian']);
    repo.set('defaultServings', 4);
    repo.set('maxPrepTimeMinutes', 30);

    const count = repo.clearAll();
    expect(count).toBe(3);

    const all = repo.getAll();
    expect(all.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('repo.setMany sets multiple preferences atomically', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    const result = repo.setMany({
      dietaryRestrictions: ['vegetarian'],
      defaultServings: 4,
      maxPrepTimeMinutes: 30,
    } as Record<string, unknown>);

    expect(result.length).toBe(3);

    const all = repo.getAll();
    expect(all.length).toBe(3);
  } finally {
    cleanup();
  }
});

test('repo handles complex planningHeuristics object', () => {
  const { repo, cleanup } = setupRepoTest();
  try {
    const heuristics = {
      preferVariety: false,
      balanceCuisines: true,
      avoidRepeatInWeek: false,
    };

    repo.set('planningHeuristics', heuristics);

    const result = repo.get('planningHeuristics');
    expect(result).toBeDefined();
    expect(result.value).toStrictEqual(heuristics);
  } finally {
    cleanup();
  }
});

// ========================
// Service Tests
// ========================

test('service.getAllPreferences returns defaults when empty', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    const prefs = service.getAllPreferences();

    expect(prefs).toStrictEqual(DEFAULT_PREFERENCES);
  } finally {
    cleanup();
  }
});

test('service.getAllPreferences merges stored with defaults', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    service.setPreference('defaultServings', 6);
    service.setPreference('favoriteCuisines', ['thai']);

    const prefs = service.getAllPreferences();

    // Custom values
    expect(prefs.defaultServings).toBe(6);
    expect(prefs.favoriteCuisines).toStrictEqual(['thai']);

    // Default values
    expect(prefs.dietaryRestrictions).toStrictEqual([]);
    expect(prefs.dislikedIngredients).toStrictEqual([]);
    expect(prefs.maxPrepTimeMinutes).toBe(null);
    expect(prefs.planningHeuristics).toStrictEqual({ preferVariety: true, balanceCuisines: true, avoidRepeatInWeek: true });
  } finally {
    cleanup();
  }
});

test('service.getPreference returns stored value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    service.setPreference('defaultServings', 8);

    const result = service.getPreference('defaultServings');
    expect(result).toBe(8);
  } finally {
    cleanup();
  }
});

test('service.getPreference returns default when not set', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    const result = service.getPreference('defaultServings');
    expect(result).toBe(2);
  } finally {
    cleanup();
  }
});

test('service.getRawPreference returns null when not set', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    const result = service.getRawPreference('defaultServings');
    expect(result).toBe(null);
  } finally {
    cleanup();
  }
});

test('service.setPreference validates value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(() => service.setPreference('defaultServings', -1 as unknown as number)).toThrow();
  } finally {
    cleanup();
  }
});

test('service.setPreference creates audit log entry', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    service.setPreference('defaultServings', 4, 'cli');

    const auditEntries = getAuditEntries(db, 'defaultServings');
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].action).toBe('update');
    expect(auditEntries[0].actor).toBe('cli');
    expect(auditEntries[0].entity_type).toBe('preference');

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.key).toBe('defaultServings');
    expect(details.previousValue).toBe(null);
    expect(details.newValue).toBe(4);
  } finally {
    cleanup();
  }
});

test('service.setPreference logs previous value on update', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    service.setPreference('defaultServings', 2);
    service.setPreference('defaultServings', 4, 'api');

    const auditEntries = getAuditEntries(db, 'defaultServings');
    expect(auditEntries.length).toBe(2);

    const details = JSON.parse(auditEntries[0].details!);
    expect(details.previousValue).toBe(2);
    expect(details.newValue).toBe(4);
  } finally {
    cleanup();
  }
});

test('service.clearPreference removes preference and logs', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    service.setPreference('defaultServings', 4);

    const cleared = service.clearPreference('defaultServings', 'user');
    expect(cleared).toBe(true);

    // Check value reverts to default
    const value = service.getPreference('defaultServings');
    expect(value).toBe(2);

    // Check audit log
    const auditEntries = getAuditEntries(db, 'defaultServings');
    expect(auditEntries[0].action).toBe('delete');
    expect(auditEntries[0].actor).toBe('user');
  } finally {
    cleanup();
  }
});

test('service.clearPreference returns false for non-existent key', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    const cleared = service.clearPreference('defaultServings');
    expect(cleared).toBe(false);

    // No audit entry should be created
    const auditEntries = getPreferenceAuditEntries(db);
    expect(auditEntries.length).toBe(0);
  } finally {
    cleanup();
  }
});

test('service.updatePreferences updates multiple preferences', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    const result = service.updatePreferences({
      defaultServings: 6,
      favoriteCuisines: ['italian'],
      maxPrepTimeMinutes: 45,
    });

    expect(result.defaultServings).toBe(6);
    expect(result.favoriteCuisines).toStrictEqual(['italian']);
    expect(result.maxPrepTimeMinutes).toBe(45);
  } finally {
    cleanup();
  }
});

test('service.updatePreferences logs each update', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    service.updatePreferences(
      {
        defaultServings: 6,
        favoriteCuisines: ['italian'],
      },
      'agent:planner'
    );

    const auditEntries = getPreferenceAuditEntries(db);
    expect(auditEntries.length).toBe(2);

    for (const entry of auditEntries) {
      expect(entry.actor).toBe('agent:planner');
      expect(entry.action).toBe('update');
    }
  } finally {
    cleanup();
  }
});

test('service.resetAllPreferences clears all and logs', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    service.setPreference('defaultServings', 6);
    service.setPreference('favoriteCuisines', ['italian']);

    // Clear audit log to make verification easier
    db.prepare('DELETE FROM audit_log').run();

    const count = service.resetAllPreferences('cli');
    expect(count).toBe(2);

    // Verify all reverted to defaults
    const prefs = service.getAllPreferences();
    expect(prefs).toStrictEqual(DEFAULT_PREFERENCES);

    // Check audit log
    const auditEntries = getPreferenceAuditEntries(db);
    expect(auditEntries.length).toBe(2);

    for (const entry of auditEntries) {
      expect(entry.action).toBe('delete');
      expect(entry.actor).toBe('cli');

      const details = JSON.parse(entry.details!);
      expect(details.reason).toBe('reset_all');
    }
  } finally {
    cleanup();
  }
});

// ========================
// Convenience Getter Tests
// ========================

test('service.getDietaryRestrictions returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getDietaryRestrictions()).toStrictEqual([]);

    service.setDietaryRestrictions(['vegetarian', 'gluten-free']);
    expect(service.getDietaryRestrictions()).toStrictEqual(['vegetarian', 'gluten-free']);
  } finally {
    cleanup();
  }
});

test('service.getDislikedIngredients returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getDislikedIngredients()).toStrictEqual([]);

    service.setDislikedIngredients(['cilantro', 'olives']);
    expect(service.getDislikedIngredients()).toStrictEqual(['cilantro', 'olives']);
  } finally {
    cleanup();
  }
});

test('service.getFavoriteCuisines returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getFavoriteCuisines()).toStrictEqual([]);

    service.setFavoriteCuisines(['italian', 'mexican']);
    expect(service.getFavoriteCuisines()).toStrictEqual(['italian', 'mexican']);
  } finally {
    cleanup();
  }
});

test('service.getDefaultServings returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getDefaultServings()).toBe(2);

    service.setDefaultServings(4);
    expect(service.getDefaultServings()).toBe(4);
  } finally {
    cleanup();
  }
});

test('service.getMaxPrepTimeMinutes returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getMaxPrepTimeMinutes()).toBe(null);

    service.setMaxPrepTimeMinutes(30);
    expect(service.getMaxPrepTimeMinutes()).toBe(30);

    service.setMaxPrepTimeMinutes(null);
    expect(service.getMaxPrepTimeMinutes()).toBe(null);
  } finally {
    cleanup();
  }
});

test('service.getPlanningHeuristics returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getPlanningHeuristics()).toStrictEqual({ preferVariety: true, balanceCuisines: true, avoidRepeatInWeek: true });

    service.setPlanningHeuristics({
      preferVariety: false,
      balanceCuisines: true,
      avoidRepeatInWeek: false,
    });

    expect(service.getPlanningHeuristics()).toStrictEqual({ preferVariety: false, balanceCuisines: true, avoidRepeatInWeek: false });
  } finally {
    cleanup();
  }
});

// ========================
// Convenience Setter Tests
// ========================

test('convenience setters create audit entries', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    service.setDietaryRestrictions(['vegetarian'], 'cli');
    service.setDislikedIngredients(['cilantro'], 'api');
    service.setFavoriteCuisines(['italian'], 'user');
    service.setDefaultServings(4, 'agent:curator');
    service.setMaxPrepTimeMinutes(30, 'agent:planner');
    service.setPlanningHeuristics(
      { preferVariety: false, balanceCuisines: true, avoidRepeatInWeek: true },
      'cli'
    );

    const auditEntries = getPreferenceAuditEntries(db);
    expect(auditEntries.length).toBe(6);
  } finally {
    cleanup();
  }
});

test('default actor is user when not specified', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    service.setPreference('defaultServings', 4);

    const auditEntries = getAuditEntries(db, 'defaultServings');
    expect(auditEntries[0].actor).toBe('user');
  } finally {
    cleanup();
  }
});

test('supports all actor types', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    const actors = ['user', 'cli', 'api', 'agent:curator', 'agent:planner'];

    for (const actor of actors) {
      service.setPreference('defaultServings', 4, actor);
    }

    const auditEntries = getAuditEntries(db, 'defaultServings');
    expect(auditEntries.length).toBe(actors.length);

    // Check each actor is present (in reverse order since DESC)
    for (let i = 0; i < actors.length; i++) {
      expect(auditEntries[actors.length - 1 - i].actor).toBe(actors[i]);
    }
  } finally {
    cleanup();
  }
});

test('service.getPreferenceAuditLog returns all preference audit entries', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    service.setPreference('defaultServings', 4);
    service.setPreference('defaultServings', 6);
    service.setPreference('favoriteCuisines', ['italian']);

    const auditLog = service.getPreferenceAuditLog();
    expect(auditLog.length).toBe(3);

    // All should be preference entity type
    for (const entry of auditLog) {
      expect(entry.entityType).toBe('preference');
    }
  } finally {
    cleanup();
  }
});

// ========================
// Enhanced Preference Tests (T044)
// ========================

test('getDefaultPreference returns correct defaults for enhanced preferences', () => {
  expect(getDefaultPreference('householdSize')).toStrictEqual(2);
  expect(getDefaultPreference('mealTypes')).toStrictEqual(['lunch', 'dinner']);
  expect(getDefaultPreference('allergies')).toStrictEqual([]);
  expect(getDefaultPreference('prepDay')).toStrictEqual(null);
  expect(getDefaultPreference('cuisinePreferences')).toStrictEqual({ liked: [], disliked: [] });
});

test('validatePreferenceValue validates enhanced preferences correctly', () => {
  // householdSize
  expect(validatePreferenceValue('householdSize', 4)).toStrictEqual(4);
  expect(() => validatePreferenceValue('householdSize', -1)).toThrow();
  expect(() => validatePreferenceValue('householdSize', 0)).toThrow();

  // mealTypes
  expect(validatePreferenceValue('mealTypes', ['breakfast', 'lunch', 'dinner'])).toStrictEqual(['breakfast', 'lunch', 'dinner']);
  expect(() => validatePreferenceValue('mealTypes', 'not-an-array')).toThrow();

  // allergies
  expect(validatePreferenceValue('allergies', [{ ingredient: 'peanuts', severity: 'strict' }])).toStrictEqual([{ ingredient: 'peanuts', severity: 'strict' }]);
  expect(validatePreferenceValue('allergies', [{ ingredient: 'shellfish', severity: 'avoid' }])).toStrictEqual([{ ingredient: 'shellfish', severity: 'avoid' }]);
  expect(() => validatePreferenceValue('allergies', [{ ingredient: 'peanuts', severity: 'invalid' }])).toThrow();

  // prepDay
  expect(validatePreferenceValue('prepDay', 'sunday')).toStrictEqual('sunday');
  expect(validatePreferenceValue('prepDay', 'saturday')).toStrictEqual('saturday');
  expect(validatePreferenceValue('prepDay', null)).toStrictEqual(null);
  expect(() => validatePreferenceValue('prepDay', 'invalid-day')).toThrow();

  // cuisinePreferences
  expect(validatePreferenceValue('cuisinePreferences', { liked: ['italian'], disliked: ['indian'] })).toStrictEqual({ liked: ['italian'], disliked: ['indian'] });
});

test('service.getHouseholdSize returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getHouseholdSize()).toBe(2);

    service.setHouseholdSize(4);
    expect(service.getHouseholdSize()).toBe(4);
  } finally {
    cleanup();
  }
});

test('service.getMealTypes returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getMealTypes()).toStrictEqual(['lunch', 'dinner']);

    service.setMealTypes(['breakfast', 'lunch', 'dinner']);
    expect(service.getMealTypes()).toStrictEqual(['breakfast', 'lunch', 'dinner']);
  } finally {
    cleanup();
  }
});

test('service.getAllergies returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getAllergies()).toStrictEqual([]);

    service.setAllergies([
      { ingredient: 'peanuts', severity: 'strict' },
      { ingredient: 'shellfish', severity: 'avoid' },
    ]);
    expect(service.getAllergies()).toStrictEqual([
      { ingredient: 'peanuts', severity: 'strict' },
      { ingredient: 'shellfish', severity: 'avoid' },
    ]);
  } finally {
    cleanup();
  }
});

test('service.getPrepDay returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getPrepDay()).toBe(null);

    service.setPrepDay('sunday');
    expect(service.getPrepDay()).toBe('sunday');

    service.setPrepDay('saturday');
    expect(service.getPrepDay()).toBe('saturday');

    service.setPrepDay(null);
    expect(service.getPrepDay()).toBe(null);
  } finally {
    cleanup();
  }
});

test('service.getCuisinePreferences returns correct value', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    expect(service.getCuisinePreferences()).toStrictEqual({ liked: [], disliked: [] });

    service.setCuisinePreferences({
      liked: ['italian', 'mexican'],
      disliked: ['indian'],
    });
    expect(service.getCuisinePreferences()).toStrictEqual({
      liked: ['italian', 'mexican'],
      disliked: ['indian'],
    });
  } finally {
    cleanup();
  }
});

test('service.getAllPreferences includes enhanced preferences with defaults', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    const prefs = service.getAllPreferences();

    expect(prefs.householdSize).toBe(2);
    expect(prefs.mealTypes).toStrictEqual(['lunch', 'dinner']);
    expect(prefs.allergies).toStrictEqual([]);
    expect(prefs.prepDay).toBe(null);
    expect(prefs.cuisinePreferences).toStrictEqual({ liked: [], disliked: [] });
  } finally {
    cleanup();
  }
});

test('service.getAllPreferences merges stored enhanced preferences with defaults', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    service.setHouseholdSize(4);
    service.setMealTypes(['breakfast', 'lunch', 'dinner']);
    service.setAllergies([{ ingredient: 'peanuts', severity: 'strict' }]);
    service.setPrepDay('sunday');
    service.setCuisinePreferences({ liked: ['italian'], disliked: ['indian'] });

    const prefs = service.getAllPreferences();

    expect(prefs.householdSize).toBe(4);
    expect(prefs.mealTypes).toStrictEqual(['breakfast', 'lunch', 'dinner']);
    expect(prefs.allergies).toStrictEqual([{ ingredient: 'peanuts', severity: 'strict' }]);
    expect(prefs.prepDay).toBe('sunday');
    expect(prefs.cuisinePreferences).toStrictEqual({ liked: ['italian'], disliked: ['indian'] });
  } finally {
    cleanup();
  }
});

test('enhanced preference setters create audit entries', () => {
  const { db, service, cleanup } = setupServiceTest();
  try {
    service.setHouseholdSize(4, 'cli');
    service.setMealTypes(['breakfast', 'lunch', 'dinner'], 'api');
    service.setAllergies([{ ingredient: 'peanuts', severity: 'strict' }], 'user');
    service.setPrepDay('sunday', 'agent:planner');
    service.setCuisinePreferences({ liked: ['italian'], disliked: [] }, 'cli');

    const auditEntries = getPreferenceAuditEntries(db);
    expect(auditEntries.length).toBe(5);
  } finally {
    cleanup();
  }
});

test('service.updatePreferences handles enhanced preferences', () => {
  const { service, cleanup } = setupServiceTest();
  try {
    const result = service.updatePreferences({
      householdSize: 3,
      mealTypes: ['breakfast', 'dinner'],
      allergies: [{ ingredient: 'shellfish', severity: 'avoid' }],
      prepDay: 'saturday',
      cuisinePreferences: { liked: ['mexican'], disliked: ['chinese'] },
    });

    expect(result.householdSize).toBe(3);
    expect(result.mealTypes).toStrictEqual(['breakfast', 'dinner']);
    expect(result.allergies).toStrictEqual([{ ingredient: 'shellfish', severity: 'avoid' }]);
    expect(result.prepDay).toBe('saturday');
    expect(result.cuisinePreferences).toStrictEqual({ liked: ['mexican'], disliked: ['chinese'] });
  } finally {
    cleanup();
  }
});

