/**
 * Plan routes - CRUD operations for weekly meal plans
 *
 * Endpoints:
 * - POST /api/plans - Create plan
 * - GET /api/plans/:week - Get plan by week
 * - PUT /api/plans/:week/meals/:day/:mealType - Set meal
 * - PUT /api/plans/:week/status - Update status
 * - POST /api/plans/:week/suggest - Get meal suggestions for empty slots
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  PlanService,
  SuggestionService,
  PrepDayService,
  getDb,
  IsoWeekSchema,
  MealTypeEnum,
  PlanStatusEnum,
  DayOfWeekSchema,
  SlotTypeEnum,
  type MealType,
  type RecipeSuggestion,
} from '@meals/core';
import { successResponse } from '../types.js';
import { ApiError } from '../middleware/error-handler.js';

/**
 * Request body schema for creating a plan
 */
const CreatePlanBodySchema = z.object({
  week: IsoWeekSchema,
  notes: z.string().optional(),
});

/**
 * Request body schema for setting a meal
 */
const SetMealBodySchema = z.object({
  recipeId: z.string().min(1).nullable(),
  servings: z.number().int().positive().optional(),
  notes: z.string().optional(),
  slotType: SlotTypeEnum.optional(),
  leftoversSourceId: z.string().min(1).nullable().optional(),
});

/**
 * Request body schema for updating plan status
 */
const UpdateStatusBodySchema = z.object({
  status: PlanStatusEnum,
});

/**
 * Params schema for meal endpoints
 */
const MealParamsSchema = z.object({
  week: IsoWeekSchema,
  day: z.coerce.number().pipe(DayOfWeekSchema),
  mealType: MealTypeEnum,
});

/**
 * Request body schema for getting suggestions
 */
const SuggestBodySchema = z.object({
  /** Maximum number of suggestions per slot (default: 5) */
  limit: z.number().int().positive().max(20).optional(),
  /** Filter by meal type (if not provided, suggests for all empty slots) */
  mealType: MealTypeEnum.optional(),
  /** Filter by day of week (1=Monday, 7=Sunday) */
  dayOfWeek: DayOfWeekSchema.optional(),
  /** Recipe filters */
  recipeFilters: z.object({
    cuisine: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    search: z.string().optional(),
  }).optional(),
});

/**
 * Response type for suggestions
 */
interface SlotSuggestion {
  dayOfWeek: number;
  dayName: string;
  mealType: MealType;
  suggestions: RecipeSuggestion[];
}

interface SuggestionsResponse {
  week: string;
  slots: SlotSuggestion[];
  totalSuggestions: number;
}

/**
 * Register plan routes
 */
/**
 * Day of week number to name mapping
 */
const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/**
 * All meal types in order
 */
const ALL_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

