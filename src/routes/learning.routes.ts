import { Router, Request, Response, NextFunction } from 'express';
import { getLearningPrograms, createLearningProgram } from '../services/learning.service.js';
import { success } from '../lib/response.js';

export const learningRouter = Router();

// GET /api/learning/programs
learningRouter.get(
  '/programs',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.query;
      const programs = await getLearningPrograms(type as string | undefined);
      res.status(200).json(success({ programs, count: programs.length }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/learning/create
learningRouter.post(
  '/create',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, company, type, description, target_skills, duration, mode, stipend_or_perk } = req.body;
      if (!title || !company || !description) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Title, company, and description are required' } });
        return;
      }
      const program = await createLearningProgram({
        title,
        company,
        type,
        description,
        target_skills,
        duration,
        mode,
        stipend_or_perk,
      });
      res.status(201).json(success({ message: 'Learning initiative created', program }));
    } catch (err) {
      next(err);
    }
  },
);

