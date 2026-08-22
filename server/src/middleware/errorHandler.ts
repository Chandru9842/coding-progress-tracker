import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Unhandled Server Error:', err.message, err.stack);

  res.status(500).json({
    error: 'Internal Server Error',
    message: env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
};
