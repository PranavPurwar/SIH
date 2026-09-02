import { supabase } from '../db/connection.js';
import { embedBatch } from '../adapters/ollama.adapter.js';
import { createChildLogger } from '../lib/logger.js';
import type { CourseItem, SkillTier } from '../types/index.js';

const logger = createChildLogger('ScraperService');

const DOMAIN_KEYWORDS: Record<string, string> = {
  algorithm: 'Computer Science Theory & Algorithms',
  data: 'Data Science & Machine Learning',
  learning: 'Machine Learning & AI',
  intelligence: 'Machine Learning & AI',
  system: 'Systems Programming & Architecture',
  distributed: 'Distributed Systems & Cloud',
  network: 'Networking & Distributed Systems',
  security: 'Cybersecurity & Systems Defense',
  software: 'Software Engineering & Architecture',
  operating: 'Low-Level Systems & Kernel',
  kernel: 'Low-Level Systems & Kernel',
  robot: 'Robotics & Embedded Systems',
  hardware: 'Computer Architecture & Hardware',
  circuit: 'Electrical Engineering & Circuits',
  signal: 'Signal Processing & Communications',
  quantum: 'Quantum Computing & Information',
};

const COMMON_SKILLS = [
  'Python', 'C', 'C++', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Rust',
  'Assembly', 'SQL', 'Algorithms', 'Data Structures', 'Dynamic Programming',
  'Graph Theory', 'Machine Learning', 'Deep Learning', 'Neural Networks',
  'Computer Vision', 'Natural Language Processing', 'Transformers', 'LLMs',
  'Distributed Systems', 'Concurrency', 'Multithreading', 'Operating Systems',
  'Linux Kernel', 'Virtual Memory', 'Networking', 'TCP/IP', 'Cybersecurity',
  'Cryptography', 'Compilers', 'Database Systems', 'Cloud Computing',
  'Microservices', 'Embedded Systems', 'Computer Architecture',
];

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const matched = new Set<string>();

  for (const skill of COMMON_SKILLS) {
    const sLower = skill.toLowerCase();
    const regex = new RegExp(`\\b${sLower.replace(/[+]/g, '\\+')}\\b`, 'i');
    if (regex.test(lower)) {
      matched.add(skill);
    }
  }

  if (matched.size === 0) {
    matched.add('Computer Science');
  }

  return Array.from(matched);
}

function inferDomain(title: string, desc: string): string {
  const combined = `${title} ${desc}`.toLowerCase();
  for (const [key, domain] of Object.entries(DOMAIN_KEYWORDS)) {
    if (combined.includes(key)) {
      return domain;
    }
  }
  return 'Computer Science & Engineering';
}

