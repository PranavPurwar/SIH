import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getInstitutionalAnalytics, getInstitutionStudents } from '../services/analytics.service.js';
import { success } from '../lib/response.js';
import { authenticate } from '../middleware/auth.js';
import { ForbiddenError } from '../lib/errors.js';
import type { AuthUser } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'skillbridge-jwt-secret-key-2026';

export const analyticsRouter = Router();

// GET /api/analytics/institution
analyticsRouter.get(
  '/institution',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let institution = req.query.institution as string | undefined;

      // Extract user from authorization header if available
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7).trim();
          const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
          if (decoded && decoded.role === 'faculty') {
            const facultyInst = decoded.institution_or_company || '';
            // If faculty explicitly asks for an institution, verify it matches their affiliated institution
            if (facultyInst && institution && !facultyInst.toLowerCase().includes(institution.toLowerCase()) && !institution.toLowerCase().includes(facultyInst.toLowerCase())) {
              throw new ForbiddenError(`Access denied: Faculty members may only view analytics for their affiliated institution (${facultyInst}).`);
            }
            if (facultyInst) {
              institution = facultyInst;
            }
          }
        } catch (err: any) {
          if (err instanceof ForbiddenError) throw err;
        }
      }

      const analytics = await getInstitutionalAnalytics(institution);
      res.status(200).json(success(analytics));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/analytics/institution/students - Search and list students for faculty's institution
analyticsRouter.get(
  '/institution/students',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.role !== 'faculty') {
        throw new ForbiddenError('Access restricted to verified institutional faculty');
      }

      const facultyInst = req.user.institution_or_company || '';
      const requestedInst = req.query.institution as string | undefined;

      if (facultyInst && requestedInst && !facultyInst.toLowerCase().includes(requestedInst.toLowerCase()) && !requestedInst.toLowerCase().includes(facultyInst.toLowerCase())) {
        throw new ForbiddenError(`Access denied: Faculty members may only access student records from ${facultyInst}.`);
      }

      const q = (req.query.q as string) || '';
      const students = await getInstitutionStudents(facultyInst, q);
      res.status(200).json(success({ institution: facultyInst, students, count: students.length }));
    } catch (err) {
      next(err);
    }
  },
);

