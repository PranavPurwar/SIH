export class AppError extends Error {
  constructor(
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    message: string = 'An error occurred',
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(401, 'AUTHENTICATION_ERROR', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(public service: string, message?: string, details?: unknown) {
    super(502, 'EXTERNAL_SERVICE_ERROR', message || `${service} request failed`, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', public retryAfterSeconds?: number) {
    super(429, 'RATE_LIMIT_EXCEEDED', message, retryAfterSeconds ? { retryAfterSeconds } : undefined);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
