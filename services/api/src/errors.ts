export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: unknown; expose?: boolean } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export const Errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, { details }),
  unauthorized: (message = 'Authentication is required') =>
    new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have access to this resource') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Resource not found') =>
    new AppError(404, 'NOT_FOUND', message),
  conflict: (message: string, details?: unknown) =>
    new AppError(409, 'CONFLICT', message, { details }),
  validation: (message: string, details?: unknown) =>
    new AppError(422, 'VALIDATION_ERROR', message, { details }),
  rateLimited: (message = 'Too many requests. Please try again later.') =>
    new AppError(429, 'RATE_LIMITED', message),
  providerUnavailable: (message = 'The service provider is temporarily unavailable') =>
    new AppError(503, 'PROVIDER_UNAVAILABLE', message),
  internal: (message = 'Something went wrong on our side') =>
    new AppError(500, 'INTERNAL_ERROR', message, { expose: false }),
};
