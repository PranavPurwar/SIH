import { pgPool } from '../db/connection.js';
import { AppError } from '../lib/errors.js';

export interface FacultyProgram {
  id: string;
  title: string;
  organization: string;
  type: 'FDP' | 'Faculty Internship' | 'Industrial Training' | 'Research Grant' | 'Consultancy';
  description: string;
  domain: string;
  stipend_grant?: string;
  duration?: string;
  deadline?: string;
  eligibility?: string;
}

export interface FacultyApplication {
  id: string;
  program_id: string;
  faculty_name: string;
  faculty_email: string;
  institution: string;
  proposal_summary?: string;
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Completed';
  applied_at: string;
  program?: FacultyProgram;
}

export async function getFacultyPrograms(filter?: { type?: string; domain?: string }): Promise<FacultyProgram[]> {
  try {
    let query = `SELECT * FROM faculty_programs WHERE 1=1`;
    const params: any[] = [];

    if (filter?.type && filter.type !== 'All') {
      params.push(filter.type);
      query += ` AND type = $${params.length}`;
    }
    if (filter?.domain) {
      params.push(`%${filter.domain}%`);
      query += ` AND domain ILIKE $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;
    const { rows } = await pgPool.query(query, params);
    return rows;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve faculty programs');
  }
}

export async function applyFacultyProgram(payload: {
  program_id: string;
  faculty_name: string;
  faculty_email: string;
  institution: string;
  proposal_summary?: string;
}): Promise<FacultyApplication> {
  try {
    const query = `
      INSERT INTO faculty_applications (program_id, faculty_name, faculty_email, institution, proposal_summary, status)
      VALUES ($1, $2, $3, $4, $5, 'Submitted')
      RETURNING *;
    `;
    const { rows } = await pgPool.query(query, [
      payload.program_id,
      payload.faculty_name,
      payload.faculty_email,
      payload.institution,
      payload.proposal_summary || null,
    ]);
    return rows[0];
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to submit faculty application: ' + error.message);
  }
}

export async function getFacultyApplications(facultyEmail: string): Promise<FacultyApplication[]> {
  try {
    const query = `
      SELECT 
        fa.id, fa.program_id, fa.faculty_name, fa.faculty_email, fa.institution, fa.proposal_summary, fa.status, fa.applied_at,
        json_build_object(
          'id', fp.id,
          'title', fp.title,
          'organization', fp.organization,
          'type', fp.type,
          'stipend_grant', fp.stipend_grant
        ) as program
      FROM faculty_applications fa
      LEFT JOIN faculty_programs fp ON fa.program_id = fp.id
      WHERE fa.faculty_email = $1
      ORDER BY fa.applied_at DESC;
    `;
    const { rows } = await pgPool.query(query, [facultyEmail]);
    return rows;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve faculty applications');
  }
}