export async function planRoutes(server: FastifyInstance): Promise<void> {
  const db = getDb();
  const planService = new PlanService(db);
  const suggestionService = new SuggestionService(db);
  const prepDayService = new PrepDayService(db);

  /**
   * POST /api/plans - Create plan
   */
  server.post(
    '/api/plans',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof CreatePlanBodySchema> }>,
      reply: FastifyReply
    ) => {
      // Parse and validate request body
      const parseResult = CreatePlanBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid plan data',
          parseResult.error.issues
        );
      }

      const { week, notes } = parseResult.data;

      // Check if plan already exists for this week
      const existing = planService.getPlanByWeek(week);
      if (existing) {
        throw new ApiError(
          'CONFLICT',
          `Plan for week '${week}' already exists`
        );
      }

      const plan = planService.createPlan({
        week,
        notes: notes ?? null,
        status: 'draft',
      });

      return reply.status(201).send(successResponse(plan));
    }
  );

  /**
   * GET /api/plans/:week - Get plan by week
   */
  server.get(
    '/api/plans/:week',
    async (
      request: FastifyRequest<{ Params: { week: string } }>,
      reply: FastifyReply
    ) => {
      const { week } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid week format. Expected YYYY-Www (e.g., 2025-W02)'
        );
      }

      const plan = planService.getPlanByWeek(week);

      if (!plan) {
        throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
      }

      return reply.send(successResponse(plan));
    }
  );

  /**
   * PUT /api/plans/:week/meals/:day/:mealType - Set meal
   */
  server.put(
    '/api/plans/:week/meals/:day/:mealType',
    async (
      request: FastifyRequest<{
        Params: { week: string; day: string; mealType: string };
        Body: z.infer<typeof SetMealBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      // Parse and validate params
      const paramsResult = MealParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid parameters',
          paramsResult.error.issues
        );
      }

      const { week, day, mealType } = paramsResult.data;

      // Get the plan for this week
      const plan = planService.getPlanByWeek(week);
      if (!plan) {
        throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
      }

      // Parse and validate request body
      const bodyResult = SetMealBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid meal data',
          bodyResult.error.issues
        );
      }

      const { recipeId, servings, notes, slotType, leftoversSourceId } = bodyResult.data;

      try {
        const item = planService.setMeal(
          plan.id,
          day,
          mealType,
          recipeId,
          servings,
          notes,
          undefined, // actor - use default
          slotType ?? 'recipe',
          leftoversSourceId ?? null
        );

        if (!item) {
          throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
        }

        return reply.send(successResponse(item));
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new ApiError('NOT_FOUND', error.message);
        }
        throw error;
      }
    }
  );

  /**
   * PUT /api/plans/:week/status - Update status
   */
  server.put(
    '/api/plans/:week/status',
    async (
      request: FastifyRequest<{
        Params: { week: string };
        Body: z.infer<typeof UpdateStatusBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { week } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid week format. Expected YYYY-Www (e.g., 2025-W02)'
        );
      }

      // Get the plan for this week
      const plan = planService.getPlanByWeek(week);
      if (!plan) {
        throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
      }

      // Parse and validate request body
      const bodyResult = UpdateStatusBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid status data',
          bodyResult.error.issues
        );
      }

      const { status } = bodyResult.data;

      const updatedPlan = planService.setStatus(plan.id, status);

      if (!updatedPlan) {
        throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
      }

      return reply.send(successResponse(updatedPlan));
    }
  );

  /**
   * POST /api/plans/:week/suggest - Get meal suggestions for empty slots
   *
   * Returns ranked recipe suggestions for empty meal slots in the plan.
   * Suggestions are scored based on:
   * - Favorites boost (+0.3)
   * - Recently made penalty (-0.5)
   * - Cuisine preference match (+0.2)
   * - Time constraint match (+0.1)
   * - Variety violation penalty (-0.3)
   */
  server.post(
    '/api/plans/:week/suggest',
    async (
      request: FastifyRequest<{
        Params: { week: string };
        Body: z.infer<typeof SuggestBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { week } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid week format. Expected YYYY-Www (e.g., 2025-W02)'
        );
      }

      // Get the plan for this week
      const plan = planService.getPlanByWeek(week);
      if (!plan) {
        throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
      }

      // Parse and validate request body (body may be empty)
      const bodyResult = SuggestBodySchema.safeParse(request.body ?? {});
      if (!bodyResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid suggestion options',
          bodyResult.error.issues
        );
      }

      const {
        limit = 5,
        mealType: filterMealType,
        dayOfWeek: filterDayOfWeek,
        recipeFilters = {},
      } = bodyResult.data;

      // Find empty meal slots in the plan
      const emptySlots: Array<{ dayOfWeek: number; mealType: MealType }> = [];
      const planItems = plan.items ?? [];

      // Create a set of filled slots for quick lookup
      const filledSlots = new Set(
        planItems
          .filter((item) => item.recipeId !== null)
          .map((item) => `${item.dayOfWeek}-${item.mealType}`)
      );

      // Find all empty slots
      for (let day = 1; day <= 7; day++) {
        // Apply day filter if specified
        if (filterDayOfWeek !== undefined && day !== filterDayOfWeek) {
          continue;
        }

        for (const mealType of ALL_MEAL_TYPES) {
          // Apply meal type filter if specified
          if (filterMealType !== undefined && mealType !== filterMealType) {
            continue;
          }

          const slotKey = `${day}-${mealType}`;
          if (!filledSlots.has(slotKey)) {
            emptySlots.push({ dayOfWeek: day, mealType });
          }
        }
      }

      // Get suggestions for each empty slot
      const slots: SlotSuggestion[] = [];
      let totalSuggestions = 0;

      for (const slot of emptySlots) {
        const suggestions = suggestionService.getSuggestions(
          slot.dayOfWeek,
          slot.mealType,
          {
            limit,
            planId: plan.id,
            recipeFilters: {
              cuisine: recipeFilters.cuisine,
              tagIds: recipeFilters.tagIds,
              difficulty: recipeFilters.difficulty,
              search: recipeFilters.search,
            },
          }
        );

        if (suggestions.length > 0) {
          slots.push({
            dayOfWeek: slot.dayOfWeek,
            dayName: DAY_NAMES[slot.dayOfWeek],
            mealType: slot.mealType,
            suggestions,
          });
          totalSuggestions += suggestions.length;
        }
      }

      const response: SuggestionsResponse = {
        week,
        slots,
        totalSuggestions,
      };

      return reply.send(successResponse(response));
    }
  );

  /**
   * GET /api/plans/:week/prep-day - Get prep day summary
   *
   * Returns aggregated prep tasks for the week's plan, including:
   * - Total estimated prep time
   * - Prep batches linked to the plan
   * - Prep tasks grouped by type (chop, marinate, etc.)
   * - Equipment needed
   * - Recipe summaries with prep info
   */
  server.get(
    '/api/plans/:week/prep-day',
    async (
      request: FastifyRequest<{ Params: { week: string } }>,
      reply: FastifyReply
    ) => {
      const { week } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid week format. Expected YYYY-Www (e.g., 2025-W02)'
        );
      }

      const summary = prepDayService.generatePrepDay(week);

      if (!summary) {
        throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
      }

      return reply.send(successResponse(summary));
    }
  );
}
