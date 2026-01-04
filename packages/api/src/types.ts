/**
 * API Response types following the specification from PLAN.md
 */

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    };

/**
 * Error codes as defined in PLAN.md
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IMPORT_FAILED: 'IMPORT_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * HTTP status codes mapped to error codes
 */
export const ErrorHttpStatus: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IMPORT_FAILED: 422,
  INTERNAL_ERROR: 500,
};

/**
 * Helper to create a success response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Helper to create an error response
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}
