import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isAppError } from '../errors';
import { logger } from '../logger';

export function notFoundHandler(): RequestHandler {
  return (req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `No route matches ${req.method} ${req.path}.`,
        requestId: req.requestId,
      },
    });
  };
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;

  const requestId = req.requestId;
  const isProduction = process.env.NODE_ENV === 'production';

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some of the information you entered is not valid.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        requestId,
      },
    });
    return;
  }

  if (isAppError(error)) {
    if (error.status >= 500) {
      logger.error('Request failed', {
        requestId,
        code: error.code,
        message: error.message,
        method: req.method,
        path: req.path,
      });
    } else {
      logger.warn('Request rejected', {
        requestId,
        code: error.code,
        method: req.method,
        path: req.path,
      });
    }
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.expose ? error.message : 'Something went wrong on our side.',
        ...(error.details !== undefined ? { details: error.details } : {}),
        requestId,
      },
    });
    return;
  }

  const type = (error as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'The request body is not valid JSON.',
        requestId,
      },
    });
    return;
  }

  logger.error('Unhandled request error', {
    requestId,
    message: error instanceof Error ? error.message : String(error),
    stack: isProduction ? undefined : error instanceof Error ? error.stack : undefined,
    method: req.method,
    path: req.path,
  });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      requestId,
    },
  });
};

export function asyncRoute(
  handler: (req: import('express').Request, res: import('express').Response) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}
