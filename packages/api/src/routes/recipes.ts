/**
 * Recipe routes - CRUD operations for recipes
 *
 * Endpoints:
 * - GET /api/recipes - List/search recipes
 * - GET /api/recipes/:id - Get recipe by ID
 * - POST /api/recipes/:id/scale - Scale recipe to specified servings
 * - POST /api/recipes - Create recipe
 * - PUT /api/recipes/:id - Update recipe
 * - DELETE /api/recipes/:id - Delete recipe
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  RecipeService,
  ImportService,
  getDb,
  type CreateRecipe,
  type ListRecipesOptions,
  type CreateRecipeIngredientInput,
} from '@meals/core';
import { successResponse } from '../types.js';
import { ApiError } from '../middleware/error-handler.js';

/**
 * Query parameters schema for listing recipes
 */
const ListRecipesQuerySchema = z.object({
  q: z.string().optional(),
  tags: z.string().optional(), // Comma-separated tag IDs
  cuisine: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Ingredient input schema
 */
const IngredientInputSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  optional: z.boolean().optional(),
});

type IngredientInput = z.infer<typeof IngredientInputSchema>;

/**
 * Request body schema for creating a recipe
 */
const CreateRecipeBodySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  instructions: z.string().min(1, 'Instructions are required'),
  servings: z.number().int().positive().optional().default(4),
  prepTimeMinutes: z.number().int().nonnegative().optional(),
  cookTimeMinutes: z.number().int().nonnegative().optional(),
  ingredients: z.array(IngredientInputSchema).optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  sourceType: z.enum(['manual', 'imported', 'agent_curated']).optional(),
  cuisine: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

/**
 * Request body schema for scaling a recipe
 */
const ScaleRecipeBodySchema = z.object({
  servings: z.number().int().positive('Servings must be a positive integer'),
});

/**
 * Request body schema for updating a recipe
 */
const UpdateRecipeBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  instructions: z.string().min(1).optional(),
  servings: z.number().int().positive().optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  ingredients: z.array(IngredientInputSchema).optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url().nullable().optional().or(z.literal('')),
  sourceType: z.enum(['manual', 'imported', 'agent_curated']).nullable().optional(),
  cuisine: z.string().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
});

/**
 * Register recipe routes
 */
