import { Router, Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getUserById } from '../services/auth.service.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { success } from '../lib/response.js';
import { pgPool } from '../db/connection.js';

export const authRoutes = Router();

// GET /api/auth/demo-accounts - Retrieve active demo personas from database
authRoutes.get(
  '/demo-accounts',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await pgPool.query(`
        SELECT name, tag, email, role, role_label AS "roleLabel"
        FROM demo_accounts
        ORDER BY sort_order ASC, id ASC
      `);
      res.status(200).json(success({ accounts: result.rows }));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/register - Register student, recruiter, or faculty account
authRoutes.post(
  '/register',
  validate(registerSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await registerUser(req.body);
      res.status(201).json(success(result));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login - Authenticate with email and password
authRoutes.post(
  '/login',
  validate(loginSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await loginUser(req.body);
      res.status(200).json(success(result));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me - Retrieve currently authenticated user profile
authRoutes.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
      }
      const user = await getUserById(req.user.id);
      res.status(200).json(success({ user }));
    } catch (err) {
      next(err);
    }
  }
);
