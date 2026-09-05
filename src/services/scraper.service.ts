import { supabase } from '../db/connection.js';
import { embedBatch } from '../adapters/ollama.adapter.js';
import { createChildLogger } from '../lib/logger.js';
import { slugify } from '../lib/id-generator.js';
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
  ayurved: 'Ayurveda & Traditional Medicine',
  medic: 'Healthcare & Biomedical Sciences',
  health: 'Healthcare & Biomedical Sciences',
  pharma: 'Pharmaceutical Sciences',
  bio: 'Biotechnology & Life Sciences',
  mechanic: 'Mechanical Engineering',
  civil: 'Civil & Infrastructure Engineering',
  electron: 'Electronics & Communication',
  business: 'Management & Business Administration',
  manage: 'Management & Leadership',
  econom: 'Economics & Financial Systems',
  design: 'Design & Creative Technologies',
  skill: 'Vocational & Skill Development',
  aerospace: 'Aerospace & Aviation',
  aviation: 'Aerospace & Aviation',
  automotive: 'Automotive & Manufacturing',
  agriculture: 'Agriculture & Food Processing',
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
  'Ayurveda', 'Pharmacology', 'Biochemistry', 'Clinical Research',
  'Project Management', 'Financial Analysis', 'Digital Marketing',
  'VLSI Design', 'CAD/CAM', 'Thermodynamics', 'Power Systems',
  'Microcontrollers', 'IoT', 'Quality Assurance', 'Supply Chain',
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

async function saveCoursesBatch(courses: CourseItem[]): Promise<CourseItem[]> {
  const courseMap = new Map<string, CourseItem>();
  for (const c of courses) courseMap.set(c.course_id, c);
  const uniqueChunk = Array.from(courseMap.values());
  if (uniqueChunk.length === 0) return [];

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
  } catch (e: any) {
    logger.warn({ error: e.message }, 'Course embedding generation skipped or failed; proceeding with save');
  }

  const { error } = await supabase.from('courses').upsert(uniqueChunk);
  if (error) {
    logger.error({ error }, 'Failed to upsert courses batch to Supabase');
    return [];
  }
  return uniqueChunk;
}


export async function scrapeMitOcwCourses(
  options: {
    department?: string;
    limit?: number;
    concurrency?: number;
  } = {},
): Promise<CourseItem[]> {
  const dept = options.department ?? 'all';
  const limit = options.limit ?? Infinity;
  const concurrency = options.concurrency ?? 16;
  const CHUNK_SIZE = 64;

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

  const toScrape = (limit && limit !== Infinity) ? entries.slice(0, limit) : entries;
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
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const pageController = new AbortController();
              const pageTimeout = setTimeout(() => pageController.abort(), 15_000);

              const pageRes = await fetch(item.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: pageController.signal,
              });
              clearTimeout(pageTimeout);

              if (pageRes.ok) {
                html = await pageRes.text();
                break;
              } else if (pageRes.status === 429) {
                await sleep(1000 * attempt);
              } else {
                break;
              }
            } catch (e: any) {
              if (attempt === 2) throw e;
              await sleep(500 * attempt);
            }
          }

          if (!html) continue;

          const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
          const descMatch =
            html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
            html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);

          if (!titleMatch || !descMatch) continue;

          let cleanTitle = titleMatch[1].replace(/\s*\|.*$/, '').trim();
          cleanTitle = cleanTitle.replace(/^mit\s*[:\-]?\s*/i, '').trim();

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

          await sleep(10);
        } catch (err: any) {
          logger.warn({ url: item.url, error: err.message }, 'Failed to fetch course');
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, chunk.length) }, () => worker()));

    const saved = await saveCoursesBatch(chunkCourses);
    allScrapedCourses.push(...saved);
  }

  return allScrapedCourses;
}