export async function recipeRoutes(server: FastifyInstance): Promise<void> {
  const db = getDb();
  const recipeService = new RecipeService(db);

  /**
   * GET /api/recipes - List/search recipes
   */
  server.get(
    '/api/recipes',
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof ListRecipesQuerySchema> }>,
      reply: FastifyReply
    ) => {
      // Parse and validate query parameters
      const parseResult = ListRecipesQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid query parameters',
          parseResult.error.issues
        );
      }

      const { q, tags, cuisine, page, limit } = parseResult.data;

      // Build list options
      const options: ListRecipesOptions = {
        limit,
        offset: (page - 1) * limit,
      };

      if (q) {
        options.search = q;
      }

      if (tags) {
        options.tagIds = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }

      if (cuisine) {
        options.cuisine = cuisine;
      }

      const recipes = recipeService.listRecipes(options);
      const total = recipeService.countRecipes({
        search: options.search,
        tagIds: options.tagIds,
        cuisine: options.cuisine,
      });

      return reply.send(
        successResponse({
          recipes,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        })
      );
    }
  );

  /**
   * POST /api/recipes/import - Import recipe from URL
   */
  server.post(
    '/api/recipes/import',
    async (
      request: FastifyRequest<{ Body: { url: string } }>,
      reply: FastifyReply
    ) => {
      const { url } = request.body || {};

      if (!url || typeof url !== 'string') {
        throw new ApiError('VALIDATION_ERROR', 'URL is required');
      }

      const importService = new ImportService(db);
      const result = await importService.importRecipeFromUrl(url, 'api');

      if (!result.success) {
        throw new ApiError('IMPORT_FAILED', result.error || 'Failed to import recipe');
      }

      return reply.status(201).send(successResponse(result.recipe));
    }
  );

  /**
   * GET /api/recipes/:id - Get recipe by ID
   */
  server.get(
    '/api/recipes/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      const recipe = recipeService.getRecipe(id);

      if (!recipe) {
        throw new ApiError('NOT_FOUND', `Recipe with ID '${id}' not found`);
      }

      return reply.send(successResponse(recipe));
    }
  );

  /**
   * POST /api/recipes/:id/scale - Scale recipe to specified servings
   *
   * Returns a copy of the recipe with all ingredient quantities scaled.
   * Does not modify the stored recipe.
   */
  server.post(
    '/api/recipes/:id/scale',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: z.infer<typeof ScaleRecipeBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      // Parse and validate request body
      const parseResult = ScaleRecipeBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid request body',
          parseResult.error.issues
        );
      }

      const { servings } = parseResult.data;

      const scaledRecipe = recipeService.scaleRecipe(id, servings);

      if (!scaledRecipe) {
        throw new ApiError('NOT_FOUND', `Recipe with ID '${id}' not found`);
      }

      return reply.send(successResponse(scaledRecipe));
    }
  );

  /**
   * POST /api/recipes - Create recipe
   */
  server.post(
    '/api/recipes',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateRecipeBodySchema> }>,
      reply: FastifyReply
    ) => {
      // Parse and validate request body
      const parseResult = CreateRecipeBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid recipe data',
          parseResult.error.issues
        );
      }

      const { ingredients, tags, ...recipeData } = parseResult.data;

      // Build CreateRecipe object
      const createData: CreateRecipe = {
        title: recipeData.title,
        instructions: recipeData.instructions,
        servings: recipeData.servings,
        description: recipeData.description ?? null,
        prepTimeMinutes: recipeData.prepTimeMinutes ?? null,
        cookTimeMinutes: recipeData.cookTimeMinutes ?? null,
        sourceUrl: recipeData.sourceUrl || null,
        sourceType: recipeData.sourceType ?? null,
        cuisine: recipeData.cuisine ?? null,
        difficulty: recipeData.difficulty ?? null,
      };

      // Convert ingredients to the expected format
      const ingredientInputs: CreateRecipeIngredientInput[] | undefined = ingredients?.map(
        (ing: IngredientInput): CreateRecipeIngredientInput => ({
          ingredientId: ing.ingredientId,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          notes: ing.notes ?? null,
          optional: ing.optional ?? false,
        })
      );

      const recipe = recipeService.createRecipe(createData, ingredientInputs, tags);

      return reply.status(201).send(successResponse(recipe));
    }
  );

  /**
   * PUT /api/recipes/:id - Update recipe
   */
  server.put(
    '/api/recipes/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: z.infer<typeof UpdateRecipeBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      // Check if recipe exists
      if (!recipeService.recipeExists(id)) {
        throw new ApiError('NOT_FOUND', `Recipe with ID '${id}' not found`);
      }

      // Parse and validate request body
      const parseResult = UpdateRecipeBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid recipe data',
          parseResult.error.issues
        );
      }

      const { ingredients, tags, ...recipeData } = parseResult.data;

      // Build UpdateRecipe object
      const updateData = {
        id,
        ...recipeData,
      };

      // Convert ingredients to the expected format
      const ingredientInputs: CreateRecipeIngredientInput[] | undefined = ingredients?.map(
        (ing: IngredientInput): CreateRecipeIngredientInput => ({
          ingredientId: ing.ingredientId,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          notes: ing.notes ?? null,
          optional: ing.optional ?? false,
        })
      );

      const recipe = recipeService.updateRecipe(updateData, ingredientInputs, tags);

      return reply.send(successResponse(recipe));
    }
  );

  /**
   * DELETE /api/recipes/:id - Delete recipe
   */
  server.delete(
    '/api/recipes/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      const deleted = recipeService.deleteRecipe(id);

      if (!deleted) {
        throw new ApiError('NOT_FOUND', `Recipe with ID '${id}' not found`);
      }

      return reply.send(successResponse({ deleted: true }));
    }
  );

}
