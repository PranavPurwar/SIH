import { pgPool } from '../db/connection.js';
import { NotFoundError, AppError } from '../lib/errors.js';

export interface ApplicationRecord {
  id: string;
  student_id: string;
  job_id: string;
  match_pct: number;
  status: 'Applied' | 'Under Review' | 'Shortlisted' | 'Selected' | 'Rejected';
  notes?: string;
  applied_at: string;
  updated_at: string;
  job?: any;
  student?: any;
}

export async function submitApplication(
  studentId: string,
  jobId: string,
  matchPct = 0,
  notes?: string,
): Promise<ApplicationRecord> {
  try {
    const query = `
      INSERT INTO applications (student_id, job_id, match_pct, status, notes, updated_at)
      VALUES ($1, $2, $3, 'Applied', $4, NOW())
      ON CONFLICT (student_id, job_id) DO UPDATE SET
        match_pct = EXCLUDED.match_pct,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *;
    `;
    const { rows } = await pgPool.query(query, [studentId, jobId, matchPct, notes || null]);
    return rows[0];
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to submit application: ' + error.message);
  }
}

export async function getStudentApplications(studentId: string): Promise<ApplicationRecord[]> {
  try {
    const query = `
      SELECT 
        a.id, a.student_id, a.job_id, a.match_pct, a.status, a.notes, a.applied_at, a.updated_at,
        j.title as job_title,
        j.company as company,
        json_build_object(
          'job_id', j.job_id,
          'title', j.title,
          'company', j.company,
          'stipend', j.stipend,
          'eligibility', j.eligibility
        ) as job
      FROM applications a
      LEFT JOIN jobs j ON a.job_id = j.job_id
      WHERE a.student_id = $1
      ORDER BY a.applied_at DESC;
    `;
    const { rows } = await pgPool.query(query, [studentId]);
    return rows;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve applications');
  }
}

export async function getAllApplications(): Promise<ApplicationRecord[]> {
  try {
    const query = `
      SELECT 
        a.id, a.student_id, a.job_id, a.match_pct, a.status, a.notes, a.applied_at, a.updated_at,
        j.title as job_title,
        j.company as company,
        json_build_object(
          'job_id', j.job_id,
          'title', j.title,
          'company', j.company,
          'stipend', j.stipend,
          'eligibility', j.eligibility
        ) as job,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'email', s.email,
          'degree', s.degree,
          'parsed_skills', s.parsed_skills,
          'evaluated_skills', s.evaluated_skills
        ) as student
      FROM applications a
      LEFT JOIN jobs j ON a.job_id = j.job_id
      LEFT JOIN students s ON a.student_id = s.id
      ORDER BY a.updated_at DESC, a.match_pct DESC;
    `;
    const { rows } = await pgPool.query(query);
    return rows;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve applications');
  }
}

export async function getJobApplicants(jobId: string): Promise<ApplicationRecord[]> {
  try {
    const query = `
      SELECT 
        a.id, a.student_id, a.job_id, a.match_pct, a.status, a.notes, a.applied_at, a.updated_at,
        json_build_object(
          'id', s.id,
          'name', s.name,
          'email', s.email,
          'degree', s.degree,
          'parsed_skills', s.parsed_skills,
          'evaluated_skills', s.evaluated_skills
        ) as student
      FROM applications a
      LEFT JOIN students s ON a.student_id = s.id
      WHERE a.job_id = $1
      ORDER BY a.match_pct DESC;
    `;
    const { rows } = await pgPool.query(query, [jobId]);
    return rows;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve applicants');
  }
}

export async function updateApplicationStatus(
  applicationId: string,
  status: 'Applied' | 'Under Review' | 'Shortlisted' | 'Selected' | 'Rejected',
  notes?: string,
): Promise<ApplicationRecord> {
  try {
    const query = `
      UPDATE applications
      SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await pgPool.query(query, [status, notes || null, applicationId]);
    if (rows.length === 0) {
      throw new NotFoundError(`Application ${applicationId} not found`);
    }
    return rows[0];
  } catch (error: any) {
    if (error instanceof NotFoundError) throw error;
    throw new AppError(500, 'DB_ERROR', 'Failed to update application status');
  }
}