export async function scrapeSwayamCourses(
  options: {
    limit?: number;
  } = {},
): Promise<CourseItem[]> {
  const limit = options.limit ?? Infinity;
  const CHUNK_SIZE = 64;

  logger.info({ limit }, 'Starting SWAYAM courses scrape');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let rawJson: any;

  try {
    const res = await fetch('https://swayam.gov.in/course_suggestive_search', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://swayam.gov.in/explorer',
        'Accept': 'text/plain, */*; q=0.01',
      },
      signal: controller.signal,
    });
    let text = await res.text();
    if (text.startsWith(")]}'")) {
      text = text.replace(")]}'", "").trim();
    }
    rawJson = JSON.parse(text);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to fetch SWAYAM courses');
    return [];
  } finally {
    clearTimeout(timeout);
  }

  const rawCourses: Array<{ title: string; instructor_name?: string; url?: string; picture_url?: string }> =
    rawJson?.message || [];
  const selected = (limit && limit !== Infinity) ? rawCourses.slice(0, limit) : rawCourses;
  const allSaved: CourseItem[] = [];

  for (let i = 0; i < selected.length; i += CHUNK_SIZE) {
    const chunk = selected.slice(i, i + CHUNK_SIZE);
    const chunkCourses: CourseItem[] = [];

    for (const item of chunk) {
      if (!item.title) continue;

      const cleanTitle = item.title.trim();
      const urlMatch = item.url ? item.url.match(/swayam2\.ac\.in\/([^\/]+)/i) : null;
      const rawCode = urlMatch ? urlMatch[1] : slugify(cleanTitle).slice(0, 50);
      const course_id = `swayam-${rawCode}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

      const instructor = item.instructor_name?.trim() || 'Academic Faculty';
      const description = `Course instructed by ${instructor}. National Coordinator curriculum accredited on SWAYAM / NPTEL Ministry of Education platform.`;
      const target_skills = extractSkills(`${cleanTitle} ${description}`);
      const target_domain = inferDomain(cleanTitle, description);

      let difficulty: SkillTier = 'Intermediate';
      const lower = cleanTitle.toLowerCase();
      if (lower.includes('advanced') || lower.includes('graduate') || lower.includes('ii') || lower.includes('part 2')) {
        difficulty = 'Advanced';
      } else if (lower.includes('intro') || lower.includes('basic') || lower.includes('foundation') || lower.includes('i') || lower.includes('part 1')) {
        difficulty = 'Novice';
      }

      const displayTitle = cleanTitle.replace(/^swayam\s*:\s*/i, '').trim();

      chunkCourses.push({
        course_id,
        title: displayTitle,
        description,
        provider: 'SWAYAM / NPTEL',
        target_skills,
        target_domain,
        difficulty,
        url: item.url || 'https://swayam.gov.in/explorer',
        duration_hours: 40,
        rating: 4.8,
      });
    }

    const saved = await saveCoursesBatch(chunkCourses);
    allSaved.push(...saved);
  }

  logger.info({ savedCount: allSaved.length }, 'SWAYAM scrape completed');
  return allSaved;
}

export async function scrapeSkillIndiaDigital(
  options: {
    sectorLimit?: number;
    courseLimit?: number;
  } = {},
): Promise<CourseItem[]> {
  const sectorLimit = options.sectorLimit ?? Infinity;
  const courseLimit = options.courseLimit ?? Infinity;
  const CHUNK_SIZE = 64;

  logger.info({ sectorLimit, courseLimit }, 'Starting Skill India Digital scrape (sectors & courses)');

  const candidateItems: CourseItem[] = [];

  // 1. Fetch Official Sectors from https://api-fe.skillindiadigital.gov.in/api/sectors (powers https://www.skillindiadigital.gov.in/sector/list)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const secRes = await fetch('https://api-fe.skillindiadigital.gov.in/api/sectors', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (secRes.ok) {
      const secJson = await secRes.json();
      const allSectors = secJson.Data?.results || [];
      const sectors = (sectorLimit && sectorLimit !== Infinity) ? allSectors.slice(0, sectorLimit) : allSectors;

      for (const sec of sectors) {
        if (!sec.Name) continue;
        const name = sec.Name.trim();
        const desc = sec.Description?.trim() || `${name} Sector Skill Council national qualification framework curriculum accredited under NSDC.`;
        const skills = extractSkills(`${name} ${desc}`);
        if (!skills.includes(name)) skills.unshift(name);

        candidateItems.push({
          course_id: `sidh-sector-${sec.Id || slugify(name)}`,
          title: name,
          description: desc,
          provider: 'Skill India Digital Hub (SIDH) / NSDC',
          target_skills: skills,
          target_domain: inferDomain(name, desc),
          difficulty: 'Intermediate',
          url: 'https://www.skillindiadigital.gov.in/sector/list',
          duration_hours: 60,
          rating: 4.7,
        });
      }
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to fetch Skill India Digital sectors');
  }

  // 2. Fetch Accredited Courses from Skill India Digital API
  if (courseLimit > 0) {
    try {
      const pageSize = 100;
      const firstRes = await fetch('https://api-fe.skillindiadigital.gov.in/api/course-v3/course-list-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          CourseStatusId: [], Keyword: '', Sector: [], Language: [], TypeId: [], Price: [], Rating: [],
          CourseProviderId: [], CourseId: [], SchemaId: [], ProgramBy: [], InitiativeOfs: [], Domains: [],
          LearningProductTypes: [], Programs: [], Duration: [], Credit: [], Availability: [], CreatedBy: [],
          CertificateType: [], PageNumber: 1, PageSize: pageSize, Occupations: [], SortBy: null, SortSet: null,
        }),
      });

      if (firstRes.ok) {
        const firstJson = await firstRes.json();
        const totalCourses = firstJson.Data?.Pagination?.TotalCount || 0;
        const totalPages = Math.ceil(Math.min(totalCourses, courseLimit) / pageSize);
        const allApiCourses: any[] = [...(firstJson.Data?.Courses || [])];

        const remainingPages: number[] = [];
        for (let p = 2; p <= totalPages; p++) remainingPages.push(p);

        const BATCH_PAGES = 4;
        for (let i = 0; i < remainingPages.length; i += BATCH_PAGES) {
          const batch = remainingPages.slice(i, i + BATCH_PAGES);
          const results = await Promise.all(
            batch.map(async (page) => {
              try {
                const r = await fetch('https://api-fe.skillindiadigital.gov.in/api/course-v3/course-list-result', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  },
                  body: JSON.stringify({
                    CourseStatusId: [], Keyword: '', Sector: [], Language: [], TypeId: [], Price: [], Rating: [],
                    CourseProviderId: [], CourseId: [], SchemaId: [], ProgramBy: [], InitiativeOfs: [], Domains: [],
                    LearningProductTypes: [], Programs: [], Duration: [], Credit: [], Availability: [], CreatedBy: [],
                    CertificateType: [], PageNumber: page, PageSize: pageSize, Occupations: [], SortBy: null, SortSet: null,
                  }),
                });
                if (!r.ok) return [];
                const j = await r.json();
                return j.Data?.Courses || [];
              } catch {
                return [];
              }
            }),
          );
          for (const resList of results) allApiCourses.push(...resList);
        }

        const initialCandidates = candidateItems.length;
        for (const c of allApiCourses) {
          const rawTitle = c.Title || c.CourseDisplayName || c.CourseName;
          if (!rawTitle) continue;
          const cleanTitle = rawTitle.trim().replace(/^skill\s+india\s*:\s*/i, '');
          const desc = c.ShortDescription || c.LongDescription || c.LearningOutcome || `${cleanTitle} vocational and skill credential.`;
          const skills = extractSkills(`${cleanTitle} ${desc}`);
          if (c.Domains?.[0]?.Domain && !skills.includes(c.Domains[0].Domain)) {
            skills.unshift(c.Domains[0].Domain);
          }

          const provider = c.CreatedBy || c.AwardingBodyOffering || c.CourseProviderOffering || c.CourseProvider || 'Skill India Digital Hub (SIDH) / NSDC';
          const courseId = `sidh-course-${c.Id || slugify(cleanTitle).slice(0, 40)}`;
          const durationHours = c.CourseDurations?.[0]?.Minutes ? Math.max(1, Math.round(c.CourseDurations[0].Minutes / 60)) : 45;

          candidateItems.push({
            course_id: courseId,
            title: cleanTitle,
            description: desc,
            provider,
            target_skills: skills,
            target_domain: inferDomain(cleanTitle, desc),
            difficulty: 'Intermediate',
            url: c.Id ? `https://www.skillindiadigital.gov.in/courses/detail/${c.Id}` : 'https://www.skillindiadigital.gov.in/courses',
            duration_hours: durationHours,
            rating: c.CourseStatistic?.RatingAverage ?? null,
          });

          if (candidateItems.length - initialCandidates >= courseLimit) break;
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to fetch Skill India Digital course offerings');
    }
  }

  // 3. Chunk and persist to Supabase
  const allSaved: CourseItem[] = [];
  for (let i = 0; i < candidateItems.length; i += CHUNK_SIZE) {
    const chunk = candidateItems.slice(i, i + CHUNK_SIZE);
    const saved = await saveCoursesBatch(chunk);
    allSaved.push(...saved);
  }

  logger.info({ savedCount: allSaved.length }, 'Skill India Digital scrape completed');
  return allSaved;
}