function inferDifficulty(slug: string): SkillTier {
  const numMatch = slug.match(/^([0-9]+)-([0-9a-z]+)/i);
  if (!numMatch) return 'Intermediate';

  const subNum = numMatch[2].toLowerCase();
  if (subNum.startsWith('000') || subNum.startsWith('00') || subNum === '01') {
    return 'Novice';
  }
  if (subNum.startsWith('8') || subNum.startsWith('9') || subNum.startsWith('17')) {
    return 'Advanced';
  }
  return 'Intermediate';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeMitOcwCourses(
  options: {
    department?: string;
    limit?: number;
    concurrency?: number;
  } = {},
): Promise<CourseItem[]> {
  const dept = options.department ?? '6';
  const limit = options.limit ?? 25;
  const concurrency = options.concurrency ?? 8;
  const CHUNK_SIZE = 32;

  logger.info({ dept, limit, concurrency }, 'Starting MIT OCW scrape');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let xml: string = '';
  try {
    const res = await fetch('https://ocw.mit.edu/sitemap.xml', { signal: controller.signal });
    xml = await res.text();
  } catch (err) {
    logger.error({ err }, 'Failed to fetch MIT OCW sitemap');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const regex = /<loc>(https:\/\/ocw\.mit\.edu\/courses\/([0-9]+[a-z0-9\-]*)[^\/]*\/)sitemap\.xml<\/loc>/g;
  const entries: { url: string; slug: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    if (dept === 'all' || match[2].startsWith(`${dept}-`)) {
      entries.push({ url: match[1], slug: match[2] });
    }
  }

  const toScrape = entries.slice(0, limit);
  const allScrapedCourses: CourseItem[] = [];

  for (let i = 0; i < toScrape.length; i += CHUNK_SIZE) {
    const chunk = toScrape.slice(i, i + CHUNK_SIZE);
    const chunkCourses: CourseItem[] = [];
    
    let index = 0;
    async function worker() {
      while (index < chunk.length) {
        const currentIndex = index++;
        const item = chunk[currentIndex];

        try {
          let html = '';
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const pageController = new AbortController();
              const pageTimeout = setTimeout(() => pageController.abort(), 30_000);

              const pageRes = await fetch(item.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: pageController.signal,
              });
              clearTimeout(pageTimeout);

              if (pageRes.ok) {
                html = await pageRes.text();
                break;
              } else if (pageRes.status === 429) {
                await sleep(2000 * attempt);
              } else {
                break;
              }
            } catch (e: any) {
              if (attempt === 3) throw e;
              await sleep(1500 * attempt);
            }
          }

          if (!html) continue;

          const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
          const descMatch =
            html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
            html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);

          if (!titleMatch || !descMatch) continue;

          let cleanTitle = titleMatch[1].replace(/\s*\|.*$/, '').trim();
          const codeMatch = item.slug.match(/^([0-9]+-[0-9a-z]+)/i);
          if (codeMatch) {
            const code = codeMatch[1].replace('-', '.');
            if (!cleanTitle.toLowerCase().includes(code.toLowerCase())) {
              cleanTitle = `MIT ${code}: ${cleanTitle}`;
            }
          }

          const descriptionRaw = descMatch[1].trim()
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#34;/g, '"');
            
          let description = descriptionRaw.replace(/\{\{[%<]\s*[a-zA-Z0-9_]+\s+"[^"]+"\s+"([^"]+)"\s*[%>]\}\}/g, '$1');
          description = description.replace(/\{\{[%<].*?[%>]\}\}/g, '');
          description = description.replace(/\s{2,}/g, ' ').trim();
          
          const target_skills = extractSkills(`${cleanTitle} ${description}`);
          const target_domain = inferDomain(cleanTitle, description);
          const difficulty = inferDifficulty(item.slug);

          chunkCourses.push({
            course_id: `mit-${item.slug}`,
            title: cleanTitle,
            description,
            provider: 'MIT OpenCourseWare',
            target_skills,
            target_domain,
            difficulty,
            url: item.url,
            duration_hours: undefined,
            rating: undefined,
          });

          await sleep(200);
        } catch (err: any) {
          logger.warn({ url: item.url, error: err.message }, 'Failed to fetch course');
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, chunk.length) }, () => worker()));

    const courseMap = new Map<string, CourseItem>();
    for (const c of chunkCourses) courseMap.set(c.course_id, c);
    const uniqueChunk = Array.from(courseMap.values());

    if (uniqueChunk.length > 0) {
      try {
        const texts = uniqueChunk.map(
          (c) =>
            `Course: ${c.title}. Description: ${c.description || ''}. Domain: ${c.target_domain || ''}. Skills: ${(c.target_skills || []).join(', ')}`,
        );
        const embeddings = await embedBatch(texts, 'document');
        for (let j = 0; j < uniqueChunk.length; j++) {
          (uniqueChunk[j] as any).embedding = embeddings[j];
          (uniqueChunk[j] as any).embedding_model = 'nomic-embed-text-v2-moe';
        }
        
        const { error } = await supabase.from('courses').upsert(uniqueChunk);
        if (!error) {
          allScrapedCourses.push(...uniqueChunk);
        }
      } catch (e: any) {
        logger.warn({ error: e.message }, 'Course embedding generation failed');
      }
    }
  }

  return allScrapedCourses;
}
