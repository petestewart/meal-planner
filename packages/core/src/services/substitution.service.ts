/**
 * Substitution service - Business logic for ingredient substitutions
 *
 * Provides operations for finding, adding, and managing ingredient substitutions.
 * Supports dietary tag filtering and can suggest substitutions for missing ingredients.
 */

import type { Database } from 'better-sqlite3';
import {
  SubstitutionRepository,
  type ListSubstitutionsOptions,
} from '../repos/substitution.repo.js';
import type {
  Substitution,
  CreateSubstitution,
  UpdateSubstitution,
} from '../models/substitution.js';

/**
 * Result of a substitution suggestion for a missing ingredient
 */
export interface SubstitutionSuggestion {
  originalIngredient: string;
  substitutions: Substitution[];
  hasSuggestions: boolean;
}

/**
 * Options for getting substitution suggestions
 */
export interface GetSubstitutionSuggestionsOptions {
  dietaryTags?: string[];
}

export class SubstitutionService {
  private substitutionRepo: SubstitutionRepository;

  constructor(db: Database) {
    this.substitutionRepo = new SubstitutionRepository(db);
  }

  /**
   * Find substitutions for an ingredient.
   * Returns all matching substitutions, with user-defined ones first.
   */
  findSubstitutions(ingredientName: string): Substitution[] {
    return this.substitutionRepo.findByIngredient(ingredientName);
  }

  /**
   * Find substitutions for an ingredient, filtered by dietary tags.
   * Only returns substitutions that have ALL specified dietary tags.
   */
  findSubstitutionsWithDietaryTags(
    ingredientName: string,
    dietaryTags: string[]
  ): Substitution[] {
    const substitutions = this.substitutionRepo.findByIngredient(ingredientName);

    if (dietaryTags.length === 0) {
      return substitutions;
    }

    // Filter to only those that include ALL specified dietary tags
    return substitutions.filter(sub =>
      dietaryTags.every(tag => sub.dietaryTags.includes(tag))
    );
  }

  /**
   * Get substitution suggestions for multiple missing ingredients.
   * Useful when a recipe has ingredients the user doesn't have.
   */
  getSuggestionsForIngredients(
    ingredientNames: string[],
    options?: GetSubstitutionSuggestionsOptions
  ): SubstitutionSuggestion[] {
    return ingredientNames.map(ingredientName => {
      let substitutions = this.substitutionRepo.findByIngredient(ingredientName);

      // Filter by dietary tags if specified
      if (options?.dietaryTags && options.dietaryTags.length > 0) {
        substitutions = substitutions.filter(sub =>
          options.dietaryTags!.every(tag => sub.dietaryTags.includes(tag))
        );
      }

      return {
        originalIngredient: ingredientName,
        substitutions,
        hasSuggestions: substitutions.length > 0,
      };
    });
  }

  /**
   * Add a user-defined substitution.
   * User-defined substitutions are marked as such and shown first in results.
   */
  addSubstitution(data: CreateSubstitution): Substitution {
    return this.substitutionRepo.create({
      ...data,
      isUserDefined: true,
    });
  }

  /**
   * Update a substitution.
   * Only user-defined substitutions can be updated.
   */
  updateSubstitution(data: UpdateSubstitution): Substitution | null {
    const existing = this.substitutionRepo.getById(data.id);
    if (!existing) {
      return null;
    }

    if (!existing.isUserDefined) {
      throw new Error('Cannot update system-defined substitutions');
    }

    return this.substitutionRepo.update(data);
  }

  /**
   * Delete a substitution by ID.
   * Only user-defined substitutions can be deleted.
   */
  deleteSubstitution(id: string): boolean {
    const existing = this.substitutionRepo.getById(id);
    if (!existing) {
      return false;
    }

    if (!existing.isUserDefined) {
      throw new Error('Cannot delete system-defined substitutions');
    }

    return this.substitutionRepo.delete(id);
  }

  /**
   * Get a substitution by ID.
   */
  getSubstitution(id: string): Substitution | null {
    return this.substitutionRepo.getById(id);
  }

  /**
   * List all substitutions with optional filtering.
   */
  listSubstitutions(options?: ListSubstitutionsOptions): Substitution[] {
    return this.substitutionRepo.list(options);
  }

  /**
   * Search for substitutions by ingredient name (partial match).
   */
  searchSubstitutions(query: string): Substitution[] {
    return this.substitutionRepo.search(query);
  }

  /**
   * Get all unique original ingredients that have substitutions.
   */
  getAvailableIngredients(): string[] {
    return this.substitutionRepo.getOriginalIngredients();
  }

  /**
   * Find all substitutions with a specific dietary tag.
   */
  findByDietaryTag(tag: string): Substitution[] {
    return this.substitutionRepo.findByDietaryTag(tag);
  }

  /**
   * Check if any substitutions exist for an ingredient.
   */
  hasSubstitutions(ingredientName: string): boolean {
    return this.substitutionRepo.exists(ingredientName);
  }
}
