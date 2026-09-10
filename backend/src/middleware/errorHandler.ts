import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { logger } from '../utils/logger';

function prismaErrorToAppError(error: Prisma.PrismaClientKnownRequestError): AppError {
  if (error.code === 'P2002') {
    return AppError.conflict('A record with this value already exists');
  }
  if (error.code === 'P2025') {
    return AppError.notFound('Record not found');
  }
  return AppError.internal('Database error');
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = prismaErrorToAppError(err);
    logger.error(mapped.message, { prismaCode: err.code });
    res.status(mapped.statusCode).json({
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        details: mapped.details,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error('Unhandled error', {
    message,
    stack: env.NODE_ENV === 'production' ? undefined : err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : message,
      details: [],
    },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      details: [],
    },
  });
}
