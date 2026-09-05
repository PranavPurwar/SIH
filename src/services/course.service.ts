import crypto from 'crypto';
import { supabase } from '../db/connection.js';
import { embedBatch } from '../adapters/ollama.adapter.js';
import { createChildLogger } from '../lib/logger.js';
import type { CourseItem, PaginationParams, PaginatedResult, SkillTier } from '../types/index.js';
import { APP } from '../config/constants.js';

const logger = createChildLogger('CourseService');

export async function createCourse(courseData: Partial<CourseItem>): Promise<CourseItem> {
  const courseRecord: CourseItem = {
    course_id: courseData.course_id || `crs-${crypto.randomUUID().slice(0, 8)}`,
    title: courseData.title || 'Untitled Course',
    description: courseData.description || '',
    provider: courseData.provider || 'Academia Hub',
    target_skills: courseData.target_skills || [],
    target_domain: courseData.target_domain || 'General',
    difficulty: courseData.difficulty || 'Intermediate',
    url: courseData.url || '',
    duration_hours: courseData.duration_hours,
    rating: courseData.rating,
  };

  const courseText = `Course: ${courseRecord.title}. Description: ${courseRecord.description}. Domain: ${courseRecord.target_domain}. Skills: ${courseRecord.target_skills.join(', ')}`;
  const [embedding] = await embedBatch([courseText], 'document');

  const { error } = await supabase.from('courses').upsert({
    ...courseRecord,
    embedding,
    embedding_model: 'nomic-embed-text-v2-moe',
  });

  if (error) throw new Error(`Failed to create course: ${error.message}`);
  return courseRecord;
}

