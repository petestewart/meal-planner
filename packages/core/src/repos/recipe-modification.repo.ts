/**
 * Recipe Modification repository - CRUD operations for recipe modifications
 *
 * Handles personal notes and ingredient overrides for recipes.
 * Uses raw SQL with parameterized queries (no ORM).
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

/**
 * Ingredient override - substitution for an ingredient
 */
export interface IngredientOverride {
  original: string;
  replacement: string;
}

/**
 * Recipe modification data
 */
export interface RecipeModification {
  id: string;
  recipeId: string;
  userNotes: string | null;
  ingredientOverrides: IngredientOverride[];
  instructionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating or updating a modification
 */
export interface UpsertRecipeModification {
  recipeId: string;
  userNotes?: string | null;
  ingredientOverrides?: IngredientOverride[];
  instructionNotes?: string | null;
}

/**
 * Raw modification row from database
 */
interface RecipeModificationRow {
  id: string;
  recipe_id: string;
  user_notes: string | null;
  ingredient_overrides: string | null;
  instruction_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to RecipeModification model
 */
function rowToModification(row: RecipeModificationRow): RecipeModification {
  let overrides: IngredientOverride[] = [];
  if (row.ingredient_overrides) {
    try {
      overrides = JSON.parse(row.ingredient_overrides);
    } catch {
      overrides = [];
    }
  }

  return {
    id: row.id,
    recipeId: row.recipe_id,
    userNotes: row.user_notes,
    ingredientOverrides: overrides,
    instructionNotes: row.instruction_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RecipeModificationRepository {
  constructor(private db: Database) {}

  /**
   * Get modification for a recipe
   * Returns null if no modification exists
   */
  getByRecipeId(recipeId: string): RecipeModification | null {
    const row = this.db
      .prepare('SELECT * FROM recipe_modifications WHERE recipe_id = ?')
      .get(recipeId) as RecipeModificationRow | undefined;

    if (!row) return null;

    return rowToModification(row);
  }

  /**
   * Create or update a modification for a recipe
   * Uses upsert (INSERT ... ON CONFLICT UPDATE)
   */
  upsert(data: UpsertRecipeModification): RecipeModification {
    const existing = this.getByRecipeId(data.recipeId);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      const updates: string[] = ['updated_at = ?'];
      const params: (string | null)[] = [now];

      if (data.userNotes !== undefined) {
        updates.push('user_notes = ?');
        params.push(data.userNotes);
      }

      if (data.ingredientOverrides !== undefined) {
        updates.push('ingredient_overrides = ?');
        params.push(JSON.stringify(data.ingredientOverrides));
      }

      if (data.instructionNotes !== undefined) {
        updates.push('instruction_notes = ?');
        params.push(data.instructionNotes);
      }

      params.push(data.recipeId);

      this.db
        .prepare(`UPDATE recipe_modifications SET ${updates.join(', ')} WHERE recipe_id = ?`)
        .run(...params);

      return this.getByRecipeId(data.recipeId)!;
    } else {
      // Create new
      const id = uuid();
      const overridesJson = data.ingredientOverrides
        ? JSON.stringify(data.ingredientOverrides)
        : null;

      this.db
        .prepare(
          `INSERT INTO recipe_modifications (id, recipe_id, user_notes, ingredient_overrides, instruction_notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          data.recipeId,
          data.userNotes ?? null,
          overridesJson,
          data.instructionNotes ?? null,
          now,
          now
        );

      return this.getByRecipeId(data.recipeId)!;
    }
  }

  /**
   * Set user notes for a recipe
   */
  setUserNotes(recipeId: string, notes: string | null): RecipeModification {
    return this.upsert({ recipeId, userNotes: notes });
  }

  /**
   * Add an ingredient override
   * If an override for the same original ingredient exists, it is replaced
   */
  addIngredientOverride(
    recipeId: string,
    original: string,
    replacement: string
  ): RecipeModification {
    const existing = this.getByRecipeId(recipeId);
    let overrides: IngredientOverride[] = existing?.ingredientOverrides ?? [];

    // Remove existing override for same original ingredient
    overrides = overrides.filter(
      (o) => o.original.toLowerCase() !== original.toLowerCase()
    );

    // Add new override
    overrides.push({ original, replacement });

    return this.upsert({ recipeId, ingredientOverrides: overrides });
  }

  /**
   * Remove an ingredient override by original ingredient name
   */
  removeIngredientOverride(recipeId: string, original: string): RecipeModification | null {
    const existing = this.getByRecipeId(recipeId);
    if (!existing) return null;

    const overrides = existing.ingredientOverrides.filter(
      (o) => o.original.toLowerCase() !== original.toLowerCase()
    );

    return this.upsert({ recipeId, ingredientOverrides: overrides });
  }

  /**
   * Clear all ingredient overrides for a recipe
   */
  clearIngredientOverrides(recipeId: string): RecipeModification | null {
    const existing = this.getByRecipeId(recipeId);
    if (!existing) return null;

    return this.upsert({ recipeId, ingredientOverrides: [] });
  }

  /**
   * Delete all modifications for a recipe
   * Returns true if deleted, false if not found
   */
  delete(recipeId: string): boolean {
    const result = this.db
      .prepare('DELETE FROM recipe_modifications WHERE recipe_id = ?')
      .run(recipeId);

    return result.changes > 0;
  }

  /**
   * Check if a recipe has any modifications
   */
  hasModifications(recipeId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM recipe_modifications WHERE recipe_id = ?')
      .get(recipeId);

    return row !== undefined;
  }

  /**
   * List all modifications
   */
  listAll(): RecipeModification[] {
    const rows = this.db
      .prepare('SELECT * FROM recipe_modifications ORDER BY updated_at DESC')
      .all() as RecipeModificationRow[];

    return rows.map(rowToModification);
  }
}
