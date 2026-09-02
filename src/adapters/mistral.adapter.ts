import { Mistral } from '@mistralai/mistralai';
import { z } from 'zod';
import { createCircuitBreaker } from '../lib/circuit-breaker.js';
import { createChildLogger } from '../lib/logger.js';
import { ExternalServiceError } from '../lib/errors.js';
import { env } from '../config/env.js';
import type { CertificationItem, ProjectItem, SkillRating } from '../types/index.js';

const logger = createChildLogger('MistralAdapter');

const ResumeOutputSchema = z.object({
  name: z.string().default('Unknown'),
  email: z.string().default(''),
  degree: z.string().default(''),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string(),
    issue_date: z.string().optional(),
  })).default([]),
  projects: z.array(z.object({
    title: z.string(),
    description: z.string(),
    tools_used: z.array(z.string()).default([]),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })).default([]),
  ratings: z.array(z.object({
    skill: z.string(),
    domain: z.string(),
    depth: z.number().min(0).max(1),
    tier: z.enum(['Novice', 'Intermediate', 'Advanced']),
    confidence: z.number().min(0).max(1).optional().default(0.7),
  })).default([]),
});

type ResumeOutput = z.infer<typeof ResumeOutputSchema>;

export interface ParsedResumeResult {
  name: string;
  email: string;
  degree: string;
  certifications: CertificationItem[];
  rawText: string;
  skills: string[];
  projects: ProjectItem[];
  ratings: SkillRating[];
}

const SYSTEM_PROMPT = `You are a technical resume parser. Extract structured profile data from the text in <resume> tags.

Rules:
1. Extract only explicitly stated information.
2. Certifications: Include only formal credentials, exams, or certifications.
3. Projects: Capture technical projects and tools used.
4. Ratings: Rate depth 0.0 to 1.0 based on technical complexity (0.3-0.5 beginner, 0.5-0.7 intermediate, 0.7-1.0 advanced).
5. Output valid JSON matching the schema.`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rawExtractResume(rawText: string): Promise<ResumeOutput> {
  const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });

  const response = await client.chat.complete({
    model: 'mistral-small-latest',
    temperature: 0.1,
    responseFormat: {
      type: 'json_schema' as const,
      jsonSchema: {
        name: 'ResumeData',
        strict: true,
        schemaDefinition: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            degree: { type: 'string' },
            certifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  issuer: { type: 'string' },
                  issue_date: { type: 'string' },
                },
                required: ['name', 'issuer', 'issue_date'],
              },
            },
            projects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  tools_used: { type: 'array', items: { type: 'string' } },
                  start_date: { type: 'string' },
                  end_date: { type: 'string' },
                },
                required: ['title', 'description', 'tools_used'],
              },
            },
            ratings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  skill: { type: 'string' },
                  domain: { type: 'string' },
                  depth: { type: 'number' },
                  tier: { type: 'string', enum: ['Novice', 'Intermediate', 'Advanced'] },
                  confidence: { type: 'number' },
                },
                required: ['skill', 'domain', 'depth', 'tier', 'confidence'],
              },
            },
          },
          required: ['name', 'email', 'degree', 'certifications', 'projects', 'ratings'],
        },
      },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract structured data from this resume:\n\n<resume>\n${rawText.slice(0, 10_000)}\n</resume>`,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new ExternalServiceError('mistral', 'Empty response from extraction service');
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(content);
  } catch {
    throw new ExternalServiceError('mistral', 'Invalid JSON returned from extraction service');
  }

  const parsed = ResumeOutputSchema.safeParse(rawJson);
  if (!parsed.success) {
    logger.warn({ zodErrors: parsed.error.issues }, 'Schema mismatch in parsed output');
    return ResumeOutputSchema.parse({});
  }

  return parsed.data;
}

async function extractWithRetry(rawText: string, maxRetries = 3): Promise<ResumeOutput> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await rawExtractResume(rawText);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt - 1) * 1000);
      }
    }
  }

  throw lastError ?? new ExternalServiceError('mistral', 'Extraction failed after retries');
}

const breaker = createCircuitBreaker(extractWithRetry, {
  name: 'mistral-resume',
  timeout: 90_000,
  fallback: () => ResumeOutputSchema.parse({}),
});

export async function extractResumeData(rawText: string): Promise<ParsedResumeResult> {
  const output = await breaker.fire(rawText);

  const skills = output.ratings.map((r) => r.skill);
  const projects: ProjectItem[] = output.projects.map((p) => ({
    title: p.title,
    description: p.description,
    tools_used: p.tools_used,
    start_date: p.start_date,
    end_date: p.end_date,
    is_current: p.end_date === 'Present' || p.end_date === 'Current',
    raw_text: p.description,
  }));
  const ratings: SkillRating[] = output.ratings.map((r) => ({
    skill: r.skill,
    domain: r.domain,
    depth: r.depth,
    tier: r.tier,
    confidence: r.confidence,
  }));

  return {
    name: output.name,
    email: output.email,
    degree: output.degree,
    certifications: output.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
      issue_date: c.issue_date,
    })),
    rawText,
    skills,
    projects,
    ratings,
  };
}
