import { z } from 'zod';

export const resumeUploadSchema = z.object({
  student_id: z.string().optional(),
});

export type ResumeUploadInput = z.infer<typeof resumeUploadSchema>;

export const studentIdParamSchema = z.object({
  id: z.string().min(1),
});

export type StudentIdParam = z.infer<typeof studentIdParamSchema>;
