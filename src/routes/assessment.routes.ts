import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllAssessmentSuites,
  getAssessmentSuiteById,
  createAssessmentSuite,
  updateAssessmentSuite,
  gradeAssessmentSuite,
} from '../services/assessment.service.js';
import { validate } from '../middleware/validate.js';
import {
  createAssessmentSuiteSchema,
  updateAssessmentSuiteSchema,
  submitAssessmentSuiteSchema,
  assessmentSearchSchema,
} from '../schemas/assessment.schema.js';
import { success } from '../lib/response.js';

export const assessmentRouter = Router();

// GET /api/assessments - List institutional assessment suites with search & filters
assessmentRouter.get(
  '/',
  validate(assessmentSearchSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suites = await getAllAssessmentSuites(req.query as any);
      res.status(200).json(success({ total: suites.length, suites }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/assessments/suite/:id - Get assessment suite details & questions
assessmentRouter.get(
  '/suite/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suiteId = req.params.id as string;
      const suite = await getAssessmentSuiteById(suiteId);
      res.status(200).json(success({ suite }));
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/assessments/:id - Faculty update full institutional assessment suite
assessmentRouter.put(
  '/:id',
  validate(updateAssessmentSuiteSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suiteId = String(req.params.id);
      const suite = await updateAssessmentSuite(suiteId, req.body);
      res.status(200).json(success({ message: 'Assessment suite updated successfully', suite }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/assessments/create - Faculty create full institutional assessment suite
assessmentRouter.post(
  '/create',
  validate(createAssessmentSuiteSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const suite = await createAssessmentSuite(req.body);
      res.status(201).json(success({ message: 'Assessment suite created successfully', suite }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/assessments/submit - Submit answers, evaluate score, and persist certificate/skill boost
assessmentRouter.post(
  '/submit',
  validate(submitAssessmentSuiteSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await gradeAssessmentSuite(req.body);
      res.status(200).json(success(result));
    } catch (err) {
      next(err);
    }
  },
);
