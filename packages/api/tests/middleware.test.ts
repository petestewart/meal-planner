/**
 * Tests for API middleware and error handling
 */

import { test, expect, describe } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { ApiError, errorHandler } from '../src/middleware/error-handler.js';
import { ErrorCodes, errorResponse, successResponse } from '../src/types.js';

// ==================== ApiError Tests ====================

describe('ApiError', () => {
  test('creates error with code and message', () => {
    const error = new ApiError('NOT_FOUND', 'Recipe not found');

    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Recipe not found');
    expect(error.name).toBe('ApiError');
    expect(error.details).toBeUndefined();
  });

  test('creates error with details', () => {
    const details = { field: 'title', issue: 'required' };
    const error = new ApiError('VALIDATION_ERROR', 'Validation failed', details);

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
    expect(error.details).toEqual(details);
  });

  test('is instance of Error', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Something went wrong');
    expect(error instanceof Error).toBe(true);
  });
});

// ==================== errorResponse Tests ====================

describe('errorResponse', () => {
  test('creates error response with code and message', () => {
    const response = errorResponse('NOT_FOUND', 'Item not found');

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe('NOT_FOUND');
    expect(response.error?.message).toBe('Item not found');
    expect(response.data).toBeUndefined();
  });

  test('creates error response with details', () => {
    const details = [{ path: ['title'], message: 'Required' }];
    const response = errorResponse('VALIDATION_ERROR', 'Validation failed', details);

    expect(response.error?.details).toEqual(details);
  });
});

// ==================== successResponse Tests ====================

describe('successResponse', () => {
  test('creates success response with data', () => {
    const data = { id: '123', name: 'Test' };
    const response = successResponse(data);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
    expect(response.error).toBeUndefined();
  });

  test('creates success response with null data', () => {
    const response = successResponse(null);

    expect(response.success).toBe(true);
    expect(response.data).toBeNull();
  });

  test('creates success response with array data', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const response = successResponse(data);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });
});

// ==================== errorHandler Integration Tests ====================

describe('errorHandler', () => {
  let server: FastifyInstance;

  async function setupServer() {
    server = Fastify({ logger: false });
    server.setErrorHandler(errorHandler);
    return server;
  }

  test('handles ApiError with NOT_FOUND', async () => {
    const server = await setupServer();

    server.get('/test', () => {
      throw new ApiError('NOT_FOUND', 'Resource not found');
    });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Resource not found');

    await server.close();
  });

  test('handles ApiError with VALIDATION_ERROR', async () => {
    const server = await setupServer();

    server.get('/test', () => {
      throw new ApiError('VALIDATION_ERROR', 'Invalid input', { field: 'email' });
    });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual({ field: 'email' });

    await server.close();
  });

  test('handles ApiError with INTERNAL_ERROR', async () => {
    const server = await setupServer();

    server.get('/test', () => {
      throw new ApiError('INTERNAL_ERROR', 'Something broke');
    });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('INTERNAL_ERROR');

    await server.close();
  });

  test('handles ApiError with IMPORT_FAILED', async () => {
    const server = await setupServer();

    server.get('/test', () => {
      throw new ApiError('IMPORT_FAILED', 'Could not import recipe');
    });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('IMPORT_FAILED');

    await server.close();
  });

  test('handles generic Error as internal error', async () => {
    const server = await setupServer();

    server.get('/test', () => {
      throw new Error('Unexpected error');
    });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');

    await server.close();
  });
});

// ==================== ErrorCodes Tests ====================

describe('ErrorCodes', () => {
  test('all error codes have values', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCodes.IMPORT_FAILED).toBe('IMPORT_FAILED');
  });
});
