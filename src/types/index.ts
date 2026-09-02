export type SkillTier = 'Novice' | 'Intermediate' | 'Advanced';

export interface ProjectItem {
  title: string;
  description: string;
  tools_used?: string[];
  url?: string;
  project_url?: string;
  category?: string;
  raw_text?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  duration?: string;
}

export interface CertificationItem {
  name: string;
  issuer: string;
  issue_date?: string;
  credential_id?: string;
  date?: string;
  score?: string;
}

export interface AssessmentRecord {
  skill_name?: string;
  code?: string;
  title?: string;
  score: number;
  score_pct?: number;
  passed?: boolean;
  institution?: string;
  completed_at?: Date | string;
  tier?: SkillTier;
  target_skills?: string[];
}

export interface EvaluatedSkill {
  skill_name: string;
  domain_track: string;
  depth_score: number;
  tier: SkillTier;
  matched_signatures: string[];
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  degree: string;
  parsed_skills: string[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  assessments: AssessmentRecord[];
  evaluated_skills?: EvaluatedSkill[];
  resume_data?: string;
  resume_filename?: string;
  resume_mimetype?: string;
  has_resume?: boolean;
}

export interface SkillTaxonomyRule {
  domain: string;
  sub_signatures: string[];
  base_weight: number;
  tier_multiplier: Record<SkillTier, number>;
}

export type SkillTaxonomyMap = Record<string, SkillTaxonomyRule>;

export interface JobSkillRequirement {
  skill: string;
  min_depth: number;
  target_domain?: string;
}

export interface JobListing {
  job_id: string;
  title: string;
  description?: string;
  company: string;
  required_skills: JobSkillRequirement[];
  stipend: string | number;
  eligibility: string;
  embedding?: number[];
}

export interface MatchedSkillDetail {
  skill: string;
  candidate_depth: number;
  required_depth: number;
  match_status: 'exceeds' | 'meets' | 'partial';
}

export interface CourseItem {
  course_id: string;
  title: string;
  description?: string;
  provider: string;
  target_skills: string[];
  target_domain?: string;
  difficulty?: SkillTier;
  url?: string;
  duration_hours?: number;
  rating?: number;
  similarity?: number;
  embedding?: number[];
}

export interface MatchResult {
  job_id: string;
  title: string;
  description?: string;
  company: string;
  overall_match_pct: number;
  qualified: boolean;
  matched_skills: MatchedSkillDetail[];
  missing_skills: string[];
  recommended_courses: (string | CourseItem)[];
}

export interface CandidateMatchSummary {
  student_id: string;
  match_pct: number;
}

export interface AssessmentQuestionItem {
  question_id: string;
  question_text: string;
  options: string[];
  correct_option: number;
  difficulty?: SkillTier;
  explanation?: string;
}

export interface AssessmentSuite {
  assessment_id: string;
  code: string;
  title: string;
  description: string;
  institution: string;
  target_role: string;
  target_skills: string[];
  difficulty: SkillTier;
  duration_minutes: number;
  questions: AssessmentQuestionItem[];
}

export interface AssessmentSuiteSubmission {
  student_id: string;
  assessment_id: string;
  answers: {
    question_id: string;
    selected_option: number;
  }[];
}

export interface AssessmentSuiteResult {
  assessment_id: string;
  total_questions: number;
  correct_answers: number;
  score_pct: number;
  passed: boolean;
  updated_tier: SkillTier;
  feedback: string;
  question_results: {
    question_id: string;
    is_correct: boolean;
    correct_option: number;
    selected_option: number;
  }[];
}

export interface QuizQuestion {
  question_id: string;
  skill_name: string;
  question_text: string;
  options: string[];
  correct_option: number | string;
  difficulty: SkillTier;
  institution?: string;
}

export interface QuizSubmission {
  student_id: string;
  skill_name: string;
  question_id: string;
  selected_option: number | string;
}

export interface QuizResult {
  skill_name: string;
  question_id: string;
  selected_option: number | string;
  score: number;
  updated_tier: SkillTier;
}

export interface RadarChartMetric {
  domain: string;
  score: number;
  skill_count: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SkillRating {
  skill: string;
  domain: string;
  depth: number;
  tier: SkillTier;
  confidence?: number;
}

export interface ParsedResume {
  name: string;
  email: string;
  degree: string;
  certifications: CertificationItem[];
  rawText: string;
  skills: string[];
  projects: ProjectItem[];
  ratings: SkillRating[];
}

export interface CanonicalSkill {
  id: string;
  canonical_name: string;
  domain: string;
  base_weight: number;
  aliases: string[];
}

export interface ProcessingJob {
  jobId: string;
  type: 'resume' | 'scrape' | 'embedding';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; error?: string }>;
  uptime: number;
}

export interface EmbeddingResult {
  vectors: number[][];
  model: string;
  dimensions: number;
}

export interface ScoringBreakdown {
  llmScore: number;
  vectorScore: number;
  certificationBonus: number;
  assessmentScore: number;
  finalScore: number;
  weights: { llm: number; vector: number; cert: number; assessment: number };
}

export type UserRole = 'student' | 'recruiter' | 'faculty';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institution_or_company?: string;
  created_at?: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}
