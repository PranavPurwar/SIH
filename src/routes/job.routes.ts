import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { findTopMatchingJobs, findTopCandidatesForJob } from '../services/matching.service.js';
import { getBestRemedialCoursesForJob } from '../services/course.service.js';
import { embedBatch } from '../adapters/ollama.adapter.js';
import { supabase } from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { createJobSchema, studentIdParamSchema, jobIdParamSchema } from '../schemas/job.schema.js';
import { success } from '../lib/response.js';
import { NotFoundError } from '../lib/errors.js';
import { createChildLogger } from '../lib/logger.js';
import type { JobListing, StudentProfile } from '../types/index.js';

const logger = createChildLogger('JobRoutes');
export const jobRouter = Router();

// In-memory student matches cache with TTL for ultra-fast response
interface CachedStudentMatches {
  timestamp: number;
  matches: any[];
}
const studentMatchesCache = new Map<string, CachedStudentMatches>();
const MATCH_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function invalidateStudentMatchesCache(studentId?: string) {
  if (studentId) {
    studentMatchesCache.delete(studentId);
  } else {
    studentMatchesCache.clear();
  }
}

// GET /api/jobs - List all job listings
jobRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { company } = req.query;
      let query = supabase.from('jobs').select('*').order('created_at', { ascending: false });
      if (company) {
        query = query.eq('company', company as string);
      }
      const { data: jobs, error } = await query;
      if (error) throw new Error(error.message);
      res.status(200).json(success({ jobs: jobs || [] }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/jobs/matches/:studentId
jobRouter.get(
  '/matches/:studentId',
  validate(studentIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const studentId = String(req.params.studentId);

      // Check cache first for instant response
      const cached = studentMatchesCache.get(studentId);
      if (cached && Date.now() - cached.timestamp < MATCH_CACHE_TTL_MS) {
        res.status(200).json(success({ student_id: studentId, matches: cached.matches }));
        return;
      }

      const [{ data: student, error: stuErr }, { data: jobs, error: jobErr }] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('jobs').select('*'),
      ]);

      if (stuErr || !student) {
        throw new NotFoundError(`Student ${studentId} not found`);
      }

      if (jobErr) throw jobErr;

      const baseMatches = await findTopMatchingJobs(
        student?.evaluated_skills || [],
        (jobs || []) as JobListing[],
        50,
      );

      // Map each job match with the most suitable remedial courses tailored to that specific role and skill gaps
      const matches = await Promise.all(
        baseMatches.map(async (m) => {
          if (m.missing_skills && m.missing_skills.length > 0) {
            const relevantCourses = await getBestRemedialCoursesForJob(
              m.title || '',
              m.description || '',
              m.missing_skills,
              2,
            );
            return { ...m, recommended_courses: relevantCourses };
          }
          return { ...m, recommended_courses: [] };
        }),
      );

      // Cache matches for student
      studentMatchesCache.set(studentId, {
        timestamp: Date.now(),
        matches,
      });

      res.status(200).json(success({ student_id: studentId, matches }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/jobs/company/:company
jobRouter.get(
  '/company/:company',
  async (req, res, next) => {
    try {
      const company = String(req.params.company);
      const { data: jobs, error } = await supabase.from('jobs').select('*').eq('company', company);
      if (error) throw new Error(error.message);
      res.status(200).json(success({ jobs }));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/jobs/create
jobRouter.post(
  '/create',
  validate(createJobSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body;
      const jobRecord: JobListing = {
        job_id: `job-${crypto.randomUUID().slice(0, 8)}`,
        title: body.title,
        description: body.description || '',
        company: body.company,
        required_skills: body.required_skills || [],
        stipend: body.stipend || 'Competitive',
        eligibility: body.eligibility || 'Graduates & Final Year',
      };

      // Precompute embedding
      try {
        const jobText = `Job: ${jobRecord.title}. Company: ${jobRecord.company}. Description: ${jobRecord.description}. Skills: ${jobRecord.required_skills.map(r => r.skill).join(', ')}`;
        const [embedding] = await embedBatch([jobText], 'document');
        jobRecord.embedding = embedding;
      } catch (e: any) {
        logger.warn({ error: e.message }, 'Could not generate job embedding');
      }

      const { error } = await supabase.from('jobs').upsert({
        ...jobRecord,
        embedding_model: 'nomic-embed-text-v2-moe',
      });

      if (error) {
        res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } });
        return;
      }

      res.status(201).json(success({ message: 'Job created', job: jobRecord }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/jobs/:jobId/candidates
jobRouter.get(
  '/:jobId/candidates',
  validate(jobIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;

      const [{ data: job, error: jobErr }, { data: students, error: stuErr }] = await Promise.all([
        supabase.from('jobs').select('*').eq('job_id', jobId).single(),
        supabase.from('students').select('*'),
      ]);

      if (jobErr || !job) throw new NotFoundError(`Job ${jobId} not found`);

      const candidates = await findTopCandidatesForJob(
        job as JobListing,
        (students || []) as StudentProfile[],
      );

      res.status(200).json(success({ job_id: jobId, candidates }));
    } catch (err) {
      next(err);
    }
  },
);
