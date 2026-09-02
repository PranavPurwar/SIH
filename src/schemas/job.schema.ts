import { z } from 'zod';

export const jobSkillRequirementSchema = z.object({
  skill: z.string().min(1),
  min_depth: z.coerce.number().min(0).max(1).default(0.5),
  target_domain: z.string().optional(),
});

export type JobSkillRequirementInput = z.infer<typeof jobSkillRequirementSchema>;

export const createJobSchema = z.object({
  job_id: z.string().optional(),
  title: z.string().min(2).max(200),
  description: z.string().default(''),
  company: z.string().min(2).max(100),
  required_skills: z.array(jobSkillRequirementSchema).min(1),
  stipend: z.union([z.string(), z.number()]).default('Competitive'),
  eligibility: z.string().default('Graduates & Final Year'),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const studentIdParamSchema = z.object({
  studentId: z.string().min(1),
});

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1),
});
