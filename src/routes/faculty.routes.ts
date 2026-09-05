import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  getFacultyPrograms,
  applyFacultyProgram,
  getFacultyApplications,
  getFacultyProfile,
  updateFacultyProfile,
  uploadFacultyCV,
  getFacultyCV,
} from '../services/faculty.service.js';
import { success } from '../lib/response.js';

export const facultyRouter = Router();

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// GET /api/faculty/profile/:email
facultyRouter.get(
  '/profile/:email',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.params;
      const profile = await getFacultyProfile(email as string);
      res.status(200).json(success({ profile }));
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/faculty/profile/:email
facultyRouter.put(
  '/profile/:email',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.params;
      const updated = await updateFacultyProfile(email as string, req.body);
      res.status(200).json(success({ message: 'Profile updated successfully', profile: updated }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/faculty/profile/upload-cv
facultyRouter.post(
  '/profile/upload-cv',
  upload.single('cv'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = req.body.email;
      if (!email) {
        res.status(400).json({ error: { code: 'MISSING_EMAIL', message: 'Faculty email is required' } });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: { code: 'NO_FILE', message: 'No CV/resume file uploaded' } });
        return;
      }

      const result = await uploadFacultyCV(
        email,
        req.file.buffer,
        req.file.originalname || 'Faculty_CV.pdf',
        req.file.mimetype || 'application/pdf'
      );
      res.status(200).json(success({ message: 'Academic CV uploaded successfully', ...result }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/faculty/profile/:email/cv
facultyRouter.get(
  '/profile/:email/cv',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.params;
      const file = await getFacultyCV(email as string);
      if (!file) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'CV not found for this faculty member' } });
        return;
      }

      res.setHeader('Content-Type', file.mimetype);
      res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
      res.send(file.buffer);
    } catch (err) {
      next(err);
    }
  },
);

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
      const {
        program_id,
        faculty_name,
        faculty_email,
        institution,
        proposal_summary,
        cv_attached,
        past_grants_summary,
        experience_summary,
        resume_url
      } = req.body;

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
        cv_attached,
        past_grants_summary,
        experience_summary,
        resume_url
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


