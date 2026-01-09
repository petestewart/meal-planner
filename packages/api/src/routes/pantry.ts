/**
 * Pantry routes - CRUD operations for pantry items
 *
 * Endpoints:
 * - GET /api/pantry - List all pantry items (supports ?location filter)
 * - GET /api/pantry/expiring - List items expiring within 7 days
 * - GET /api/pantry/staples - List staple items
 * - POST /api/pantry - Add item to pantry
 * - PUT /api/pantry/:ingredientName - Update pantry item
 * - DELETE /api/pantry/:ingredientName - Remove item from pantry
 * - POST /api/pantry/:ingredientName/use - Use (decrement) pantry item quantity
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  PantryService,
  getDb,
  PantryLocationEnum,
  type UpdatePantryItem,
} from '@meals/core';
import { successResponse } from '../types.js';
import { ApiError } from '../middleware/error-handler.js';

/**
 * Query parameters schema for listing pantry items
 */
const ListPantryQuerySchema = z.object({
  location: PantryLocationEnum.optional(),
});

/**
 * Request body schema for adding a pantry item
 */
const AddPantryItemBodySchema = z.object({
  ingredientName: z.string().min(1, 'Ingredient name is required'),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  location: PantryLocationEnum.nullable().optional(),
  expiresAt: z.string().nullable().optional(), // ISO date YYYY-MM-DD
  isPrepared: z.boolean().optional(),
  preparationNotes: z.string().nullable().optional(),
  isStaple: z.boolean().optional(),
});

/**
 * Request body schema for updating a pantry item
 */
const UpdatePantryItemBodySchema = z.object({
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  location: PantryLocationEnum.nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isPrepared: z.boolean().optional(),
  preparationNotes: z.string().nullable().optional(),
  isStaple: z.boolean().optional(),
});

/**
 * Request body schema for using a pantry item
 */
const UsePantryItemBodySchema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
});

/**
 * Register pantry routes
 */
export async function pantryRoutes(server: FastifyInstance): Promise<void> {
  const db = getDb();
  const pantryService = new PantryService(db);

  /**
   * GET /api/pantry - List all pantry items
   * Supports ?location=fridge|freezer|pantry filter
   */
  server.get(
    '/api/pantry',
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof ListPantryQuerySchema> }>,
      reply: FastifyReply
    ) => {
      const parseResult = ListPantryQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid query parameters',
          parseResult.error.issues
        );
      }

      const { location } = parseResult.data;
      const items = pantryService.listItems(location ? { location } : undefined);

      return reply.send(successResponse({ items }));
    }
  );

  /**
   * GET /api/pantry/expiring - List items expiring within 7 days
   */
  server.get(
    '/api/pantry/expiring',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const items = pantryService.listExpiringItems(7);
      return reply.send(successResponse({ items }));
    }
  );

  /**
   * GET /api/pantry/staples - List staple items
   */
  server.get(
    '/api/pantry/staples',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const items = pantryService.listStaples();
      return reply.send(successResponse({ items }));
    }
  );

  /**
   * POST /api/pantry - Add item to pantry
   */
  server.post(
    '/api/pantry',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof AddPantryItemBodySchema> }>,
      reply: FastifyReply
    ) => {
      const parseResult = AddPantryItemBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid pantry item data',
          parseResult.error.issues
        );
      }

      const result = pantryService.addItem(parseResult.data);

      return reply.status(result.created ? 201 : 200).send(
        successResponse({
          item: result.item,
          created: result.created,
        })
      );
    }
  );

  /**
   * PUT /api/pantry/:ingredientName - Update pantry item
   */
  server.put(
    '/api/pantry/:ingredientName',
    async (
      request: FastifyRequest<{
        Params: { ingredientName: string };
        Body: z.infer<typeof UpdatePantryItemBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { ingredientName } = request.params;

      const parseResult = UpdatePantryItemBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid update data',
          parseResult.error.issues
        );
      }

      const updates: UpdatePantryItem = {};
      const data = parseResult.data;

      // Only include fields that were actually provided
      if (data.quantity !== undefined) updates.quantity = data.quantity;
      if (data.unit !== undefined) updates.unit = data.unit;
      if (data.location !== undefined) updates.location = data.location;
      if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt;
      if (data.isPrepared !== undefined) updates.isPrepared = data.isPrepared;
      if (data.preparationNotes !== undefined) updates.preparationNotes = data.preparationNotes;
      if (data.isStaple !== undefined) updates.isStaple = data.isStaple;

      const updated = pantryService.updateItem(ingredientName, updates);

      if (!updated) {
        throw new ApiError(
          'NOT_FOUND',
          `Pantry item '${ingredientName}' not found`
        );
      }

      return reply.send(successResponse(updated));
    }
  );

  /**
   * DELETE /api/pantry/:ingredientName - Remove item from pantry
   */
  server.delete(
    '/api/pantry/:ingredientName',
    async (
      request: FastifyRequest<{ Params: { ingredientName: string } }>,
      reply: FastifyReply
    ) => {
      const { ingredientName } = request.params;

      const deleted = pantryService.removeItem(ingredientName);

      if (!deleted) {
        throw new ApiError(
          'NOT_FOUND',
          `Pantry item '${ingredientName}' not found`
        );
      }

      return reply.send(successResponse({ deleted: true }));
    }
  );

  /**
   * POST /api/pantry/:ingredientName/use - Use (decrement) pantry item quantity
   */
  server.post(
    '/api/pantry/:ingredientName/use',
    async (
      request: FastifyRequest<{
        Params: { ingredientName: string };
        Body: z.infer<typeof UsePantryItemBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { ingredientName } = request.params;

      const parseResult = UsePantryItemBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Invalid quantity',
          parseResult.error.issues
        );
      }

      const { quantity } = parseResult.data;
      const updated = pantryService.useItem(ingredientName, quantity);

      if (!updated) {
        throw new ApiError(
          'NOT_FOUND',
          `Pantry item '${ingredientName}' not found`
        );
      }

      return reply.send(successResponse(updated));
    }
  );
}
