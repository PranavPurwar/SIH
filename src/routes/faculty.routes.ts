import { Router, Request, Response, NextFunction } from 'express';
import {
  getFacultyPrograms,
  applyFacultyProgram,
  getFacultyApplications,
} from '../services/faculty.service.js';
import { success } from '../lib/response.js';

export const facultyRouter = Router();

// GET /api/faculty/programs
facultyRouter.get(
  '/programs',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type, domain } = req.query;
      const programs = await getFacultyPrograms({
        type: type as string | undefined,
        domain: domain as string | undefined,
      });
      res.status(200).json(success({ programs, count: programs.length }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/faculty/apply
facultyRouter.post(
  '/apply',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { program_id, faculty_name, faculty_email, institution, proposal_summary } = req.body;
      if (!program_id || !faculty_name || !faculty_email || !institution) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Missing required faculty details' } });
        return;
      }
      const record = await applyFacultyProgram({
        program_id,
        faculty_name,
        faculty_email,
        institution,
        proposal_summary,
      });
      res.status(201).json(success({ message: 'Application submitted successfully', application: record }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/faculty/applications/:email
facultyRouter.get(
  '/applications/:email',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.params;
      const applications = await getFacultyApplications(email as string);
      res.status(200).json(success({ applications }));
    } catch (err) {
      next(err);
    }
  },
);

