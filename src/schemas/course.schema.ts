import { z } from 'zod';

export const createCourseSchema = z.object({
  course_id: z.string().optional(),
  title: z.string().min(2).max(200),
  description: z.string().default(''),
  provider: z.string().default('Academia Hub'),
  target_skills: z.array(z.string().min(1)).min(1),
  target_domain: z.string().default('General'),
  difficulty: z.enum(['Novice', 'Intermediate', 'Advanced', 'Beginner']).default('Intermediate'),
  url: z.string().url().optional().or(z.literal('')),
  duration_hours: z.coerce.number().positive().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const courseSearchSchema = z.object({
  q: z.string().optional(),
  query: z.string().optional(),
  search: z.string().optional(),
  domain: z.string().optional(),
  difficulty: z.string().optional(),
  provider: z.string().optional(),
  source: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export type CourseSearchQuery = z.infer<typeof courseSearchSchema>;
export const courseSearchQuerySchema = courseSearchSchema;

export const scrapeRequestSchema = z.object({
  source: z.enum(['all', 'swayam', 'skill_india', 'mit']).default('all'),
  department: z.string().default('all'),
  limit: z.coerce.number().int().positive().optional(),
  concurrency: z.coerce.number().int().positive().max(32).default(16),
  swayamLimit: z.coerce.number().int().positive().optional(),
  skillIndiaLimit: z.coerce.number().int().positive().optional(),
  mitLimit: z.coerce.number().int().positive().optional(),
});

export const courseIdParamSchema = z.object({
  id: z.string().min(1),
});
