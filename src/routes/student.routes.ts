import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { processResume } from '../services/resume.service.js';
import { computeRadarMetrics, computeCandidateProfile } from '../services/profile.service.js';
import { generateStudentResumePDF } from '../services/pdf-generator.service.js';
import { supabase } from '../db/connection.js';
import { getUniqueUserId, slugify } from '../lib/id-generator.js';
import { validate } from '../middleware/validate.js';
import { resumeUploadSchema, studentIdParamSchema } from '../schemas/student.schema.js';
import { success } from '../lib/response.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import jwt from 'jsonwebtoken';
import { createChildLogger } from '../lib/logger.js';
import type { ProjectItem } from '../types/index.js';

const logger = createChildLogger('StudentRoutes');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const studentRouter = Router();

// GET /api/students - List all student profiles
studentRouter.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data: students, error } = await supabase
        .from('students')
        .select('id, name, email, degree, parsed_skills, evaluated_skills, created_at')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      res.status(200).json(success({ students: students || [] }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/students/upload-resume
studentRouter.post(
  '/upload-resume',
  upload.single('resume'),
  validate(resumeUploadSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: { code: 'NO_FILE', message: 'No resume file uploaded' } });
        return;
      }

      let studentId = req.body?.student_id?.trim();
      const tempId = studentId || 'temp-candidate';
      const { student, evaluatedSkills } = await processResume(req.file.buffer, tempId);

      if (!studentId || studentId === 'temp-candidate' || studentId.startsWith('std-')) {
        studentId = await getUniqueUserId(student.name, student.email, 'student');
        student.id = studentId;
      }

      // Save base64-encoded resume file directly to student DB record
      student.resume_data = req.file.buffer.toString('base64');
      student.resume_filename = req.file.originalname || `${student.name.replace(/\s+/g, '_')}_Resume.pdf`;
      student.resume_mimetype = req.file.mimetype || 'application/pdf';

      // Save to database
      const { error } = await supabase.from('students').upsert(student);
      if (error) {
        logger.error({ error }, 'Failed to save student profile');
        res.status(500).json({ error: { code: 'DB_ERROR', message: 'Failed to save profile' } });
        return;
      }

      res.status(200).json(success({
        student: {
          ...student,
          has_resume: true,
          resume_url: `/api/students/${student.id}/resume`,
        },
        radar_chart: computeRadarMetrics(
          evaluatedSkills,
          student.projects || [],
          student.certifications || [],
          student.assessments || []
        ),
      }));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/students/:id/projects - Manually add / update a project with URL and category
studentRouter.post(
  '/:id/projects',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, description, tools_used, url, category, start_date, end_date, is_current } = req.body;

      if (!title || !description) {
        res.status(400).json({
          error: { code: 'INVALID_INPUT', message: 'Project title and description are required' }
        });
        return;
      }

      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .or(`id.eq.${id},email.eq.${id}`)
        .single();

      if (error || !student) {
        throw new NotFoundError(`Candidate profile ${id} not found`);
      }

      let parsedTools: string[] = [];
      if (Array.isArray(tools_used)) {
        parsedTools = tools_used.map((t: any) => String(t).trim()).filter(Boolean);
      } else if (typeof tools_used === 'string') {
        parsedTools = tools_used.split(/[,•\n]+/).map((t) => t.trim()).filter(Boolean);
      }

      const newProject: ProjectItem = {
        title: title.trim(),
        description: description.trim(),
        tools_used: parsedTools,
        url: url ? String(url).trim() : undefined,
        category: category ? String(category).trim() : 'Engineering',
        start_date: start_date ? String(start_date).trim() : undefined,
        end_date: is_current ? 'Present' : (end_date ? String(end_date).trim() : undefined),
        is_current: Boolean(is_current || end_date === 'Present'),
      };

      const existingProjects: ProjectItem[] = student.projects || [];
      const updatedProjects = [newProject, ...existingProjects];

      // Re-evaluate candidate competency profile & radar
      const rawSkills = Array.from(new Set([...(student.parsed_skills || []), ...parsedTools]));
      const { evaluatedSkills } = await computeCandidateProfile({
        skills: rawSkills,
        projects: updatedProjects,
        ratings: (student.evaluated_skills || []).map((s: any) => ({
          skill: s.skill_name,
          domain: s.domain_track,
          depth: s.depth_score,
          tier: s.tier,
        })),
        certifications: student.certifications || [],
        assessments: student.assessments || [],
      });

      const radarChart = computeRadarMetrics(
        evaluatedSkills,
        updatedProjects,
        student.certifications || [],
        student.assessments || []
      );

      const { error: updateError } = await supabase
        .from('students')
        .update({
          parsed_skills: rawSkills,
          projects: updatedProjects,
          evaluated_skills: evaluatedSkills,
        })
        .eq('id', student.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      student.parsed_skills = rawSkills;
      student.projects = updatedProjects;
      student.evaluated_skills = evaluatedSkills;

      res.status(200).json(success({
        student: {
          ...student,
          has_resume: !!(student.resume_data || student.projects?.length),
          resume_url: `/api/students/${student.id}/resume`,
        },
        radar_chart: radarChart,
      }));
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/students/:id/projects/:index - Edit/Update an existing project
studentRouter.put(
  '/:id/projects/:index',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const idx = parseInt(String(req.params.index), 10);
      const { title, description, tools_used, url, category, start_date, end_date, is_current } = req.body;

      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .or(`id.eq.${id},email.eq.${id}`)
        .single();

      if (error || !student) {
        throw new NotFoundError(`Candidate profile ${id} not found`);
      }

      const existingProjects: ProjectItem[] = student.projects || [];
      if (isNaN(idx) || idx < 0 || idx >= existingProjects.length) {
        res.status(400).json({ error: { code: 'INVALID_INDEX', message: 'Invalid project index' } });
        return;
      }

      let parsedTools: string[] = [];
      if (Array.isArray(tools_used)) {
        parsedTools = tools_used.map((t: any) => String(t).trim()).filter(Boolean);
      } else if (typeof tools_used === 'string') {
        parsedTools = tools_used.split(/[,•\n]+/).map((t) => t.trim()).filter(Boolean);
      }

      existingProjects[idx] = {
        title: title ? title.trim() : existingProjects[idx].title,
        description: description ? description.trim() : existingProjects[idx].description,
        tools_used: parsedTools.length > 0 ? parsedTools : existingProjects[idx].tools_used,
        url: url !== undefined ? (url ? String(url).trim() : undefined) : existingProjects[idx].url,
        category: category ? String(category).trim() : existingProjects[idx].category || 'Engineering',
        start_date: start_date !== undefined ? (start_date ? String(start_date).trim() : undefined) : existingProjects[idx].start_date,
        end_date: is_current ? 'Present' : (end_date !== undefined ? (end_date ? String(end_date).trim() : undefined) : existingProjects[idx].end_date),
        is_current: is_current !== undefined ? Boolean(is_current) : existingProjects[idx].is_current,
      };

      const rawSkills = Array.from(new Set([...(student.parsed_skills || []), ...parsedTools]));
      const { evaluatedSkills } = await computeCandidateProfile({
        skills: rawSkills,
        projects: existingProjects,
        ratings: (student.evaluated_skills || []).map((s: any) => ({
          skill: s.skill_name,
          domain: s.domain_track,
          depth: s.depth_score,
          tier: s.tier,
        })),
        certifications: student.certifications || [],
        assessments: student.assessments || [],
      });

      const radarChart = computeRadarMetrics(
        evaluatedSkills,
        existingProjects,
        student.certifications || [],
        student.assessments || []
      );

      await supabase
        .from('students')
        .update({
          parsed_skills: rawSkills,
          projects: existingProjects,
          evaluated_skills: evaluatedSkills,
        })
        .eq('id', student.id);

      student.parsed_skills = rawSkills;
      student.projects = existingProjects;
      student.evaluated_skills = evaluatedSkills;

      res.status(200).json(success({
        student: {
          ...student,
          has_resume: !!(student.resume_data || student.projects?.length),
          resume_url: `/api/students/${student.id}/resume`,
        },
        radar_chart: radarChart,
      }));
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/students/:id/projects/:index - Delete a project by index
studentRouter.delete(
  '/:id/projects/:index',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const idx = parseInt(String(req.params.index), 10);

      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .or(`id.eq.${id},email.eq.${id}`)
        .single();

      if (error || !student) {
        throw new NotFoundError(`Candidate profile ${id} not found`);
      }

      const existingProjects: ProjectItem[] = student.projects || [];
      if (isNaN(idx) || idx < 0 || idx >= existingProjects.length) {
        res.status(400).json({ error: { code: 'INVALID_INDEX', message: 'Invalid project index' } });
        return;
      }

      existingProjects.splice(idx, 1);

      const { evaluatedSkills } = await computeCandidateProfile({
        skills: student.parsed_skills || [],
        projects: existingProjects,
        ratings: (student.evaluated_skills || []).map((s: any) => ({
          skill: s.skill_name,
          domain: s.domain_track,
          depth: s.depth_score,
          tier: s.tier,
        })),
        certifications: student.certifications || [],
        assessments: student.assessments || [],
      });

      const radarChart = computeRadarMetrics(
        evaluatedSkills,
        existingProjects,
        student.certifications || [],
        student.assessments || []
      );

      await supabase
        .from('students')
        .update({
          projects: existingProjects,
          evaluated_skills: evaluatedSkills,
        })
        .eq('id', student.id);

      student.projects = existingProjects;
      student.evaluated_skills = evaluatedSkills;

      res.status(200).json(success({
        student: {
          ...student,
          has_resume: !!(student.resume_data || student.projects?.length),
          resume_url: `/api/students/${student.id}/resume`,
        },
        radar_chart: radarChart,
      }));
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/students/:id/skills/:skillName - Delete a skill from candidate profile
studentRouter.delete(
  '/:id/skills/:skillName',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const skillName = String(req.params.skillName);
      const decodedSkill = decodeURIComponent(skillName).toLowerCase().trim();

      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .or(`id.eq.${id},email.eq.${id}`)
        .single();

      if (error || !student) {
        throw new NotFoundError(`Candidate profile ${id} not found`);
      }

      const updatedSkills = (student.parsed_skills || []).filter(
        (s: string) => s.toLowerCase().trim() !== decodedSkill
      );

      const { evaluatedSkills } = await computeCandidateProfile({
        skills: updatedSkills,
        projects: student.projects || [],
        ratings: (student.evaluated_skills || []).filter(
          (s: any) => s.skill_name.toLowerCase().trim() !== decodedSkill
        ).map((s: any) => ({
          skill: s.skill_name,
          domain: s.domain_track,
          depth: s.depth_score,
          tier: s.tier,
        })),
        certifications: student.certifications || [],
        assessments: student.assessments || [],
      });

      const radarChart = computeRadarMetrics(
        evaluatedSkills,
        student.projects || [],
        student.certifications || [],
        student.assessments || []
      );

      await supabase
        .from('students')
        .update({
          parsed_skills: updatedSkills,
          evaluated_skills: evaluatedSkills,
        })
        .eq('id', student.id);

      student.parsed_skills = updatedSkills;
      student.evaluated_skills = evaluatedSkills;

      res.status(200).json(success({
        student: {
          ...student,
          has_resume: !!(student.resume_data || student.projects?.length),
          resume_url: `/api/students/${student.id}/resume`,
        },
        radar_chart: radarChart,
      }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/students/:id/resume - View/Download candidate PDF resume (uploaded or dynamically generated vector PDF)
studentRouter.get(
  '/:id/resume',
  validate(studentIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .or(`id.eq.${id},email.eq.${id}`)
        .single();

      if (error || !student) {
        throw new NotFoundError(`Candidate profile ${id} not found`);
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (student.resume_data && student.resume_data.length > 1000) {
        const fileBuffer = Buffer.from(student.resume_data, 'base64');
        const filename = student.resume_filename || `${student.name.replace(/\s+/g, '_')}_Resume.pdf`;
        res.setHeader('Content-Type', student.resume_mimetype || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Length', fileBuffer.length);
        res.status(200).send(fileBuffer);
        return;
      }

      const radar = computeRadarMetrics(
        student.evaluated_skills || [],
        student.projects || [],
        student.certifications || [],
        student.assessments || []
      );
      const pdfBytes = await generateStudentResumePDF(student, radar);
      const filename = `${student.name.replace(/\s+/g, '_')}_Resume.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.status(200).send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/students/:id/public - Public unauthenticated candidate profile
studentRouter.get(
  '/:id/public',
  validate(studentIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .or(`id.eq.${id},email.eq.${id}`)
        .single();

      if (error || !student) {
        throw new NotFoundError(`Candidate profile ${id} not found`);
      }

      res.status(200).json(success({
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          degree: student.degree,
          parsed_skills: student.parsed_skills || [],
          projects: student.projects || [],
          certifications: student.certifications || [],
          assessments: student.assessments || [],
          evaluated_skills: student.evaluated_skills || [],
          has_resume: !!(student.resume_data || student.projects?.length),
          resume_url: `/api/students/${student.id}/resume`,
          created_at: student.created_at,
        },
        radar_chart: computeRadarMetrics(
          student.evaluated_skills || [],
          student.projects || [],
          student.certifications || [],
          student.assessments || []
        ),
        certifications: student.certifications || [],
        assessments: student.assessments || [],
        projects: student.projects || [],
        resume_url: `/api/students/${student.id}/resume`,
      }));
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/students/:id/profile - Authenticated / session candidate profile
studentRouter.get(
  '/:id/profile',
  validate(studentIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .or(`id.eq.${id},email.eq.${id}`)
        .single();

      if (error || !student) {
        throw new NotFoundError(`Student ${id} not found`);
      }

      // Institutional access guard: faculty shall not be given access outside their institution's students' data
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7).trim();
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'skillbridge-jwt-secret-key-2026') as any;
          if (decoded && decoded.role === 'faculty' && decoded.institution_or_company) {
            const facultyInst = decoded.institution_or_company.trim().toLowerCase();
            const studentInst = (student.institution || student.degree || '').toLowerCase();
            const tokens = facultyInst.split(/[\s,()/-]+/).filter((t: string) => t.length > 2 && !['and', 'the', 'for', 'institute', 'department', 'university', 'technology'].includes(t));
            const matches = studentInst.includes(facultyInst) || tokens.some((token: string) => studentInst.includes(token));
            if (!matches) {
              throw new ForbiddenError(`Access restricted: Candidate belongs to another institution and is outside your institutional scope (${decoded.institution_or_company}).`);
            }
          }
        } catch (authErr: any) {
          if (authErr instanceof ForbiddenError) throw authErr;
        }
      }

      res.status(200).json(success({
        student: {
          ...student,
          has_resume: !!(student.resume_data || student.projects?.length),
          resume_url: `/api/students/${student.id}/resume`,
        },
        radar_chart: computeRadarMetrics(
          student.evaluated_skills || [],
          student.projects || [],
          student.certifications || [],
          student.assessments || []
        ),
        certifications: student.certifications || [],
        assessments: student.assessments || [],
        projects: student.projects || [],
        resume_url: `/api/students/${student.id}/resume`,
      }));
    } catch (err) {
      next(err);
    }
  },
);
