import { MATCHING } from '../config/constants.js';
import { embedBatch } from '../adapters/ollama.adapter.js';
import { cosineSimilarity } from './embedding.service.js';
import type {
  EvaluatedSkill,
  JobListing,
  MatchResult,
  MatchedSkillDetail,
} from '../types/index.js';
import { supabase } from '../db/connection.js';

const skillVectorCache = new Map<string, number[]>();
const SEMANTIC_MATCH_THRESHOLD = 0.88;

export async function ensureSkillsEmbedded(skills: string[]): Promise<void> {
  const missing = Array.from(
    new Set(
      skills
        .map((s) => s.toLowerCase().trim())
        .filter((k) => k && !skillVectorCache.has(k)),
    ),
  );

  if (missing.length === 0) return;

  const texts = missing.map((s) => `Skill: ${s}`);
  const vectors = await embedBatch(texts, 'document');

  for (let i = 0; i < missing.length; i++) {
    skillVectorCache.set(missing[i], vectors[i]);
  }
}

export async function prewarmSkillVectors(): Promise<void> {
  try {
    const [{ data: jobs }, { data: students }] = await Promise.all([
      supabase.from('jobs').select('required_skills'),
      supabase.from('students').select('evaluated_skills, parsed_skills'),
    ]);

    const allSkills = new Set<string>();
    (jobs || []).forEach((j: any) => {
      (j.required_skills || []).forEach((r: any) => {
        if (r.skill) allSkills.add(r.skill);
      });
    });
    (students || []).forEach((s: any) => {
      (s.evaluated_skills || []).forEach((e: any) => {
        if (e.skill_name) allSkills.add(e.skill_name);
      });
      (s.parsed_skills || []).forEach((p: string) => {
        if (p) allSkills.add(p);
      });
    });

    if (allSkills.size > 0) {
      await ensureSkillsEmbedded(Array.from(allSkills));
    }
  } catch {
    // Ignore cache warmup failures on startup
  }
}

export async function matchStudentWithJob(
  candidateProfile: EvaluatedSkill[],
  job: JobListing,
): Promise<MatchResult> {
  const required = job.required_skills || [];
  if (required.length === 0) {
    return {
      job_id: job.job_id,
      title: job.title,
      description: job.description,
      company: job.company,
      overall_match_pct: 0,
      qualified: false,
      matched_skills: [],
      missing_skills: [],
      recommended_courses: [],
    };
  }

  const allSkillNames = [
    ...required.map((r) => r.skill),
    ...candidateProfile.map((c) => c.skill_name),
  ];
  await ensureSkillsEmbedded(allSkillNames);

  const reqVecs = required.map((r) => skillVectorCache.get(r.skill.toLowerCase().trim())!);
  const candVecs = candidateProfile.map((c) => skillVectorCache.get(c.skill_name.toLowerCase().trim())!);

  const matchedSkills: MatchedSkillDetail[] = [];
  const missingSkills: string[] = [];
  let totalScore = 0;

  for (let i = 0; i < required.length; i++) {
    const req = required[i];
    const reqVec = reqVecs[i];
    const minDepth = req.min_depth || 0.5;
    const rLower = req.skill.toLowerCase().trim();

    let bestMatch: EvaluatedSkill | null = null;
    let maxSim = -1;

    for (let j = 0; j < candidateProfile.length; j++) {
      const cand = candidateProfile[j];
      const cLower = cand.skill_name.toLowerCase().trim();

      if (
        rLower === cLower ||
        (rLower.length > 2 && cLower.includes(rLower)) ||
        (cLower.length > 2 && rLower.includes(cLower))
      ) {
        maxSim = 1.0;
        bestMatch = cand;
        break;
      }

      const candVec = candVecs[j];
      if (reqVec && candVec) {
        const sim = cosineSimilarity(reqVec, candVec);
        if (sim > maxSim) {
          maxSim = sim;
          bestMatch = cand;
        }
      }
    }

    if (bestMatch && (maxSim >= SEMANTIC_MATCH_THRESHOLD || maxSim === 1.0)) {
      const candidateDepth = bestMatch.depth_score || 0.7;
      const ratio = Math.min(1.0, candidateDepth / minDepth);
      totalScore += ratio;

      let matchStatus: 'exceeds' | 'meets' | 'partial' = 'partial';
      if (candidateDepth >= minDepth * 1.1) {
        matchStatus = 'exceeds';
      } else if (candidateDepth >= minDepth) {
        matchStatus = 'meets';
      }

      matchedSkills.push({
        skill: req.skill,
        candidate_depth: candidateDepth,
        required_depth: minDepth,
        match_status: matchStatus,
      });
    } else {
      missingSkills.push(req.skill);
    }
  }

  const overallMatchPct = Math.round((totalScore / required.length) * 100);
  const qualified = overallMatchPct >= MATCHING.QUALIFICATION_THRESHOLD_PCT;

  return {
    job_id: job.job_id,
    title: job.title,
    description: job.description,
    company: job.company,
    overall_match_pct: overallMatchPct,
    qualified,
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
    recommended_courses: [],
  };
}

export async function findTopMatchingJobs(
  candidateProfile: EvaluatedSkill[],
  jobs: JobListing[],
  maxResults = 50,
): Promise<MatchResult[]> {
  const allSkills = [
    ...candidateProfile.map((c) => c.skill_name),
    ...jobs.flatMap((j) => (j.required_skills || []).map((r) => r.skill)),
  ];
  await ensureSkillsEmbedded(allSkills);

  const matches = await Promise.all(
    jobs.map((job) => matchStudentWithJob(candidateProfile, job)),
  );
  return matches
    .sort((a, b) => b.overall_match_pct - a.overall_match_pct)
    .slice(0, maxResults);
}

export async function findTopCandidatesForJob(
  job: JobListing,
  candidates: { id: string; name: string; evaluated_skills?: EvaluatedSkill[] }[],
  maxResults = 20,
): Promise<{ student_id: string; name: string; match: MatchResult }[]> {
  const allSkills = [
    ...(job.required_skills || []).map((r) => r.skill),
    ...candidates.flatMap((c) => (c.evaluated_skills || []).map((s) => s.skill_name)),
  ];
  await ensureSkillsEmbedded(allSkills);

  const scored = await Promise.all(
    candidates.map(async (c) => ({
      student_id: c.id,
      name: c.name,
      match: await matchStudentWithJob(c.evaluated_skills || [], job),
    })),
  );

  return scored
    .sort((a, b) => b.match.overall_match_pct - a.match.overall_match_pct)
    .slice(0, maxResults);
}
