import { pgPool } from '../db/connection.js';
import { AppError } from '../lib/errors.js';

export interface LearningProgram {
  id: string;
  title: string;
  company: string;
  type: 'Workshop' | 'Certification Course' | 'Mentorship' | 'Innovation Challenge' | 'Live Project';
  description: string;
  target_skills: string[];
  duration?: string;
  mode?: 'Virtual' | 'Hybrid' | 'In-Person';
  stipend_or_perk?: string;
  created_at?: string;
}

export async function getLearningPrograms(type?: string): Promise<LearningProgram[]> {
  try {
    let query = `SELECT * FROM learning_programs WHERE 1=1`;
    const params: any[] = [];

    if (type && type !== 'All') {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;
    const { rows } = await pgPool.query(query, params);
    return rows;
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve learning programs');
  }
}

export async function createLearningProgram(payload: Partial<LearningProgram>): Promise<LearningProgram> {
  try {
    const id = payload.id || `learn-${Date.now().toString(36)}`;
    const query = `
      INSERT INTO learning_programs (id, title, company, type, description, target_skills, duration, mode, stipend_or_perk)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const { rows } = await pgPool.query(query, [
      id,
      payload.title,
      payload.company,
      payload.type || 'Workshop',
      payload.description,
      JSON.stringify(payload.target_skills || []),
      payload.duration || null,
      payload.mode || 'Virtual',
      payload.stipend_or_perk || null,
    ]);
    return rows[0];
  } catch (error: any) {
    throw new AppError(500, 'DB_ERROR', 'Failed to create learning program: ' + error.message);
  }
}
