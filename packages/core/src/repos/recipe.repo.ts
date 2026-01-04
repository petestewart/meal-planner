/**
 * Recipe repository - CRUD operations for recipes with relations
 *
 * Handles recipes, recipe_ingredients, and recipe_tags tables.
 * Uses raw SQL with parameterized queries (no ORM).
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type {
  Recipe,
  CreateRecipe,
  UpdateRecipe,
  RecipeIngredient,
  RecipeWithRelations,
} from '../models/index.js';

/** Input for creating recipe ingredients (without recipeId, assigned internally) */
export interface CreateRecipeIngredientInput {
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  optional?: boolean;
}

/** Options for listing recipes */
export interface ListRecipesOptions {
  /** Filter by cuisine */
  cuisine?: string;
  /** Filter by difficulty */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Filter by tag IDs (recipes must have ALL specified tags) */
  tagIds?: string[];
  /** Search in title/description/instructions */
  search?: string;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/** Raw recipe row from database */
interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  instructions: string;
  servings: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  source_url: string | null;
  source_type: string | null;
  cuisine: string | null;
  difficulty: string | null;
  created_at: string;
  updated_at: string;
}

/** Raw recipe ingredient row from database */
interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  optional: number;
}

/** Raw recipe tag row from database */
interface RecipeTagRow {
  recipe_id: string;
  tag_id: string;
}

/**
 * Convert database row to Recipe model
 */
function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    servings: row.servings,
    prepTimeMinutes: row.prep_time_minutes,
    cookTimeMinutes: row.cook_time_minutes,
    sourceUrl: row.source_url,
    sourceType: row.source_type as Recipe['sourceType'],
    cuisine: row.cuisine,
    difficulty: row.difficulty as Recipe['difficulty'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to RecipeIngredient model
 */
function rowToRecipeIngredient(row: RecipeIngredientRow): RecipeIngredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    ingredientId: row.ingredient_id,
    quantity: row.quantity,
    unit: row.unit,
    notes: row.notes,
    optional: row.optional === 1,
  };
}

export class RecipeRepository {
  constructor(private db: Database) {}

