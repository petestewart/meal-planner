/**
 * Grocery routes - Generate and manage grocery lists from meal plans
 *
 * Endpoints:
 * - POST /api/grocery/generate - Generate and persist grocery list
 * - GET /api/grocery-list/:week - Get persistent grocery list
 * - GET /api/grocery-list/:week/items/:id - Get specific item
 * - PUT /api/grocery-list/:week/items/:id - Update item status
 * - POST /api/grocery-list/:week/items - Add manual item
 * - DELETE /api/grocery-list/:week/items/:id - Delete item
 * - POST /api/grocery-list/:week/check-pantry - Bulk check from pantry
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { GroceryService, getDb, IsoWeekSchema, type GroceryItemStatus } from '@meals/core';
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
 * Schema for item status
 */
const ItemStatusSchema = z.enum(['need_to_buy', 'already_have', 'partial']);

/**
 * Schema for updating an item
 */
const UpdateItemBodySchema = z.object({
  status: ItemStatusSchema.optional(),
  haveQuantity: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
});

/**
 * Schema for adding a manual item
 */
const AddItemBodySchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
});

/**
 * Register grocery routes
 */
export async function groceryRoutes(server: FastifyInstance): Promise<void> {
  const db = getDb();
  const groceryService = new GroceryService(db);

  /**
   * POST /api/grocery/generate - Generate and persist grocery list
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

      // Generate and persist grocery list
      const groceryList = groceryService.generateAndPersist(week);

      if (!groceryList) {
        throw new ApiError('NOT_FOUND', `Plan for week '${week}' not found`);
      }

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

  /**
   * GET /api/grocery-list/:week - Get persistent grocery list
   */
  server.get(
    '/api/grocery-list/:week',
    async (
      request: FastifyRequest<{ Params: { week: string }; Querystring: { status?: string } }>,
      reply: FastifyReply
    ) => {
      const { week } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Invalid week format: ${week}`,
          weekResult.error.issues
        );
      }

      const list = groceryService.getPersistentList(week);

      if (!list) {
        throw new ApiError('NOT_FOUND', `Grocery list for week '${week}' not found`);
      }

      // Filter by status if specified
      const statusFilter = request.query.status as GroceryItemStatus | undefined;
      if (statusFilter) {
        const statusResult = ItemStatusSchema.safeParse(statusFilter);
        if (!statusResult.success) {
          throw new ApiError(
            'VALIDATION_ERROR',
            `Invalid status: ${statusFilter}`,
            statusResult.error.issues
          );
        }
        list.items = list.items.filter((item) => item.status === statusFilter);
      }

      return reply.send(successResponse(list));
    }
  );

  /**
   * GET /api/grocery-list/:week/items/:id - Get specific item
   */
  server.get(
    '/api/grocery-list/:week/items/:id',
    async (
      request: FastifyRequest<{ Params: { week: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { week, id } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Invalid week format: ${week}`,
          weekResult.error.issues
        );
      }

      const item = groceryService.getItemById(id);

      if (!item) {
        throw new ApiError('NOT_FOUND', `Item '${id}' not found`);
      }

      return reply.send(successResponse(item));
    }
  );

  /**
   * PUT /api/grocery-list/:week/items/:id - Update item status
   */
  server.put(
    '/api/grocery-list/:week/items/:id',
    async (
      request: FastifyRequest<{
        Params: { week: string; id: string };
        Body: z.infer<typeof UpdateItemBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { week, id } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Invalid week format: ${week}`,
          weekResult.error.issues
        );
      }

      // Validate body
      const bodyResult = UpdateItemBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid update parameters',
          bodyResult.error.issues
        );
      }

      const updates = bodyResult.data;
      const item = groceryService.updateItem(id, updates);

      if (!item) {
        throw new ApiError('NOT_FOUND', `Item '${id}' not found`);
      }

      return reply.send(successResponse(item));
    }
  );

  /**
   * POST /api/grocery-list/:week/items - Add manual item
   */
  server.post(
    '/api/grocery-list/:week/items',
    async (
      request: FastifyRequest<{
        Params: { week: string };
        Body: z.infer<typeof AddItemBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { week } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Invalid week format: ${week}`,
          weekResult.error.issues
        );
      }

      // Validate body
      const bodyResult = AddItemBodySchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid item parameters',
          bodyResult.error.issues
        );
      }

      const { name, quantity, unit } = bodyResult.data;
      const item = groceryService.addManualItem(week, name, quantity, unit);

      if (!item) {
        throw new ApiError('INTERNAL_ERROR', `Failed to add item '${name}'`);
      }

      return reply.code(201).send(successResponse(item));
    }
  );

  /**
   * DELETE /api/grocery-list/:week/items/:id - Delete item
   */
  server.delete(
    '/api/grocery-list/:week/items/:id',
    async (
      request: FastifyRequest<{ Params: { week: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const { week, id } = request.params;

      // Validate week format
      const weekResult = IsoWeekSchema.safeParse(week);
      if (!weekResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Invalid week format: ${week}`,
          weekResult.error.issues
        );
      }

      const deleted = groceryService.deleteItem(id);

      if (!deleted) {
        throw new ApiError('NOT_FOUND', `Item '${id}' not found`);
      }

      return reply.code(204).send();
    }
  );

  /**
   * POST /api/grocery-list/:week/check-pantry - Bulk check from pantry
   */
  server.post(
    '/api/grocery-list/:week/check-pantry',
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
          `Invalid week format: ${week}`,
          weekResult.error.issues
        );
      }

      const result = groceryService.checkPantry(week);

      return reply.send(successResponse(result));
    }
  );
}
