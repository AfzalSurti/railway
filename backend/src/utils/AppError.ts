export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(statusCode: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details: unknown[] = []): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details: unknown[] = []): AppError {
    return new AppError(409, 'CONFLICT', message, details);
  }

  static validation(message = 'Invalid request', details: unknown[] = []): AppError {
    return new AppError(422, 'VALIDATION_ERROR', message, details);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }

  static serviceUnavailable(message = 'Service unavailable'): AppError {
    return new AppError(503, 'SERVICE_UNAVAILABLE', message);
  }

  static unsupportedProvider(message = 'Unsupported provider combination'): AppError {
    return new AppError(400, 'UNSUPPORTED_PROVIDER', message);
  }
}
