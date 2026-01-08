/**
 * Ingredient routes - CRUD operations for ingredients
 *
 * Endpoints:
 * - GET /api/ingredients - List ingredients
 * - GET /api/ingredients/:id - Get ingredient by ID
 * - PATCH /api/ingredients/:id - Update ingredient (store_section, category)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  IngredientRepository,
  getDb,
  isValidStoreSection,
  isValidCategory,
  STORE_SECTIONS,
  INGREDIENT_CATEGORIES,
  type StoreSection,
} from '@meals/core';
import { successResponse } from '../types.js';
import { ApiError } from '../middleware/error-handler.js';

/**
 * Request body schema for updating an ingredient
 */
const UpdateIngredientBodySchema = z.object({
  category: z.string().nullable().optional(),
  storeSection: z.string().nullable().optional(),
});

/**
 * Register ingredient routes
 */
export async function ingredientRoutes(server: FastifyInstance): Promise<void> {
  const db = getDb();
  const ingredientRepo = new IngredientRepository(db);

  /**
   * GET /api/ingredients - List all ingredients
   */
  server.get(
    '/api/ingredients',
    async (
      request: FastifyRequest<{ Querystring: { category?: string; storeSection?: string } }>,
      reply: FastifyReply
    ) => {
      const { category, storeSection } = request.query;

      // Validate category if provided
      if (category && !isValidCategory(category)) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Invalid category "${category}". Valid categories are: ${INGREDIENT_CATEGORIES.join(', ')}`
        );
      }

      const ingredients = ingredientRepo.list(category);

      // Filter by storeSection if provided
      let filteredIngredients = ingredients;
      if (storeSection) {
        if (!isValidStoreSection(storeSection)) {
          throw new ApiError(
            'VALIDATION_ERROR',
            `Invalid store section "${storeSection}". Valid sections are: ${STORE_SECTIONS.join(', ')}`
          );
        }
        filteredIngredients = ingredients.filter((i) => i.storeSection === storeSection);
      }

      return reply.send(successResponse({ ingredients: filteredIngredients }));
    }
  );

  /**
   * GET /api/ingredients/:id - Get ingredient by ID
   */
  server.get(
    '/api/ingredients/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      const ingredient = ingredientRepo.getById(id);

      if (!ingredient) {
        throw new ApiError('NOT_FOUND', `Ingredient with ID '${id}' not found`);
      }

      return reply.send(successResponse(ingredient));
    }
  );

  /**
   * PATCH /api/ingredients/:id - Update ingredient
   *
   * Allows updating category and/or storeSection.
   */
  server.patch(
    '/api/ingredients/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: z.infer<typeof UpdateIngredientBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      // Check if ingredient exists
      const existing = ingredientRepo.getById(id);
      if (!existing) {
        throw new ApiError('NOT_FOUND', `Ingredient with ID '${id}' not found`);
      }

      // Parse and validate request body
      const parseResult = UpdateIngredientBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid request body',
          parseResult.error.issues
        );
      }

      const { category, storeSection } = parseResult.data;

      // Validate category if provided
      if (category !== undefined && category !== null && !isValidCategory(category)) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Invalid category "${category}". Valid categories are: ${INGREDIENT_CATEGORIES.join(', ')}`
        );
      }

      // Validate storeSection if provided
      if (storeSection !== undefined && storeSection !== null && !isValidStoreSection(storeSection)) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Invalid store section "${storeSection}". Valid sections are: ${STORE_SECTIONS.join(', ')}`
        );
      }

      // Build update data
      const updateData: { category?: string | null; storeSection?: StoreSection | null } = {};
      if (category !== undefined) {
        updateData.category = category;
      }
      if (storeSection !== undefined) {
        updateData.storeSection = storeSection as StoreSection | null;
      }

      const updated = ingredientRepo.update(id, updateData);

      if (!updated) {
        throw new ApiError('NOT_FOUND', `Ingredient with ID '${id}' not found`);
      }

      return reply.send(successResponse(updated));
    }
  );
}