export async function scrape(
  options: {
    sources?: ('swayam' | 'skill_india' | 'mit')[];
    swayamLimit?: number;
    skillIndiaLimit?: number;
    mitLimit?: number;
    mitDepartment?: string;
  } = {},
): Promise<{
  swayam: CourseItem[];
  skillIndia: CourseItem[];
  mit: CourseItem[];
  total: number;
}> {
  const sources = options.sources ?? ['swayam', 'skill_india', 'mit'];
  const swayamLimit = options.swayamLimit ?? Infinity;
  const skillIndiaLimit = options.skillIndiaLimit ?? Infinity;
  const mitLimit = options.mitLimit ?? Infinity;

  let swayam: CourseItem[] = [];
  let skillIndia: CourseItem[] = [];
  let mit: CourseItem[] = [];

  if (sources.includes('swayam')) {
    swayam = await scrapeSwayamCourses({ limit: swayamLimit });
  }

  if (sources.includes('skill_india')) {
    skillIndia = await scrapeSkillIndiaDigital({ courseLimit: skillIndiaLimit });
  }

  if (sources.includes('mit')) {
    mit = await scrapeMitOcwCourses({ limit: mitLimit, department: options.mitDepartment ?? 'all' });
  }

  return {
    swayam,
    skillIndia,
    mit,
    total: swayam.length + skillIndia.length + mit.length,
  };
}

