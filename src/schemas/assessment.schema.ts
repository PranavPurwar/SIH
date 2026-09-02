import { z } from 'zod';

export const questionItemSchema = z.object({
  question_id: z.string().optional(),
  question_text: z.string().min(3),
  options: z.array(z.string().min(1)).min(2),
  correct_option: z.coerce.number().int().min(0),
  difficulty: z.enum(['Novice', 'Intermediate', 'Advanced', 'Beginner']).optional(),
  explanation: z.string().optional(),
});

export const createAssessmentSuiteSchema = z.object({
  assessment_id: z.string().optional(),
  code: z.string().min(2).max(30),
  title: z.string().min(3).max(200),
  description: z.string().default(''),
  institution: z.string().min(2).max(100),
  target_role: z.string().min(2).max(100),
  target_skills: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(['Novice', 'Intermediate', 'Advanced', 'Beginner']).default('Intermediate'),
  duration_minutes: z.coerce.number().int().positive().default(30),
  questions: z.array(questionItemSchema).min(1),
});

export type CreateAssessmentSuiteInput = z.infer<typeof createAssessmentSuiteSchema>;

export const updateAssessmentSuiteSchema = createAssessmentSuiteSchema.partial();

export const assessmentSearchSchema = z.object({
  q: z.string().optional(),
  institution: z.string().optional(),
  role: z.string().optional(),
  difficulty: z.string().optional(),
});

export const submitAssessmentSuiteSchema = z.object({
  student_id: z.string().min(1),
  assessment_id: z.string().min(1),
  answers: z.array(z.object({
    question_id: z.string().min(1),
    selected_option: z.coerce.number().int(),
  })).min(1),
});

export type SubmitAssessmentSuiteInput = z.infer<typeof submitAssessmentSuiteSchema>;
