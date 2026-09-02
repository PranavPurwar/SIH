import { MATCHING } from '../config/constants.js';
import { supabase } from '../db/connection.js';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('SkillNormalizer');

interface SkillCacheEntry {
  id: string;
  canonical_name: string;
  domain: string;
  base_weight: number;
}

let skillCache: Map<string, SkillCacheEntry> | null = null;
let aliasCache: Map<string, string> | null = null;

export async function loadSkillCache(): Promise<void> {
  const { data: skills, error: skillErr } = await supabase
    .from('skills')
    .select('id, canonical_name, domain, base_weight');

  if (skillErr) {
    logger.error({ error: skillErr }, 'Failed to load skills');
    skillCache = new Map();
    aliasCache = new Map();
    return;
  }

  skillCache = new Map();
  for (const s of skills || []) {
    skillCache.set(s.id, {
      id: s.id,
      canonical_name: s.canonical_name,
      domain: s.domain,
      base_weight: s.base_weight ?? 1.0,
    });
  }

  const { data: aliases, error: aliasErr } = await supabase
    .from('skill_aliases')
    .select('alias, canonical_skill_id');

  aliasCache = new Map();
  if (!aliasErr && aliases) {
    for (const a of aliases) {
      aliasCache.set(a.alias.toLowerCase().trim(), a.canonical_skill_id);
    }
  }
}

export function levenshteinRatio(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (!a.length || !b.length) return 0.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  return 1 - distance / Math.max(a.length, b.length);
}

function normalizeKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

export interface NormalizedSkill {
  canonicalId: string;
  canonicalName: string;
  domain: string;
  baseWeight: number;
  matchMethod: 'exact_alias' | 'canonical_lookup' | 'levenshtein' | 'passthrough';
  confidence: number;
}

export function normalize(rawSkill: string): NormalizedSkill {
  if (!skillCache || !aliasCache) {
    return {
      canonicalId: normalizeKey(rawSkill),
      canonicalName: rawSkill,
      domain: 'General',
      baseWeight: 1.0,
      matchMethod: 'passthrough',
      confidence: 0.3,
    };
  }

  const key = normalizeKey(rawSkill);

  const aliasSkillId = aliasCache.get(key);
  if (aliasSkillId) {
    const skill = skillCache.get(aliasSkillId);
    if (skill) {
      return {
        canonicalId: skill.id,
        canonicalName: skill.canonical_name,
        domain: skill.domain,
        baseWeight: skill.base_weight,
        matchMethod: 'exact_alias',
        confidence: 1.0,
      };
    }
  }

  for (const [id, skill] of skillCache) {
    if (normalizeKey(skill.canonical_name) === key || id === key) {
      return {
        canonicalId: skill.id,
        canonicalName: skill.canonical_name,
        domain: skill.domain,
        baseWeight: skill.base_weight,
        matchMethod: 'canonical_lookup',
        confidence: 1.0,
      };
    }
  }

  let bestMatch: SkillCacheEntry | null = null;
  let bestSim = 0;

  for (const [, skill] of skillCache) {
    const sim = levenshteinRatio(key, normalizeKey(skill.canonical_name));
    if (sim > bestSim && sim >= MATCHING.SKILL_ALIAS_LEVENSHTEIN_THRESHOLD) {
      bestSim = sim;
      bestMatch = skill;
    }
  }

  if (bestMatch) {
    return {
      canonicalId: bestMatch.id,
      canonicalName: bestMatch.canonical_name,
      domain: bestMatch.domain,
      baseWeight: bestMatch.base_weight,
      matchMethod: 'levenshtein',
      confidence: Number(bestSim.toFixed(2)),
    };
  }

  return {
    canonicalId: key,
    canonicalName: rawSkill,
    domain: 'General',
    baseWeight: 1.0,
    matchMethod: 'passthrough',
    confidence: 0.3,
  };
}

export function normalizeMany(rawSkills: string[]): NormalizedSkill[] {
  const seen = new Set<string>();
  const results: NormalizedSkill[] = [];

  for (const raw of rawSkills) {
    const norm = normalize(raw);
    if (!seen.has(norm.canonicalId)) {
      seen.add(norm.canonicalId);
      results.push(norm);
    }
  }

  return results;
}

export function areSameSkill(skill1: string, skill2: string): boolean {
  return normalize(skill1).canonicalId === normalize(skill2).canonicalId;
}
