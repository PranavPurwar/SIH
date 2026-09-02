import { PDFParse } from 'pdf-parse';
import { extractResumeData } from '../adapters/mistral.adapter.js';
import { computeCandidateProfile, type ProfileComputeInput } from './profile.service.js';
import { normalizeMany } from './skill-normalizer.service.js';
import { AppError } from '../lib/errors.js';
import type { StudentProfile, EvaluatedSkill } from '../types/index.js';

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

export interface ResumeProcessingResult {
  student: StudentProfile;
  evaluatedSkills: EvaluatedSkill[];
}

export function validatePdfBuffer(buffer: Buffer): void {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'Uploaded file is empty');
  }
  if (buffer.length > 5 * 1024 * 1024) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'File exceeds 5MB limit');
  }
  if (!buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new AppError(400, 'INVALID_PDF', 'File is not a valid PDF document');
  }
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    return data.text;
  } catch {
    throw new AppError(422, 'PDF_PARSE_ERROR', 'Could not parse text from PDF file');
  }
}

export async function processResume(
  buffer: Buffer,
  studentId: string,
): Promise<ResumeProcessingResult> {
  validatePdfBuffer(buffer);
  const rawText = await extractTextFromPDF(buffer);
  const parsed = await extractResumeData(rawText);

  const normalizedSkills = normalizeMany(parsed.skills);
  const skillNames = normalizedSkills.map((s) => s.canonicalName);

  const profileInput: ProfileComputeInput = {
    skills: skillNames,
    projects: parsed.projects,
    ratings: parsed.ratings,
    certifications: parsed.certifications,
    assessments: [],
  };

  const { evaluatedSkills } = await computeCandidateProfile(profileInput);

  const student: StudentProfile = {
    id: studentId,
    name: parsed.name,
    email: parsed.email,
    degree: parsed.degree,
    parsed_skills: skillNames,
    projects: parsed.projects,
    certifications: parsed.certifications,
    assessments: [],
    evaluated_skills: evaluatedSkills,
  };

  return { student, evaluatedSkills };
}
