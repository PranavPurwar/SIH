import { SCORE_THRESHOLDS, SCORING_WEIGHTS } from '../config/constants.js';
import { matchSkillsWithProjectsVector } from './embedding.service.js';
import { normalize } from './skill-normalizer.service.js';
import type {
  EvaluatedSkill,
  ProjectItem,
  SkillRating,
  SkillTier,
  CertificationItem,
  AssessmentRecord,
  RadarChartMetric,
  ScoringBreakdown,
} from '../types/index.js';

function getTier(score: number): SkillTier {
  if (score >= SCORE_THRESHOLDS.ADVANCED_MIN) return 'Advanced';
  if (score >= SCORE_THRESHOLDS.NOVICE_MAX) return 'Intermediate';
  return 'Novice';
}

function clampScore(val: number): number {
  return Math.min(1.0, Math.max(0.0, val));
}

export interface ProfileComputeInput {
  skills: string[];
  projects: ProjectItem[];
  ratings: SkillRating[];
  certifications?: CertificationItem[];
  assessments?: AssessmentRecord[];
}

export interface ProfileComputeResult {
  evaluatedSkills: EvaluatedSkill[];
  breakdowns: Map<string, ScoringBreakdown>;
}

export async function computeCandidateProfile(
  input: ProfileComputeInput,
): Promise<ProfileComputeResult> {
  const { skills, projects, ratings, certifications = [], assessments = [] } = input;

  const extractionMap = new Map<string, SkillRating>();
  for (const r of ratings) {
    const norm = normalize(r.skill);
    extractionMap.set(norm.canonicalId, r);
  }

  const projectTools = projects.flatMap((p) => p.tools_used || []);
  const uniqueSkills = Array.from(
    new Set(
      [...skills, ...ratings.map((r) => r.skill), ...projectTools]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );

  const vectorScores = await matchSkillsWithProjectsVector(projects, uniqueSkills);

  const certNames = new Set(
    certifications.map((c) => c.name.toLowerCase().trim()),
  );

  const assessmentMap = new Map<string, number>();
  for (const a of assessments) {
    const rawScore = a.score || ((a.score_pct || 0) / 100);
    const skillsToMap = [a.skill_name, a.title, ...(a.target_skills || [])].filter(Boolean) as string[];
    for (const sk of skillsToMap) {
      const key = normalize(sk).canonicalId;
      const existing = assessmentMap.get(key) ?? 0;
      if (rawScore > existing) {
        assessmentMap.set(key, rawScore);
      }
    }
  }

  const results: EvaluatedSkill[] = [];
  const breakdowns = new Map<string, ScoringBreakdown>();

  for (const rawSkill of uniqueSkills) {
    const norm = normalize(rawSkill);
    const key = norm.canonicalId;
    const extracted = extractionMap.get(key);

    const rawExtraction = extracted ? extracted.depth : 0;
    const extractionScore = clampScore(rawExtraction);

    const vectorScore = vectorScores.get(rawSkill.toLowerCase().trim())
      ?? SCORING_WEIGHTS.UNMATCHED_SKILL_DEFAULT;

    const hasCert = Array.from(certNames).some((certLower) => {
      return (
        certLower.includes(rawSkill.toLowerCase()) ||
        key.split(/[\s-]+/).some((part) => certLower.includes(part))
      );
    });
    const certBonus = hasCert ? 1.0 : 0.0;

    const assessmentScore = assessmentMap.get(key) ?? 0;

    let activeWeightSum = SCORING_WEIGHTS.EXTRACTION_WEIGHT + SCORING_WEIGHTS.VECTOR_WEIGHT;
    if (certBonus > 0) activeWeightSum += SCORING_WEIGHTS.CERTIFICATION_WEIGHT;
    if (assessmentScore > 0) activeWeightSum += SCORING_WEIGHTS.ASSESSMENT_WEIGHT;

    const rawFinalScore =
      SCORING_WEIGHTS.EXTRACTION_WEIGHT * extractionScore +
      SCORING_WEIGHTS.VECTOR_WEIGHT * vectorScore +
      SCORING_WEIGHTS.CERTIFICATION_WEIGHT * certBonus +
      SCORING_WEIGHTS.ASSESSMENT_WEIGHT * assessmentScore;

    const finalScore = Number((rawFinalScore / activeWeightSum).toFixed(3));
    const clampedFinal = clampScore(finalScore);

    results.push({
      skill_name: norm.canonicalName || rawSkill,
      domain_track: norm.domain || (extracted?.domain ?? resolveSkillPillar(rawSkill)),
      depth_score: clampedFinal,
      tier: getTier(clampedFinal),
      matched_signatures: [],
    });

    breakdowns.set(key, {
      llmScore: extractionScore,
      vectorScore,
      certificationBonus: certBonus,
      assessmentScore,
      finalScore: clampedFinal,
      weights: {
        llm: SCORING_WEIGHTS.EXTRACTION_WEIGHT,
        vector: SCORING_WEIGHTS.VECTOR_WEIGHT,
        cert: SCORING_WEIGHTS.CERTIFICATION_WEIGHT,
        assessment: SCORING_WEIGHTS.ASSESSMENT_WEIGHT,
      },
    });
  }

  results.sort((a, b) => b.depth_score - a.depth_score);
  return { evaluatedSkills: results, breakdowns };
}

const PILLAR_KEYWORDS: Record<string, string[]> = {
  'Systems & Infrastructure': [
    'go', 'distributed systems', 'kubernetes', 'docker', 'linux', 'c', 'c++',
    'grpc', 'operating systems', 'rust', 'aws', 'gcp', 'cloud', 'webgl', 'gpu',
    'websockets', 'ebpf', 'kernel', 'concurrency', 'multithreading',
    'compiler', 'compilers', 'runtime', 'sandboxing', 'virtualization'
  ],
  'AI & Machine Learning': [
    'python', 'pytorch', 'transformers', 'cuda', 'machine learning',
    'tensorflow', 'deep learning', 'nlp', 'computer vision', 'rag', 'graphrag',
    'fine-tuning', 'huggingface'
  ],
  'Web & Frontend': [
    'typescript', 'node.js', 'react', 'vue', 'javascript', 'graphql',
    'tailwind css', 'webassembly', 'next.js', 'html', 'css', 'frontend', 'ui',
    'design system', 'canvas', 'vite', 'webpack', 'svelte', 'rest api'
  ],
  'Data & Vector Storage': [
    'postgresql', 'pgvector', 'sql', 'redis', 'kafka', 'snowflake',
    'databricks', 'database', 'mongodb', 'elasticsearch', 'spark', 'vector database',
    'sqlite', 'neo4j', 'cosine similarity'
  ],
  'Algorithms & Core CS': [
    'algorithms', 'data structures', 'cybersecurity', 'cryptography',
    'security', 'graph theory', 'dynamic programming'
  ]
};

function resolveSkillPillar(skillName: string, domainTrack?: string): string {
  if (domainTrack && Object.keys(PILLAR_KEYWORDS).includes(domainTrack)) {
    return domainTrack;
  }

  const sLower = skillName.toLowerCase().trim();

  for (const [pillar, keywords] of Object.entries(PILLAR_KEYWORDS)) {
    if (keywords.some((k) => sLower === k || (k.length > 2 && sLower.includes(k)))) {
      return pillar;
    }
  }

  if (domainTrack && !domainTrack.includes(' / ') && domainTrack.length < 25 && domainTrack !== 'General') {
    return domainTrack;
  }

  return 'Algorithms & Core CS';
}

export function computeRadarMetrics(
  evaluatedSkills: EvaluatedSkill[] = [],
  projects: ProjectItem[] = [],
  certifications: CertificationItem[] = [],
  assessments: AssessmentRecord[] = []
): RadarChartMetric[] {
  const directSkillsMap = new Map<string, number[]>();
  const supplementaryMap = new Map<string, number[]>();

  for (const item of evaluatedSkills) {
    const pillar = resolveSkillPillar(item.skill_name, item.domain_track);
    const scores = directSkillsMap.get(pillar) || [];
    scores.push((item.depth_score || 0) * 100);
    directSkillsMap.set(pillar, scores);
  }

  for (const proj of projects) {
    const allText = `${proj.title} ${proj.description} ${(proj.tools_used || []).join(' ')}`.toLowerCase();
    
    for (const tool of proj.tools_used || []) {
      const pillar = resolveSkillPillar(tool);
      const scores = supplementaryMap.get(pillar) || [];
      scores.push(85);
      supplementaryMap.set(pillar, scores);
    }
    
    for (const [pillar, keywords] of Object.entries(PILLAR_KEYWORDS)) {
      if (keywords.some((k) => k.length > 3 && allText.includes(k))) {
        const scores = supplementaryMap.get(pillar) || [];
        scores.push(85);
        supplementaryMap.set(pillar, scores);
      }
    }
  }

  for (const asmt of assessments) {
    if (asmt.passed && asmt.score_pct) {
      const asmtText = `${asmt.code} ${asmt.title} ${(asmt.target_skills || []).join(' ')}`.toLowerCase();
      for (const [pillar, keywords] of Object.entries(PILLAR_KEYWORDS)) {
        if (keywords.some((k) => k.length > 3 && asmtText.includes(k))) {
          const scores = supplementaryMap.get(pillar) || [];
          scores.push(asmt.score_pct);
          supplementaryMap.set(pillar, scores);
        }
      }
    }
  }

  for (const cert of certifications) {
    const certText = `${cert.name} ${cert.issuer || ''}`.toLowerCase();
    for (const [pillar, keywords] of Object.entries(PILLAR_KEYWORDS)) {
      if (keywords.some((k) => k.length > 3 && certText.includes(k))) {
        const scores = supplementaryMap.get(pillar) || [];
        scores.push(88);
        supplementaryMap.set(pillar, scores);
      }
    }
  }

  const standardPillars = [
    'Systems & Infrastructure',
    'AI & Machine Learning',
    'Web & Frontend',
    'Data & Vector Storage',
    'Algorithms & Core CS'
  ];

  return standardPillars.map((pillar) => {
    const directSkillScores = directSkillsMap.get(pillar) || [];
    const supplementaryScores = supplementaryMap.get(pillar) || [];

    if (directSkillScores.length === 0 && supplementaryScores.length === 0) {
      return {
        domain: pillar,
        score: 10,
        skill_count: 0,
      };
    }

    let finalScore = 10;
    if (directSkillScores.length > 0) {
      const sorted = [...directSkillScores].sort((a, b) => b - a);
      const topScore = sorted[0];
      const avg = directSkillScores.reduce((a, b) => a + b, 0) / directSkillScores.length;
      finalScore = Math.round(0.70 * topScore + 0.30 * avg);
      if (topScore === 100 && avg >= 96) {
        finalScore = 100;
      }
    } else if (supplementaryScores.length > 0) {
      const avg = supplementaryScores.reduce((a, b) => a + b, 0) / supplementaryScores.length;
      finalScore = Math.round(avg);
    }

    return {
      domain: pillar,
      score: Math.min(100, Math.max(10, finalScore)),
      skill_count: directSkillScores.length > 0 ? directSkillScores.length : supplementaryScores.length,
    };
  });
}
