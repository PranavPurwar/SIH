import crypto from 'crypto';
import { supabase } from '../db/connection.js';
import { embedBatch } from '../adapters/ollama.adapter.js';
import { createChildLogger } from '../lib/logger.js';
import type { CourseItem, PaginationParams, PaginatedResult } from '../types/index.js';
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

export async function searchCourses(
  filter?: { query?: string; domain?: string; difficulty?: string; provider?: string },
  pagination?: PaginationParams,
): Promise<PaginatedResult<CourseItem>> {
  const page = pagination?.page ?? 1;
  const limit = Math.min(pagination?.limit ?? APP.PAGINATION_DEFAULT_LIMIT, APP.PAGINATION_MAX_LIMIT);
  const offset = (page - 1) * limit;

  if (filter?.query?.trim()) {
    try {
      const [queryVector] = await embedBatch([filter.query.trim()], 'query');
      const { data, error } = await supabase.rpc('match_courses', {
        query_embedding: queryVector,
        match_threshold: 0.20,
        match_count: limit,
      });

      if (!error && data && data.length > 0) {
        let items = (data || []).map(mapCourseRow);
        if (filter?.difficulty && filter.difficulty.toLowerCase() !== 'all') {
          const targetDiff = filter.difficulty.toLowerCase();
          items = items.filter((c: CourseItem) => {
            const d = (c.difficulty || '').toLowerCase();
            if (targetDiff === 'beginner' || targetDiff === 'novice') {
              return d === 'beginner' || d === 'novice';
            }
            return d === targetDiff;
          });
        }
        return { items, total: items.length, page, limit, hasMore: false };
      }
    } catch {
      // Fallback to text search
    }

    let textQuery = supabase.from('courses').select('*', { count: 'exact' });
    const term = filter.query.trim();
    textQuery = textQuery.or(`title.ilike.%${term}%,description.ilike.%${term}%,target_domain.ilike.%${term}%`);

    if (filter?.domain) textQuery = textQuery.ilike('target_domain', `%${filter.domain.trim()}%`);
    if (filter?.provider) textQuery = textQuery.ilike('provider', `%${filter.provider.trim()}%`);
    if (filter?.difficulty && filter.difficulty.toLowerCase() !== 'all') {
      textQuery = textQuery.ilike('difficulty', `%${filter.difficulty.trim()}%`);
    }

    textQuery = textQuery.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    const { data: textData, count: textCount } = await textQuery;
    const items = (textData || []).map(mapCourseRow);
    const total = textCount ?? items.length;
    return { items, total, page, limit, hasMore: offset + limit < total };
  }

  let query = supabase.from('courses').select('*', { count: 'exact' });
  if (filter?.domain) query = query.ilike('target_domain', `%${filter.domain.trim()}%`);
  if (filter?.provider) query = query.ilike('provider', `%${filter.provider.trim()}%`);
  if (filter?.difficulty && filter.difficulty.toLowerCase() !== 'all') {
    const diff = filter.difficulty.trim();
    if (diff.toLowerCase() === 'beginner' || diff.toLowerCase() === 'novice') {
      query = query.or('difficulty.ilike.Beginner,difficulty.ilike.Novice');
    } else {
      query = query.ilike('difficulty', `%${diff}%`);
    }
  }
  query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

  const { data, error, count } = await query;
  if (error || !data) return { items: [], total: 0, page, limit, hasMore: false };

  const items = data.map(mapCourseRow);
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

  const queryText = `Skills to learn: ${missingSkills.join(', ')}`;
  const [queryVector] = await embedBatch([queryText], 'query');

  const { data, error } = await supabase.rpc('match_courses', {
    query_embedding: queryVector,
    match_threshold: 0.25,
    match_count: maxCourses,
  });

  if (error || !data) return [];
  return data.map(mapCourseRow);
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

function mapCourseRow(c: any): CourseItem {
  return {
    course_id: c.course_id,
    title: decodeHtmlText(c.title),
    description: decodeHtmlText(c.description || ''),
    provider: decodeHtmlText(c.provider || 'MIT OpenCourseWare'),
    target_skills: c.target_skills || [],
    target_domain: decodeHtmlText(c.target_domain || 'Computer Science & Engineering'),
    difficulty: c.difficulty || 'Intermediate',
    url: c.url,
    duration_hours: c.duration_hours,
    rating: c.rating ? Number(c.rating) : undefined,
    similarity: c.similarity ? Number(Number(c.similarity).toFixed(3)) : undefined,
  };
}
