import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './AppError';

export interface JwtPayload {
  userId: string;
}

export function signToken(userId: string): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ userId }, env.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== 'object' || decoded === null || typeof decoded.userId !== 'string') {
      throw AppError.unauthorized('Invalid token');
    }
    return { userId: decoded.userId };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw AppError.unauthorized('Invalid or expired token');
  }
}
