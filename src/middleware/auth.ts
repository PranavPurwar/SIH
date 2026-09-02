import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, ForbiddenError } from '../lib/errors.js';
import type { AuthUser, UserRole } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skillbridge-jwt-secret-key-2026';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid authorization header');
  }

  const token = header.slice(7).trim();
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token has expired');
    }
    throw new AuthenticationError('Invalid token');
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(`Access restricted to roles: ${allowedRoles.join(', ')}`);
    }
    next();
  };
}