  /**
   * Create a new recipe with optional ingredients and tags
   */
  create(
    data: CreateRecipe,
    ingredients?: CreateRecipeIngredientInput[],
    tagIds?: string[]
  ): RecipeWithRelations {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.transaction(() => {
      // Insert recipe
      this.db
        .prepare(
          `
        INSERT INTO recipes (
          id, title, description, instructions, servings,
          prep_time_minutes, cook_time_minutes, source_url, source_type,
          cuisine, difficulty, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          id,
          data.title,
          data.description ?? null,
          data.instructions,
          data.servings ?? 4,
          data.prepTimeMinutes ?? null,
          data.cookTimeMinutes ?? null,
          data.sourceUrl ?? null,
          data.sourceType ?? null,
          data.cuisine ?? null,
          data.difficulty ?? null,
          now,
          now
        );

      // Insert recipe ingredients
      if (ingredients && ingredients.length > 0) {
        const insertIngredient = this.db.prepare(`
          INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, notes, optional)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const ing of ingredients) {
          insertIngredient.run(
            uuid(),
            id,
            ing.ingredientId,
            ing.quantity,
            ing.unit,
            ing.notes,
            ing.optional ? 1 : 0
          );
        }
      }

      // Insert recipe tags
      if (tagIds && tagIds.length > 0) {
        const insertTag = this.db.prepare(`
          INSERT INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)
        `);

        for (const tagId of tagIds) {
          insertTag.run(id, tagId);
        }
      }
    })();

    return this.getById(id)!;
  }

  /**
   * Get a recipe by ID with its ingredients and tags
   */
  getById(id: string): RecipeWithRelations | null {
    const row = this.db
      .prepare('SELECT * FROM recipes WHERE id = ?')
      .get(id) as RecipeRow | undefined;

    if (!row) return null;

    const recipe = rowToRecipe(row);

    // Fetch ingredients
    const ingredientRows = this.db
      .prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ?')
      .all(id) as RecipeIngredientRow[];

    const ingredients = ingredientRows.map(rowToRecipeIngredient);

    // Fetch tag IDs
    const tagRows = this.db
      .prepare('SELECT tag_id FROM recipe_tags WHERE recipe_id = ?')
      .all(id) as RecipeTagRow[];

    const tagIds = tagRows.map((r) => r.tag_id);

    return {
      ...recipe,
      ingredients,
      tagIds,
    };
  }

  /**
   * List recipes with optional filters
   *
   * When search is provided, uses FTS5 for full-text search and orders
   * results by relevance (FTS5 rank). Otherwise, orders by created_at.
   */
  list(options: ListRecipesOptions = {}): RecipeWithRelations[] {
    const { cuisine, difficulty, tagIds, search, limit, offset } = options;

    const params: (string | number)[] = [];
    const conditions: string[] = [];
    let sql: string;
    let orderBy: string;

    if (search) {
      // Use FTS5 join for search with relevance ranking
      // FTS5 rank is a negative value where higher (less negative) = more relevant
      sql = `
        SELECT DISTINCT r.*, fts.rank as fts_rank
        FROM recipes r
        JOIN recipes_fts fts ON fts.rowid = r.rowid
      `;
      conditions.push('recipes_fts MATCH ?');
      params.push(search);
      orderBy = 'fts_rank'; // FTS5 rank: higher is more relevant (less negative)
    } else {
      sql = 'SELECT DISTINCT r.* FROM recipes r';
      orderBy = 'r.created_at DESC';
    }

    // Join with tags if filtering by tagIds
    if (tagIds && tagIds.length > 0) {
      // For each tag, the recipe must have that tag
      // We use a subquery approach
      for (let i = 0; i < tagIds.length; i++) {
        conditions.push(`
          EXISTS (
            SELECT 1 FROM recipe_tags rt${i}
            WHERE rt${i}.recipe_id = r.id AND rt${i}.tag_id = ?
          )
        `);
        params.push(tagIds[i]);
      }
    }

    // Filter by cuisine
    if (cuisine) {
      conditions.push('r.cuisine = ?');
      params.push(cuisine);
    }

    // Filter by difficulty
    if (difficulty) {
      conditions.push('r.difficulty = ?');
      params.push(difficulty);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY ${orderBy}`;

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    if (offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(offset);
    }

    const rows = this.db.prepare(sql).all(...params) as RecipeRow[];

    // Fetch relations for each recipe
    return rows.map((row) => {
      const recipe = rowToRecipe(row);

      const ingredientRows = this.db
        .prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ?')
        .all(row.id) as RecipeIngredientRow[];

      const ingredients = ingredientRows.map(rowToRecipeIngredient);

      const tagRows = this.db
        .prepare('SELECT tag_id FROM recipe_tags WHERE recipe_id = ?')
        .all(row.id) as RecipeTagRow[];

      const tagIdsList = tagRows.map((r) => r.tag_id);

      return {
        ...recipe,
        ingredients,
        tagIds: tagIdsList,
      };
    });
  }

  /**
   * Update a recipe and optionally its ingredients and tags
   *
   * If ingredients is provided, replaces all existing ingredients.
   * If tagIds is provided, replaces all existing tags.
   */
  update(
    data: UpdateRecipe,
    ingredients?: CreateRecipeIngredientInput[],
    tagIds?: string[]
  ): RecipeWithRelations | null {
    const existing = this.getById(data.id);
    if (!existing) return null;

    const now = new Date().toISOString();

    this.db.transaction(() => {
      // Build dynamic update for recipe fields
      const updates: string[] = ['updated_at = ?'];
      const params: (string | number | null)[] = [now];

      if (data.title !== undefined) {
        updates.push('title = ?');
        params.push(data.title);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }
      if (data.instructions !== undefined) {
        updates.push('instructions = ?');
        params.push(data.instructions);
      }
      if (data.servings !== undefined) {
        updates.push('servings = ?');
        params.push(data.servings);
      }
      if (data.prepTimeMinutes !== undefined) {
        updates.push('prep_time_minutes = ?');
        params.push(data.prepTimeMinutes);
      }
      if (data.cookTimeMinutes !== undefined) {
        updates.push('cook_time_minutes = ?');
        params.push(data.cookTimeMinutes);
      }
      if (data.sourceUrl !== undefined) {
        updates.push('source_url = ?');
        params.push(data.sourceUrl);
      }
      if (data.sourceType !== undefined) {
        updates.push('source_type = ?');
        params.push(data.sourceType);
      }
      if (data.cuisine !== undefined) {
        updates.push('cuisine = ?');
        params.push(data.cuisine);
      }
      if (data.difficulty !== undefined) {
        updates.push('difficulty = ?');
        params.push(data.difficulty);
      }

      params.push(data.id);

      this.db
        .prepare(`UPDATE recipes SET ${updates.join(', ')} WHERE id = ?`)
        .run(...params);

      // Replace ingredients if provided
      if (ingredients !== undefined) {
        // Delete existing
        this.db
          .prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?')
          .run(data.id);

        // Insert new
        if (ingredients.length > 0) {
          const insertIngredient = this.db.prepare(`
            INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, notes, optional)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          for (const ing of ingredients) {
            insertIngredient.run(
              uuid(),
              data.id,
              ing.ingredientId,
              ing.quantity,
              ing.unit,
              ing.notes,
              ing.optional ? 1 : 0
            );
          }
        }
      }

      // Replace tags if provided
      if (tagIds !== undefined) {
        // Delete existing
        this.db
          .prepare('DELETE FROM recipe_tags WHERE recipe_id = ?')
          .run(data.id);

        // Insert new
        if (tagIds.length > 0) {
          const insertTag = this.db.prepare(`
            INSERT INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)
          `);

          for (const tagId of tagIds) {
            insertTag.run(data.id, tagId);
          }
        }
      }
    })();

    return this.getById(data.id);
  }

  /**
   * Delete a recipe by ID
   *
   * Related recipe_ingredients and recipe_tags are automatically deleted
   * via ON DELETE CASCADE.
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Check if a recipe exists by ID
   */
  exists(id: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM recipes WHERE id = ?')
      .get(id);
    return row !== undefined;
  }

  /**
   * Count total recipes, optionally with filters
   *
   * When search is provided, uses FTS5 for full-text search matching.
   */
  count(options: Omit<ListRecipesOptions, 'limit' | 'offset'> = {}): number {
    const { cuisine, difficulty, tagIds, search } = options;

    const params: (string | number)[] = [];
    const conditions: string[] = [];
    let sql: string;

    if (search) {
      // Use FTS5 join for search
      sql = `
        SELECT COUNT(DISTINCT r.id) as count
        FROM recipes r
        JOIN recipes_fts fts ON fts.rowid = r.rowid
      `;
      conditions.push('recipes_fts MATCH ?');
      params.push(search);
    } else {
      sql = 'SELECT COUNT(DISTINCT r.id) as count FROM recipes r';
    }

    if (tagIds && tagIds.length > 0) {
      for (let i = 0; i < tagIds.length; i++) {
        conditions.push(`
          EXISTS (
            SELECT 1 FROM recipe_tags rt${i}
            WHERE rt${i}.recipe_id = r.id AND rt${i}.tag_id = ?
          )
        `);
        params.push(tagIds[i]);
      }
    }

    if (cuisine) {
      conditions.push('r.cuisine = ?');
      params.push(cuisine);
    }

    if (difficulty) {
      conditions.push('r.difficulty = ?');
      params.push(difficulty);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row.count;
  }
}
