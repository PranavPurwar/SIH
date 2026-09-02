import { embedBatch, type EmbedMode } from '../adapters/ollama.adapter.js';
import { EMBEDDING } from '../config/constants.js';
import type { ProjectItem, CourseItem } from '../types/index.js';

const BENCHMARK_ADVANCED = [
  'Production system with high scale, performance optimization, concurrency, distributed architecture, and fault tolerance.',
  'Low-level systems programming, operating system kernels, compilers, memory management, and virtualization.',
  'Advanced machine learning pipelines, deep neural networks, large language models, generative AI, and real-time inference.',
  'Complex front-end architectures, state management, real-time reactive UI, web assembly, and cross-platform mobile frameworks.',
];

const BENCHMARK_NOVICE =
  'Beginner tutorial project with basic setup, simple CRUD, and minimal configuration.';

let cachedBenchmarks: { adv: number[][]; nov: number[] } | null = null;

async function getBenchmarkVectors(): Promise<{ adv: number[][]; nov: number[] }> {
  if (!cachedBenchmarks) {
    const vectors = await embedBatch(
      [...BENCHMARK_ADVANCED, BENCHMARK_NOVICE],
      'document',
    );
    cachedBenchmarks = {
      adv: vectors.slice(0, BENCHMARK_ADVANCED.length),
      nov: vectors[BENCHMARK_ADVANCED.length],
    };
  }
  return cachedBenchmarks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function computeProjectDepth(
  projectVector: number[],
  advVectors: number[][],
  novVector: number[],
): number {
  const simAdv = Math.max(...advVectors.map((v) => cosineSimilarity(projectVector, v)));
  const simNov = cosineSimilarity(projectVector, novVector);
  const diff = simAdv - simNov;
  const raw = sigmoid((diff + 0.1) * EMBEDDING.CALIBRATION_FACTOR);
  return Math.min(0.98, Math.max(0.05, Number(raw.toFixed(3))));
}

export async function matchSkillsWithProjectsVector(
  projects: ProjectItem[],
  skills: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (skills.length === 0) return result;

  const { adv: advVectors, nov: novVector } = await getBenchmarkVectors();

  const projectTexts = projects.map(
    (p) => `${p.title}: ${p.description}. Tools: ${(p.tools_used || []).join(', ')}`,
  );
  const skillTexts = skills.map((s) => `Technical skill: ${s}`);

  const allVectors = await embedBatch(
    [...projectTexts, ...skillTexts],
    'document',
  );

  const projectVectors = allVectors.slice(0, projectTexts.length);
  const skillVectors = allVectors.slice(projectTexts.length);

  const projectLevels = projectVectors.map((pVec) =>
    computeProjectDepth(pVec, advVectors, novVector),
  );

  for (let i = 0; i < skills.length; i++) {
    const skillName = skills[i];
    const sVec = skillVectors[i];
    const skillKey = skillName.toLowerCase().trim();

    let maxSkillScore = 0;

    for (let j = 0; j < projects.length; j++) {
      const proj = projects[j];
      const pVec = projectVectors[j];
      const pLevel = projectLevels[j];

      const projectText =
        `${proj.title} ${proj.description} ${(proj.tools_used || []).join(' ')}`.toLowerCase();
      const explicitInProject = projectText.includes(skillKey);
      const semanticSim = cosineSimilarity(sVec, pVec);

      let effectiveScore = 0;
      if (explicitInProject) {
        effectiveScore = pLevel;
      } else if (semanticSim > 0.20) {
        const gate = sigmoid((semanticSim - 0.35) * 15);
        effectiveScore = pLevel * gate;
      }

      if (effectiveScore > maxSkillScore) {
        maxSkillScore = effectiveScore;
      }
    }

    const finalScore = maxSkillScore > 0.05 ? maxSkillScore : 0.15;
    result.set(skillKey, Number(finalScore.toFixed(3)));
  }

  return result;
}

export async function rankCoursesByVector(
  queryText: string,
  courses: CourseItem[],
): Promise<CourseItem[]> {
  if (!queryText.trim() || courses.length === 0) return courses;

  const courseTexts = courses.map(
    (c) =>
      `Course: ${c.title}. ${c.description || ''}. Domain: ${c.target_domain || ''}. Skills: ${(c.target_skills || []).join(', ')}`,
  );

  const [queryVectors, courseVectors] = await Promise.all([
    embedBatch([queryText], 'query'),
    embedBatch(courseTexts, 'document'),
  ]);

  const queryVector = queryVectors[0];

  const scored = courses.map((course, idx) => ({
    ...course,
    similarity: Number(cosineSimilarity(queryVector, courseVectors[idx]).toFixed(3)),
  }));

  return scored.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
}
