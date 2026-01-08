/**
 * Substitution routes - Ingredient substitution API
 *
 * Endpoints:
 * - GET /api/substitutions/:ingredient - Get substitutions for an ingredient
 * - POST /api/substitutions - Create a user-defined substitution
 * - DELETE /api/substitutions/:id - Delete a user-defined substitution
 * - GET /api/substitutions/search - Search substitutions by query
 * - GET /api/substitutions/dietary/:tag - Get substitutions by dietary tag
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  SubstitutionService,
  getDb,
  DIETARY_TAGS,
} from '@meals/core';
import { successResponse } from '../types.js';
import { ApiError } from '../middleware/error-handler.js';

/**
 * Request body schema for creating a substitution
 */
const CreateSubstitutionBodySchema = z.object({
  originalIngredient: z.string().min(1, 'Original ingredient is required'),
  substituteIngredients: z.string().min(1, 'Substitute ingredients is required'),
  substituteDescription: z.string().nullable().optional(),
  dietaryTags: z.array(z.string()).optional().default([]),
});

/**
 * Query params for listing substitutions
 */
const ListSubstitutionsQuerySchema = z.object({
  dietary: z.string().optional(), // Comma-separated dietary tags to filter by
});

/**
 * Register substitution routes
 */
export async function substitutionRoutes(server: FastifyInstance): Promise<void> {
  const db = getDb();
  const substitutionService = new SubstitutionService(db);

  /**
   * GET /api/substitutions/:ingredient - Get substitutions for an ingredient
   *
   * Returns all substitutions for the specified ingredient.
   * User-defined substitutions are returned first.
   */
  server.get(
    '/api/substitutions/:ingredient',
    async (
      request: FastifyRequest<{
        Params: { ingredient: string };
        Querystring: z.infer<typeof ListSubstitutionsQuerySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { ingredient } = request.params;

      // Parse query parameters
      const parseResult = ListSubstitutionsQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid query parameters',
          parseResult.error.issues
        );
      }

      const { dietary } = parseResult.data;

      let substitutions;
      if (dietary) {
        const dietaryTags = dietary.split(',').map((t: string) => t.trim());
        substitutions = substitutionService.findSubstitutionsWithDietaryTags(
          ingredient,
          dietaryTags
        );
      } else {
        substitutions = substitutionService.findSubstitutions(ingredient);
      }

      return reply.send(
        successResponse({
          ingredient,
          substitutions,
          count: substitutions.length,
        })
      );
    }
  );

  /**
   * POST /api/substitutions - Create a user-defined substitution
   */
  server.post(
    '/api/substitutions',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateSubstitutionBodySchema> }>,
      reply: FastifyReply
    ) => {
      // Parse and validate request body
      const parseResult = CreateSubstitutionBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid substitution data',
          parseResult.error.issues
        );
      }

      const substitution = substitutionService.addSubstitution({
        originalIngredient: parseResult.data.originalIngredient,
        substituteIngredients: parseResult.data.substituteIngredients,
        substituteDescription: parseResult.data.substituteDescription ?? null,
        dietaryTags: parseResult.data.dietaryTags,
        isUserDefined: true,
      });

      return reply.status(201).send(successResponse(substitution));
    }
  );

  /**
   * DELETE /api/substitutions/:id - Delete a user-defined substitution
   */
  server.delete(
    '/api/substitutions/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        const deleted = substitutionService.deleteSubstitution(id);

        if (!deleted) {
          throw new ApiError('NOT_FOUND', `Substitution with ID '${id}' not found`);
        }

        return reply.send(successResponse({ deleted: true }));
      } catch (error) {
        if (error instanceof Error && error.message.includes('system-defined')) {
          throw new ApiError('VALIDATION_ERROR', error.message);
        }
        throw error;
      }
    }
  );

  /**
   * GET /api/substitutions/search/:query - Search substitutions by ingredient name
   */
  server.get(
    '/api/substitutions/search/:query',
    async (
      request: FastifyRequest<{ Params: { query: string } }>,
      reply: FastifyReply
    ) => {
      const { query } = request.params;

      const substitutions = substitutionService.searchSubstitutions(query);

      return reply.send(
        successResponse({
          query,
          substitutions,
          count: substitutions.length,
        })
      );
    }
  );

  /**
   * GET /api/substitutions/dietary/:tag - Get substitutions by dietary tag
   */
  server.get(
    '/api/substitutions/dietary/:tag',
    async (
      request: FastifyRequest<{ Params: { tag: string } }>,
      reply: FastifyReply
    ) => {
      const { tag } = request.params;

      const substitutions = substitutionService.findByDietaryTag(tag);

      return reply.send(
        successResponse({
          dietaryTag: tag,
          substitutions,
          count: substitutions.length,
        })
      );
    }
  );

  /**
   * GET /api/substitutions/ingredients - List all ingredients with substitutions
   */
  server.get(
    '/api/substitutions/ingredients',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const ingredients = substitutionService.getAvailableIngredients();

      return reply.send(
        successResponse({
          ingredients,
          count: ingredients.length,
        })
      );
    }
  );

  /**
   * GET /api/substitutions/dietary-tags - List available dietary tags
   */
  server.get(
    '/api/substitutions/dietary-tags',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(
        successResponse({
          dietaryTags: DIETARY_TAGS,
        })
      );
    }
  );
}
