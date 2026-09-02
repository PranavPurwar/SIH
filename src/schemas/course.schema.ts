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
  domain: z.string().optional(),
  difficulty: z.string().optional(),
  provider: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export type CourseSearchQuery = z.infer<typeof courseSearchSchema>;
export const courseSearchQuerySchema = courseSearchSchema;

export const scrapeRequestSchema = z.object({
  department: z.string().default('6'),
  limit: z.coerce.number().int().positive().max(100).default(25),
  concurrency: z.coerce.number().int().positive().max(16).default(8),
});

export const courseIdParamSchema = z.object({
  id: z.string().min(1),
});
