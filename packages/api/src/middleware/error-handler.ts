import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCodes, ErrorHttpStatus, errorResponse } from '../types.js';

/**
 * Custom API error that can be thrown in routes
 */
export class ApiError extends Error {
  constructor(
    public code: keyof typeof ErrorCodes,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Global error handler for the Fastify server
 * Transforms all errors into ApiResponse format
 */
export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  // Handle custom ApiError
  if (error instanceof ApiError) {
    const status = ErrorHttpStatus[error.code];
    reply.status(status).send(errorResponse(error.code, error.message, error.details));
    return;
  }

  // Handle Fastify validation errors
  if (error.validation) {
    reply.status(400).send(
      errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Request validation failed',
        error.validation
      )
    );
    return;
  }

  // Handle 404 errors
  if (error.statusCode === 404) {
    reply.status(404).send(errorResponse(ErrorCodes.NOT_FOUND, error.message));
    return;
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  // Default to internal error
  reply.status(500).send(
    errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred',
      process.env.NODE_ENV === 'development' ? error.message : undefined
    )
  );
}
