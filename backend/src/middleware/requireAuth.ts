import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/jwt';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid Authorization header');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw AppError.unauthorized('Missing bearer token');
    }

    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthenticatedUserId(req: Request): string {
  if (!req.userId) {
    throw AppError.unauthorized();
  }
  return req.userId;
}
