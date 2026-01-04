/**
 * Grocery routes - Generate grocery lists from meal plans
 *
 * Endpoints:
 * - POST /api/grocery/generate - Generate grocery list
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { GroceryService, getDb, IsoWeekSchema } from '@meals/core';
import { successResponse } from '../types.js';
import { ApiError } from '../middleware/error-handler.js';

/**
 * Request body schema for generating a grocery list
 */
const GenerateGroceryBodySchema = z.object({
  week: IsoWeekSchema,
  excludePantry: z.boolean().optional().default(false),
  groupBy: z.enum(['category', 'recipe', 'none']).optional().default('category'),
});

/**
 * Register grocery routes
 */
export async function groceryRoutes(server: FastifyInstance): Promise<void> {
  const db = getDb();
  const groceryService = new GroceryService(db);

  /**
   * POST /api/grocery/generate - Generate grocery list
   */
  server.post(
    '/api/grocery/generate',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof GenerateGroceryBodySchema> }>,
      reply: FastifyReply
    ) => {
      // Parse and validate request body
      const parseResult = GenerateGroceryBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid grocery list parameters',
          parseResult.error.issues
        );
      }

      const { week, excludePantry, groupBy } = parseResult.data;

      // Generate grocery list
      const groceryList = groceryService.generateListForWeek(week);

      if (!groceryList) {
        throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
      }

      // Note: excludePantry and groupBy are accepted but the current GroceryService
      // doesn't implement these options yet. We return the standard grouped list.
      // Future enhancement: implement filtering and alternative groupings.

      return reply.send(
        successResponse({
          ...groceryList,
          options: {
            excludePantry,
            groupBy,
          },
        })
      );
    }
  );
}
