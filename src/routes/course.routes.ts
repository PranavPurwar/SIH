import { Router, Request, Response, NextFunction } from 'express';
import { createCourse, searchCourses, getRecommendedCoursesForSkills } from '../services/course.service.js';
import { scrape, scrapeMitOcwCourses, scrapeSwayamCourses, scrapeSkillIndiaDigital } from '../services/scraper.service.js';
import { supabase } from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { createCourseSchema, courseSearchSchema, scrapeRequestSchema } from '../schemas/course.schema.js';
import { success, paginated } from '../lib/response.js';
import { NotFoundError } from '../lib/errors.js';
import { findTopMatchingJobs } from '../services/matching.service.js';
import { createChildLogger } from '../lib/logger.js';
import type { JobListing } from '../types/index.js';

const logger = createChildLogger('CourseRoutes');
export const courseRouter = Router();

// POST /api/courses/create
courseRouter.post(
  '/create',
  validate(createCourseSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const newCourse = await createCourse(req.body);
      res.status(201).json(success({ message: 'Course created', course: newCourse }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/courses/scrape
courseRouter.post(
  '/scrape',
  validate(scrapeRequestSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { source = 'all', department, limit = 50, concurrency = 8, swayamLimit, skillIndiaLimit } = req.body;
      const sources = source === 'all' ? ['swayam', 'skill_india', 'mit'] : [source];
      const stats = await scrape({
        sources: sources as any,
        swayamLimit: swayamLimit || limit,
        skillIndiaLimit: skillIndiaLimit || limit,
        mitLimit: limit,
        mitDepartment: department,
      });

      res.status(200).json(success({
        message: `Scrape completed for sources: ${sources.join(', ')}`,
        total: stats.total,
        swayamCount: stats.swayam.length,
        skillIndiaCount: stats.skillIndia.length,
        mitCount: stats.mit.length,
        courses: [...stats.swayam, ...stats.skillIndia, ...stats.mit],
      }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/courses
courseRouter.get(
  '/',
  validate(courseSearchSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q, search, query, domain, difficulty, provider, source, page, limit } = req.query as any;
      const searchQuery = q || search || query;
      const result = await searchCourses(
        { query: searchQuery, domain, difficulty, provider, source },
        { page: Number(page) || 1, limit: Number(limit) || 25 },
      );
      res.status(200).json(paginated(result.items, result.page, result.limit, result.total));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/courses/recommended/:studentId
courseRouter.get(
  '/recommended/:studentId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { studentId } = req.params;

      const [{ data: student }, { data: jobs }] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('jobs').select('*'),
      ]);

      if (!student) throw new NotFoundError(`Student ${studentId} not found`);

      const matches = await findTopMatchingJobs(
        student.evaluated_skills || [],
        (jobs || []) as JobListing[],
      );

      const missingSkills = Array.from(new Set(matches.flatMap((m) => m.missing_skills)));
      const recommendedCourses = await getRecommendedCoursesForSkills(missingSkills);

      res.status(200).json(success({
        student_id: studentId,
        missing_skills: missingSkills,
        recommended_courses: recommendedCourses,
      }));
    } catch (err) {
      next(err);
    }
  },
);