export async function updateCourse(courseId: string, courseData: Partial<CourseItem>): Promise<CourseItem> {
  const { data: existing, error: fetchError } = await supabase
    .from('courses')
    .select('*')
    .eq('course_id', courseId)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Course not found with id: ${courseId}`);
  }

  const updatedRecord: CourseItem = {
    course_id: courseId,
    title: courseData.title !== undefined ? courseData.title.trim() : existing.title,
    description: courseData.description !== undefined ? courseData.description.trim() : (existing.description || ''),
    provider: courseData.provider !== undefined ? courseData.provider.trim() : (existing.provider || 'Academia Hub'),
    target_skills: courseData.target_skills !== undefined ? courseData.target_skills : (existing.target_skills || []),
    target_domain: courseData.target_domain !== undefined ? courseData.target_domain.trim() : (existing.target_domain || 'General'),
    difficulty: courseData.difficulty !== undefined ? courseData.difficulty : (existing.difficulty || 'Intermediate'),
    url: courseData.url !== undefined ? courseData.url.trim() : (existing.url || ''),
    duration_hours: courseData.duration_hours !== undefined ? courseData.duration_hours : existing.duration_hours,
    rating: courseData.rating !== undefined ? courseData.rating : existing.rating,
  };

  let embedding = existing.embedding;
  try {
    const courseText = `Course: ${updatedRecord.title}. Description: ${updatedRecord.description}. Domain: ${updatedRecord.target_domain}. Skills: ${updatedRecord.target_skills.join(', ')}`;
    const [newEmb] = await embedBatch([courseText], 'document');
    if (newEmb && newEmb.length > 0) embedding = newEmb;
  } catch (err) {
    logger.warn({ err }, 'Failed to re-generate embedding during course update');
  }

  const { error: updateError } = await supabase.from('courses').upsert({
    ...updatedRecord,
    embedding,
    embedding_model: 'nomic-embed-text-v2-moe',
  });

  if (updateError) throw new Error(`Failed to update course: ${updateError.message}`);
  return updatedRecord;
}

interface CourseDbRow {
  course_id: string;
  title: string;
  description?: string | null;
  provider?: string | null;
  target_skills?: string[] | null;
  target_domain?: string | null;
  difficulty?: SkillTier | string | null;
  url?: string | null;
  duration_hours?: number | null;
  rating?: number | string | null;
  similarity?: number | string | null;
  embedding?: number[] | null;
}

function isZeroVector(vec?: number[]): boolean {
  if (!vec || vec.length === 0) return true;
  for (let i = 0; i < vec.length; i++) {
    if (vec[i] !== 0) return false;
  }
  return true;
}

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,():"'.%]/g, ' ').trim();
}

function applyCourseSourceFilter<T extends { ilike: (column: string, pattern: string) => T }>(
  builder: T,
  source?: string
): T {
  if (!source || source.toLowerCase() === 'all') return builder;
  const s = source.toLowerCase().trim();
  if (s === 'swayam') return builder.ilike('course_id', 'swayam-%');
  if (s === 'skill_india' || s === 'skillindia' || s === 'sidh') return builder.ilike('course_id', 'sidh-%');
  if (s === 'mit') return builder.ilike('course_id', 'mit-%');
  return builder;
}

export async function searchCourses(
  filter?: { query?: string; domain?: string; difficulty?: string; provider?: string; source?: string },
  pagination?: PaginationParams,
): Promise<PaginatedResult<CourseItem>> {
  const page = pagination?.page ?? 1;
  const limit = Math.min(pagination?.limit ?? APP.PAGINATION_DEFAULT_LIMIT, APP.PAGINATION_MAX_LIMIT);
  const offset = (page - 1) * limit;

  const rawQuery = filter?.query?.trim() || '';
  const cleanQuery = sanitizeSearchTerm(rawQuery);
  const words = cleanQuery.split(/\s+/).filter((w) => w.length > 0);

  if (words.length > 0) {
    // 1. Primary: Search courses where TITLE matches all words (highest relevance)
    let titleQuery = supabase.from('courses').select('*', { count: 'exact' });
    for (const w of words) {
      titleQuery = titleQuery.ilike('title', `%${w}%`);
    }
    if (filter?.domain) titleQuery = titleQuery.ilike('target_domain', `%${filter.domain.trim()}%`);
    if (filter?.provider) titleQuery = titleQuery.ilike('provider', `%${filter.provider.trim()}%`);
    titleQuery = applyCourseSourceFilter(titleQuery, filter?.source);
    if (filter?.difficulty && filter.difficulty.toLowerCase() !== 'all') {
      const diff = filter.difficulty.trim().toLowerCase();
      if (diff === 'beginner' || diff === 'novice') {
        titleQuery = titleQuery.in('difficulty', ['Beginner', 'Novice']);
      } else {
        titleQuery = titleQuery.ilike('difficulty', `%${diff}%`);
      }
    }

    const { data: titleData, count: titleCount, error: titleError } = await titleQuery
      .range(offset, offset + limit - 1)
      .order('title', { ascending: true });

    const tCount = (!titleError && titleCount !== null) ? titleCount : 0;
    let items = (!titleError && titleData) ? (titleData as CourseDbRow[]).map(mapCourseRow) : [];

    // 2. Secondary: Search courses where description, domain, provider, or course_id match
    let descCount = 0;
    if (items.length < limit || offset >= tCount) {
      let descQuery = supabase.from('courses').select('*', { count: 'exact' });
      for (const w of words) {
        descQuery = descQuery.or(
          `description.ilike.%${w}%,target_domain.ilike.%${w}%,provider.ilike.%${w}%,course_id.ilike.%${w}%`
        );
      }
      for (const w of words) {
        descQuery = descQuery.not('title', 'ilike', `%${w}%`);
      }

      if (filter?.domain) descQuery = descQuery.ilike('target_domain', `%${filter.domain.trim()}%`);
      if (filter?.provider) descQuery = descQuery.ilike('provider', `%${filter.provider.trim()}%`);
      descQuery = applyCourseSourceFilter(descQuery, filter?.source);
      if (filter?.difficulty && filter.difficulty.toLowerCase() !== 'all') {
        const diff = filter.difficulty.trim().toLowerCase();
        if (diff === 'beginner' || diff === 'novice') {
          descQuery = descQuery.in('difficulty', ['Beginner', 'Novice']);
        } else {
          descQuery = descQuery.ilike('difficulty', `%${diff}%`);
        }
      }

      const descOffset = Math.max(0, offset - tCount);
      const needed = limit - items.length;
      const { data: descData, count: dCount, error: descError } = await descQuery
        .range(descOffset, descOffset + needed - 1)
        .order('title', { ascending: true });

      descCount = (!descError && dCount !== null) ? dCount : 0;
      if (!descError && descData && descData.length > 0) {
        items = items.concat((descData as CourseDbRow[]).map(mapCourseRow));
      }
    } else {
      let headQuery = supabase.from('courses').select('*', { count: 'exact', head: true });
      for (const w of words) {
        headQuery = headQuery.or(
          `description.ilike.%${w}%,target_domain.ilike.%${w}%,provider.ilike.%${w}%,course_id.ilike.%${w}%`
        );
      }
      for (const w of words) {
        headQuery = headQuery.not('title', 'ilike', `%${w}%`);
      }
      if (filter?.domain) headQuery = headQuery.ilike('target_domain', `%${filter.domain.trim()}%`);
      if (filter?.provider) headQuery = headQuery.ilike('provider', `%${filter.provider.trim()}%`);
      headQuery = applyCourseSourceFilter(headQuery, filter?.source);
      if (filter?.difficulty && filter.difficulty.toLowerCase() !== 'all') {
        const diff = filter.difficulty.trim().toLowerCase();
        if (diff === 'beginner' || diff === 'novice') {
          headQuery = headQuery.in('difficulty', ['Beginner', 'Novice']);
        } else {
          headQuery = headQuery.ilike('difficulty', `%${diff}%`);
        }
      }
      const { count: hCount } = await headQuery;
      descCount = hCount ?? 0;
    }

    const total = tCount + descCount;
    if (total > 0) {
      return { items, total, page, limit, hasMore: offset + limit < total };
    }

    // 3. Fallback: Semantic vector search only if embeddings are valid and non-zero
    if (rawQuery.length > 3) {
      try {
        const [queryVector] = await embedBatch([rawQuery], 'query');
        if (queryVector && !isZeroVector(queryVector)) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('match_courses', {
            query_embedding: queryVector,
            match_threshold: 0.40,
            match_count: Math.min(100, Math.max(limit * 5, 30)),
          });

          if (!rpcError && rpcData && rpcData.length > 0) {
            let validItems = (rpcData as CourseDbRow[])
              .filter((c) => typeof c.similarity === 'number' && !Number.isNaN(c.similarity) && c.similarity >= 0.40)
              .map(mapCourseRow);

            if (filter?.difficulty && filter.difficulty.toLowerCase() !== 'all') {
              const targetDiff = filter.difficulty.toLowerCase();
              validItems = validItems.filter((c: CourseItem) => {
                const d = (c.difficulty || '').toLowerCase();
                if (targetDiff === 'beginner' || targetDiff === 'novice') {
                  return d === 'beginner' || d === 'novice';
                }
                return d === targetDiff;
              });
            }
            if (filter?.source && filter.source.toLowerCase() !== 'all') {
              const s = filter.source.toLowerCase().trim();
              validItems = validItems.filter((c: CourseItem) => {
                const cid = (c.course_id || '').toLowerCase();
                if (s === 'swayam') return cid.startsWith('swayam-');
                if (s === 'skill_india' || s === 'skillindia' || s === 'sidh') return cid.startsWith('sidh-');
                if (s === 'mit') return cid.startsWith('mit-');
                return true;
              });
            }
            if (validItems.length > 0) {
              const paged = validItems.slice(offset, offset + limit);
              return { items: paged, total: validItems.length, page, limit, hasMore: offset + limit < validItems.length };
            }
          }
        }
      } catch {
        // Fallback silently
      }
    }

    return { items: [], total: 0, page, limit, hasMore: false };
  }

  // Browse all courses (no keyword search query)
  let query = supabase.from('courses').select('*', { count: 'exact' });
  if (filter?.domain) query = query.ilike('target_domain', `%${filter.domain.trim()}%`);
  if (filter?.provider) query = query.ilike('provider', `%${filter.provider.trim()}%`);
  query = applyCourseSourceFilter(query, filter?.source);
  if (filter?.difficulty && filter.difficulty.toLowerCase() !== 'all') {
    const diff = filter.difficulty.trim().toLowerCase();
    if (diff === 'beginner' || diff === 'novice') {
      query = query.in('difficulty', ['Beginner', 'Novice']);
    } else {
      query = query.ilike('difficulty', `%${diff}%`);
    }
  }
  query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error || !data) return { items: [], total: 0, page, limit, hasMore: false };

  const items = (data as CourseDbRow[]).map(mapCourseRow);
  const total = count ?? items.length;
  return { items, total, page, limit, hasMore: offset + limit < total };
}

let eecsCoursesCache: CourseItem[] | null = null;
let eecsCoursesCacheTime = 0;
const EECS_CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function prewarmCourseCache(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      eecsCoursesCache = data.map(mapCourseRow);
      eecsCoursesCacheTime = Date.now();
      logger.info({ count: eecsCoursesCache.length }, 'Loaded complete course curriculum cache');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to prewarm course cache');
  }
}

export async function getCachedEecsCourses(): Promise<CourseItem[]> {
  if (eecsCoursesCache && eecsCoursesCache.length > 0 && (Date.now() - eecsCoursesCacheTime < EECS_CACHE_TTL)) {
    return eecsCoursesCache;
  }
  await prewarmCourseCache();
  return eecsCoursesCache || [];
}

export async function getBestRemedialCoursesForJob(
  jobTitle: string,
  _jobDescription: string,
  missingSkills: string[],
  maxCourses = 2,
): Promise<CourseItem[]> {
  if (missingSkills.length === 0) return [];

  const jobTitleLower = (jobTitle || '').toLowerCase();
  const allCourses = await getCachedEecsCourses();
  if (allCourses.length === 0) return [];

  const scored = allCourses.map((course) => {
    let score = 0;
    const cidLower = (course.course_id || '').toLowerCase();
    const titleLower = (course.title || '').toLowerCase();
    const descLower = (course.description || '').toLowerCase();
    const courseSkills = (course.target_skills || []).map((s) => s.toLowerCase().trim());
    const domainLower = (course.target_domain || '').toLowerCase();

    // 1. Heavy weight for Course 6 (Computer Science & EECS) or relevant CS domains
    const isEecsOrCs = cidLower.startsWith('mit-6-') ||
      domainLower.includes('computer') ||
      domainLower.includes('systems') ||
      domainLower.includes('machine learning') ||
      domainLower.includes('software') ||
      domainLower.includes('network');

    if (isEecsOrCs) {
      score += 25;
    } else {
      score -= 50; // Penalize non-CS courses (e.g. mechanics, biology, humanities) for tech roles
    }

    // 2. High-precision skill gap scoring
    for (const ms of missingSkills) {
      const msLower = ms.toLowerCase().trim();
      if (!msLower) continue;

      if (courseSkills.some((cs) => cs === msLower)) {
        score += 120; // Direct exact skill match
      } else if (courseSkills.some((cs) => cs.includes(msLower) || msLower.includes(cs))) {
        score += 60;
      }

      if (titleLower.includes(msLower)) {
        score += 80;
      } else if (descLower.includes(msLower)) {
        score += 40;
      }
    }

    // 3. Technical Role Contextual Keywords
    const roleKeywords = [
      'cuda', 'gpu', 'pytorch', 'parallel', 'kernel', 'vfs', 'hypervisor',
      'distributed', 'compiler', 'rendering', 'webgl', 'graphics', 'storage',
      'database', 'virtualization', 'deep learning', 'transformers', 'llm'
    ];

    for (const kw of roleKeywords) {
      if (jobTitleLower.includes(kw)) {
        if (titleLower.includes(kw) || courseSkills.some(cs => cs.includes(kw))) {
          score += 75;
        } else if (descLower.includes(kw)) {
          score += 30;
        }
      }
    }

    return { course, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const distinctCourses: CourseItem[] = [];
  const seenKeys = new Set<string>();
  for (const item of scored) {
    if (item.score <= 0) continue;
    
    // Extract course number prefix (e.g. "6.1810", "6.837") if present
    const numMatch = item.course.title.match(/MIT\s+([0-9]+(?:\.[0-9a-z]+)?)/i) ||
                     item.course.course_id.match(/mit-([0-9]+-[0-9a-z]+)/i);
    const courseCodeKey = numMatch ? numMatch[1].replace('-', '.').toLowerCase() : '';

    const cleanTitle = item.course.title
      .replace(/MIT\s+[0-9]+(?:\.[0-9a-z]+)?:?/i, '')
      .replace(/\s*\(?(spring|fall|summer|winter)\s*\d{4}\)?/i, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();

    const dedupKey = courseCodeKey || cleanTitle;

    if (!seenKeys.has(dedupKey) && (!cleanTitle || !seenKeys.has(cleanTitle))) {
      if (dedupKey) seenKeys.add(dedupKey);
      if (cleanTitle) seenKeys.add(cleanTitle);
      distinctCourses.push(item.course);
      if (distinctCourses.length >= maxCourses) break;
    }
  }

  return distinctCourses;
}

export async function getRecommendedCoursesForSkills(
  missingSkills: string[],
  maxCourses = 5,
): Promise<CourseItem[]> {
  if (missingSkills.length === 0) return [];

  // Try text match first
  try {
    let query = supabase.from('courses').select('*');
    const clauses: string[] = [];
    for (const s of missingSkills.slice(0, 4)) {
      const clean = sanitizeSearchTerm(s);
      if (clean) clauses.push(`title.ilike.%${clean}%,description.ilike.%${clean}%`);
    }
    if (clauses.length > 0) {
      query = query.or(clauses.join(',')).limit(maxCourses);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return (data as CourseDbRow[]).map(mapCourseRow);
      }
    }
  } catch {
    // Continue to vector fallback
  }

  // Vector fallback if embeddings available and valid
  try {
    const queryText = `Skills to learn: ${missingSkills.join(', ')}`;
    const [queryVector] = await embedBatch([queryText], 'query');

    if (queryVector && !isZeroVector(queryVector)) {
      const { data, error } = await supabase.rpc('match_courses', {
        query_embedding: queryVector,
        match_threshold: 0.35,
        match_count: maxCourses,
      });

      if (!error && data && data.length > 0) {
        return (data as CourseDbRow[])
          .filter((c) => typeof c.similarity === 'number' && !Number.isNaN(c.similarity) && c.similarity >= 0.35)
          .map(mapCourseRow);
      }
    }
  } catch {
    // Silently fall through
  }

  return [];
}

function decodeHtmlText(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#43;/g, '+')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function mapCourseRow(c: CourseDbRow): CourseItem {
  let sim: number | undefined;
  if (c.similarity !== undefined && c.similarity !== null) {
    const num = Number(c.similarity);
    if (!Number.isNaN(num)) {
      sim = Number(num.toFixed(3));
    }
  }

  return {
    course_id: c.course_id,
    title: decodeHtmlText(c.title),
    description: decodeHtmlText(c.description || ''),
    provider: decodeHtmlText(c.provider || 'MIT OpenCourseWare'),
    target_skills: c.target_skills || [],
    target_domain: decodeHtmlText(c.target_domain || 'Computer Science & Engineering'),
    difficulty: (c.difficulty as SkillTier) || 'Intermediate',
    url: c.url || undefined,
    duration_hours: c.duration_hours || undefined,
    rating: c.rating ? Number(c.rating) : undefined,
    similarity: sim,
  };
}
