/**
 * Preference routes - Get and update user preferences
 *
 * Endpoints:
 * - GET /api/preferences - Get all preferences
 * - PATCH /api/preferences - Update preferences
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  PreferenceService,
  getDb,
  PlanningHeuristicsSchema,
  AllergyEntrySchema,
  CuisinePreferencesSchema,
  PrepDayEnum,
  type UserPreferences,
  type PlanningHeuristics,
  type CuisinePreferences,
} from '@meals/core';
import { successResponse } from '../types.js';
import { ApiError } from '../middleware/error-handler.js';

/**
 * Request body schema for updating preferences (partial)
 */
const UpdatePreferencesBodySchema = z.object({
  dietaryRestrictions: z.array(z.string()).optional(),
  dislikedIngredients: z.array(z.string()).optional(),
  favoriteCuisines: z.array(z.string()).optional(),
  defaultServings: z.number().int().positive().optional(),
  maxPrepTimeMinutes: z.number().int().positive().nullable().optional(),
  planningHeuristics: PlanningHeuristicsSchema.partial().optional(),
  // New enhanced preferences (T044)
  householdSize: z.number().int().positive().optional(),
  mealTypes: z.array(z.string()).optional(),
  allergies: z.array(AllergyEntrySchema).optional(),
  prepDay: PrepDayEnum.nullable().optional(),
  cuisinePreferences: CuisinePreferencesSchema.partial().optional(),
}).strict();

/**
 * Register preference routes
 */
export async function preferenceRoutes(server: FastifyInstance): Promise<void> {
  const db = getDb();
  const preferenceService = new PreferenceService(db);

  /**
   * GET /api/preferences - Get all preferences
   */
  server.get(
    '/api/preferences',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const preferences = preferenceService.getAllPreferences();
      return reply.send(successResponse(preferences));
    }
  );

  /**
   * PATCH /api/preferences - Update preferences
   */
  server.patch(
    '/api/preferences',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof UpdatePreferencesBodySchema> }>,
      reply: FastifyReply
    ) => {
      // Parse and validate request body
      const parseResult = UpdatePreferencesBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid preferences data',
          parseResult.error.issues
        );
      }

      const {
        planningHeuristics: partialHeuristics,
        cuisinePreferences: partialCuisinePrefs,
        ...restUpdates
      } = parseResult.data;

      // Build the update object with properly typed values
      const finalUpdates: Partial<UserPreferences> = { ...restUpdates };

      // Handle planningHeuristics partial update specially
      if (partialHeuristics) {
        const currentHeuristics = preferenceService.getPlanningHeuristics();
        const mergedHeuristics: PlanningHeuristics = {
          preferVariety: partialHeuristics.preferVariety ?? currentHeuristics.preferVariety,
          balanceCuisines: partialHeuristics.balanceCuisines ?? currentHeuristics.balanceCuisines,
          avoidRepeatInWeek: partialHeuristics.avoidRepeatInWeek ?? currentHeuristics.avoidRepeatInWeek,
        };
        finalUpdates.planningHeuristics = mergedHeuristics;
      }

      // Handle cuisinePreferences partial update specially (T044)
      if (partialCuisinePrefs) {
        const currentCuisinePrefs = preferenceService.getCuisinePreferences();
        const mergedCuisinePrefs: CuisinePreferences = {
          liked: partialCuisinePrefs.liked ?? currentCuisinePrefs.liked,
          disliked: partialCuisinePrefs.disliked ?? currentCuisinePrefs.disliked,
        };
        finalUpdates.cuisinePreferences = mergedCuisinePrefs;
      }

      // Update preferences
      const preferences = preferenceService.updatePreferences(finalUpdates);

      return reply.send(successResponse(preferences));
    }
  );
}
