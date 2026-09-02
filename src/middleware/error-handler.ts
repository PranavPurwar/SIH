import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { error as errorResponse } from '../lib/response.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn({ err, path: req.path, method: req.method }, err.message);
    res.status(err.statusCode).json(errorResponse(err.code, err.message, (err as any).details));
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled server error');
  res.status(500).json(
    errorResponse(
      'INTERNAL_ERROR',
      process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    )
  );
}
