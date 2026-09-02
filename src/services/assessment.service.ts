import crypto from 'crypto';
import { supabase } from '../db/connection.js';
import { createChildLogger } from '../lib/logger.js';
import { NotFoundError, AppError } from '../lib/errors.js';
import type {
  AssessmentSuite,
  AssessmentSuiteResult,
  SkillTier,
  EvaluatedSkill
} from '../types/index.js';
import type {
  CreateAssessmentSuiteInput,
  SubmitAssessmentSuiteInput
} from '../schemas/assessment.schema.js';

const logger = createChildLogger('AssessmentService');

export async function getAllAssessmentSuites(filter?: {
  q?: string;
  institution?: string;
  role?: string;
  difficulty?: string;
}): Promise<AssessmentSuite[]> {
  try {
    let query = supabase.from('assessments').select('*').order('created_at', { ascending: false });

    if (filter?.institution?.trim()) {
      query = query.ilike('institution', `%${filter.institution.trim()}%`);
    }

    if (filter?.role?.trim()) {
      query = query.ilike('target_role', `%${filter.role.trim()}%`);
    }

    if (filter?.difficulty?.trim() && filter.difficulty.toLowerCase() !== 'all') {
      const diff = filter.difficulty.trim();
      if (diff.toLowerCase() === 'beginner' || diff.toLowerCase() === 'novice') {
        query = query.or('difficulty.ilike.Beginner,difficulty.ilike.Novice');
      } else {
        query = query.ilike('difficulty', `%${diff}%`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    let suites: AssessmentSuite[] = (data || []).map(mapAssessmentSuiteRow);

    if (filter?.q?.trim()) {
      const q = filter.q.trim().toLowerCase();
      suites = suites.filter((s) =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q) ||
        (s.institution || '').toLowerCase().includes(q) ||
        (s.target_role || '').toLowerCase().includes(q) ||
        (s.target_skills || []).some((sk) => sk.toLowerCase().includes(q))
      );
    }

    return suites;
  } catch (err: any) {
    logger.error({ error: err }, 'Failed to fetch assessments');
    throw new AppError(500, 'DB_ERROR', 'Failed to retrieve assessment suites');
  }
}

export async function getAssessmentSuiteById(idOrCode: string): Promise<AssessmentSuite> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .or(`assessment_id.eq.${idOrCode},code.eq.${idOrCode.toUpperCase()}`)
    .single();

  if (error || !data) {
    throw new NotFoundError(`Assessment suite ${idOrCode} not found`);
  }

  return mapAssessmentSuiteRow(data);
}

export async function createAssessmentSuite(
  data: CreateAssessmentSuiteInput
): Promise<AssessmentSuite> {
  const assessmentId = data.assessment_id || `asmt-${data.code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${crypto.randomUUID().slice(0, 6)}`;

  const mappedDifficulty: SkillTier =
    data.difficulty === 'Beginner' ? 'Novice' : (data.difficulty as SkillTier);

  const questions = data.questions.map((q, idx) => ({
    question_id: q.question_id || `${assessmentId}-q${idx + 1}`,
    question_text: q.question_text.trim(),
    options: q.options,
    correct_option: q.correct_option,
    difficulty: (q.difficulty === 'Beginner' ? 'Novice' : q.difficulty) as SkillTier || mappedDifficulty,
    explanation: q.explanation || 'Verified assessment item.'
  }));

  const newSuite: AssessmentSuite = {
    assessment_id: assessmentId,
    code: data.code.trim().toUpperCase(),
    title: data.title.trim(),
    description: data.description.trim(),
    institution: data.institution.trim(),
    target_role: data.target_role.trim(),
    target_skills: data.target_skills,
    difficulty: mappedDifficulty,
    duration_minutes: data.duration_minutes || 30,
    questions
  };

  const { error } = await supabase.from('assessments').insert({
    assessment_id: newSuite.assessment_id,
    code: newSuite.code,
    title: newSuite.title,
    description: newSuite.description,
    institution: newSuite.institution,
    target_role: newSuite.target_role,
    target_skills: newSuite.target_skills,
    difficulty: newSuite.difficulty,
    duration_minutes: newSuite.duration_minutes,
    questions: newSuite.questions,
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw new AppError(500, 'DB_ERROR', `Failed to create assessment: ${error.message}`);
  }

  return newSuite;
}

export async function updateAssessmentSuite(
  idOrCode: string,
  data: Partial<CreateAssessmentSuiteInput>
): Promise<AssessmentSuite> {
  const existing = await getAssessmentSuiteById(idOrCode);
  const targetId = existing.assessment_id;

  const mappedDifficulty: SkillTier = data.difficulty
    ? (data.difficulty === 'Beginner' ? 'Novice' : (data.difficulty as SkillTier))
    : existing.difficulty;

  const questions = data.questions
    ? data.questions.map((q, idx) => ({
        question_id: q.question_id || `${targetId}-q${idx + 1}`,
        question_text: q.question_text.trim(),
        options: q.options,
        correct_option: q.correct_option,
        difficulty: (q.difficulty === 'Beginner' ? 'Novice' : q.difficulty) as SkillTier || mappedDifficulty,
        explanation: q.explanation || 'Verified assessment item.'
      }))
    : existing.questions;

  const updatedSuite: AssessmentSuite = {
    assessment_id: targetId,
    code: data.code ? data.code.trim().toUpperCase() : existing.code,
    title: data.title ? data.title.trim() : existing.title,
    description: data.description !== undefined ? data.description.trim() : existing.description,
    institution: data.institution ? data.institution.trim() : existing.institution,
    target_role: data.target_role ? data.target_role.trim() : existing.target_role,
    target_skills: data.target_skills || existing.target_skills,
    difficulty: mappedDifficulty,
    duration_minutes: data.duration_minutes || existing.duration_minutes,
    questions
  };

  const { error } = await supabase
    .from('assessments')
    .update({
      code: updatedSuite.code,
      title: updatedSuite.title,
      description: updatedSuite.description,
      institution: updatedSuite.institution,
      target_role: updatedSuite.target_role,
      target_skills: updatedSuite.target_skills,
      difficulty: updatedSuite.difficulty,
      duration_minutes: updatedSuite.duration_minutes,
      questions: updatedSuite.questions,
      updated_at: new Date().toISOString()
    })
    .eq('assessment_id', targetId);

  if (error) {
    throw new AppError(500, 'DB_ERROR', `Failed to update assessment: ${error.message}`);
  }

  return updatedSuite;
}

export async function gradeAssessmentSuite(
  submission: SubmitAssessmentSuiteInput
): Promise<AssessmentSuiteResult> {
  const suite = await getAssessmentSuiteById(submission.assessment_id);

  let correctCount = 0;
  const questionResults = suite.questions.map((q) => {
    const userAns = submission.answers.find((a) => a.question_id === q.question_id);
    const selectedOption = userAns ? Number(userAns.selected_option) : -1;
    const isCorrect = selectedOption === Number(q.correct_option);
    if (isCorrect) correctCount++;

    return {
      question_id: q.question_id,
      is_correct: isCorrect,
      correct_option: Number(q.correct_option),
      selected_option: selectedOption
    };
  });

  const totalQuestions = suite.questions.length;
  const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = scorePct >= 65;
  const updatedTier: SkillTier = passed ? suite.difficulty : 'Novice';

  try {
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('id', submission.student_id)
      .single();

    if (student) {
      const currentAssessments: any[] = Array.isArray(student.assessments) ? [...student.assessments] : [];
      const asmtIdx = currentAssessments.findIndex(
        (a) => a.assessment_id === suite.assessment_id || a.code === suite.code
      );

      const asmtEntry = {
        assessment_id: suite.assessment_id,
        code: suite.code,
        title: suite.title,
        institution: suite.institution,
        score: scorePct / 100,
        score_pct: scorePct,
        passed,
        tier: updatedTier,
        completed_at: new Date().toISOString(),
        target_skills: suite.target_skills,
      };

      if (asmtIdx >= 0) {
        currentAssessments[asmtIdx] = asmtEntry;
      } else {
        currentAssessments.push(asmtEntry);
      }

      const currentCerts: any[] = Array.isArray(student.certifications) ? [...student.certifications] : [];
      if (passed) {
        const certTitle = `${suite.title} (${suite.code})`;
        const certIdx = currentCerts.findIndex(
          (c) => (c.name || c.title) === certTitle || c.credential_id?.includes(suite.code)
        );

        const certEntry = {
          name: certTitle,
          issuer: suite.institution,
          date: new Date().toISOString().split('T')[0],
          score: `${scorePct}%`,
          credential_id: `CERT-${suite.code}-${submission.student_id.slice(-4)}-${Date.now().toString(36).toUpperCase()}`,
        };

        if (certIdx >= 0) {
          currentCerts[certIdx] = certEntry;
        } else {
          currentCerts.push(certEntry);
        }
      }

      const currentSkills: EvaluatedSkill[] = Array.isArray(student.evaluated_skills)
        ? [...student.evaluated_skills]
        : [];

      for (const targetSkill of suite.target_skills) {
        const sIdx = currentSkills.findIndex(
          (s) => s.skill_name.toLowerCase() === targetSkill.toLowerCase()
        );
        const calibratedScore = Math.max(0.65, Number((scorePct / 100).toFixed(2)));

        if (sIdx >= 0) {
          currentSkills[sIdx].depth_score = Math.max(currentSkills[sIdx].depth_score, calibratedScore);
          if (passed) currentSkills[sIdx].tier = updatedTier;
        } else {
          currentSkills.push({
            skill_name: targetSkill,
            domain_track: suite.target_role || 'Engineering',
            depth_score: calibratedScore,
            tier: updatedTier,
            matched_signatures: [],
          });
        }
      }

      await supabase
        .from('students')
        .update({
          assessments: currentAssessments,
          certifications: currentCerts,
          evaluated_skills: currentSkills,
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.student_id);
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to persist assessment to student profile');
  }

  const feedback = passed
    ? `Score: ${scorePct}%. Passed ${suite.code} evaluation.`
    : `Score: ${scorePct}%. Passing grade is 65%.`;

  return {
    assessment_id: suite.assessment_id,
    total_questions: totalQuestions,
    correct_answers: correctCount,
    score_pct: scorePct,
    passed,
    updated_tier: updatedTier,
    feedback,
    question_results: questionResults
  };
}

function mapAssessmentSuiteRow(row: any): AssessmentSuite {
  return {
    assessment_id: row.assessment_id,
    code: row.code,
    title: row.title,
    description: row.description || '',
    institution: row.institution,
    target_role: row.target_role,
    target_skills: Array.isArray(row.target_skills) ? row.target_skills : (typeof row.target_skills === 'string' ? JSON.parse(row.target_skills) : []),
    difficulty: row.difficulty || 'Intermediate',
    duration_minutes: Number(row.duration_minutes) || 30,
    questions: Array.isArray(row.questions) ? row.questions : (typeof row.questions === 'string' ? JSON.parse(row.questions) : [])
  };
}
