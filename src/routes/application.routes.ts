import { Router, Request, Response, NextFunction } from 'express';
import {
  submitApplication,
  getStudentApplications,
  getAllApplications,
  getJobApplicants,
  updateApplicationStatus,
} from '../services/application.service.js';
import { success } from '../lib/response.js';
import { validate } from '../middleware/validate.js';
import { applyJobSchema, type ApplyJobInput } from '../schemas/job.schema.js';

export const applicationRouter = Router();

// GET /api/applications - List all candidate applications (Recruiter pipeline)
applicationRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const applications = await getAllApplications();
      res.status(200).json(success({ applications }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/applications/apply
applicationRouter.post(
  '/apply',
  validate(applyJobSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { student_id, job_id, match_pct, notes } = req.body as ApplyJobInput;
      const record = await submitApplication(student_id, job_id, match_pct, notes);
      res.status(201).json(success({ message: 'Application submitted successfully', application: record }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/applications/student/:studentId
applicationRouter.get(
  '/student/:studentId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { studentId } = req.params;
      const applications = await getStudentApplications(studentId as string);
      res.status(200).json(success({ applications }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/applications/job/:jobId
applicationRouter.get(
  '/job/:jobId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const applicants = await getJobApplicants(jobId as string);
      res.status(200).json(success({ applicants }));
    } catch (err) {
      next(err);
    }
  },
);

// PATCH & PUT /api/applications/:id/status
const handleStatusUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!['Applied', 'Under Review', 'Shortlisted', 'Selected', 'Rejected'].includes(status)) {
      res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Invalid pipeline status' } });
      return;
    }
    const updated = await updateApplicationStatus(id as string, status, notes);
    res.status(200).json(success({ message: 'Status updated', application: updated }));
  } catch (err) {
    next(err);
  }
};

applicationRouter.patch('/:id/status', handleStatusUpdate);
applicationRouter.put('/:id/status', handleStatusUpdate);


