import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  if (res.headersSent) return;

  const status = (err as { status?: number }).status ?? 500;
  const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR';

  res.status(status).json({
    error: {
      code,
      message: err.message ?? 'Internal server error',
    },
  });
}
