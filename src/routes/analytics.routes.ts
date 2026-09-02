import { Router, Request, Response, NextFunction } from 'express';
import { getInstitutionalAnalytics } from '../services/analytics.service.js';
import { success } from '../lib/response.js';

export const analyticsRouter = Router();

// GET /api/analytics/institution
analyticsRouter.get(
  '/institution',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const analytics = await getInstitutionalAnalytics();
      res.status(200).json(success(analytics));
    } catch (err) {
      next(err);
    }
  },
);

