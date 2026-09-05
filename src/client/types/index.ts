export type Role = 'student' | 'recruiter' | 'faculty';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  institution_or_company?: string;
  degree?: string;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  onComplete?: () => void;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password?: string;
  role: Role;
  degree?: string;
  institution_or_company?: string;
  onComplete?: () => void;
}

export interface DemoAccount {
  name: string;
  tag: string;
  email: string;
  role: 'student' | 'faculty' | 'recruiter';
  roleLabel: string;
}

export interface CourseItem {
  id?: string;
  course_id: string;
  title: string;
  description: string;
  provider: string;
  target_skills: string[] | string;
  target_domain: string;
  difficulty: string;
  url: string;
  source?: string;
  duration_hours?: number;
  rating?: number;
  created_at?: string;
}

export interface CourseFilter {
  query?: string;
  domain?: string;
  difficulty?: string;
  provider?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages?: number;
  };
}

export interface JobListing {
  id?: string;
  job_id: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  stipend?: string;
  salary_range?: string;
  eligibility?: string;
  skills_required?: string[];
  required_skills?: string[] | string;
  target_domain?: string;
  overall_match_pct?: number;
  created_at?: string;
}

export interface NewJobPayload {
  title: string;
  description: string;
  company: string;
  stipend: string;
  eligibility: string;
  required_skills: string;
}

export type ApplicationStatus =
  | 'Applied'
  | 'Under Review'
  | 'Shortlisted'
  | 'Selected'
  | 'Rejected';

export interface JobApplication {
  id: string;
  job_id: string;
  student_id: string;
  status: ApplicationStatus | string;
  match_pct?: number;
  applied_at?: string;
  notes?: string;
  job?: Partial<JobListing>;
  student?: Partial<StudentProfile>;
  job_title?: string;
  company?: string;
}

export interface CandidateApplication extends JobApplication {
  student: StudentProfile;
  job: JobListing;
}

export interface StudentProject {
  id?: string;
  title: string;
  description: string;
  category?: string;
  url?: string;
  tools_used?: string[] | string;
  skills_used?: string[];
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface StudentSkill {
  name: string;
  level?: number;
  score?: number;
  depth_score?: number;
  verified?: boolean;
}

export interface StudentCertification {
  id?: string;
  credential_id?: string;
  name?: string;
  title?: string;
  issuer?: string;
  issue_date?: string;
  date?: string;
  completed_at?: string;
  score?: string | number;
  score_pct?: number;
}

export interface StudentAssessmentAttempt {
  assessment_id?: string;
  code?: string;
  title?: string;
  score?: number;
  score_pct?: number;
  passed?: boolean;
  institution?: string;
  completed_at?: string;
  target_skills?: string[];
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  degree?: string;
  institution_or_company?: string;
  institution?: string;
  skills?: string[];
  parsed_skills: string[];
  projects: StudentProject[];
  certifications: StudentCertification[];
  assessments: StudentAssessmentAttempt[];
  evaluated_skills: StudentSkill[];
  has_resume?: boolean;
  resume_url?: string;
}

export interface RadarMetric {
  domain: string;
  score: number;
  benchmark?: number;
}

export interface AssessmentQuestion {
  question_id: string;
  question_text: string;
  options: string[];
  correct_option: number;
  explanation?: string;
  difficulty?: string;
}

export interface AssessmentSuite {
  id?: string;
  assessment_id?: string;
  code: string;
  title: string;
  institution: string;
  target_role: string;
  target_skills: string[];
  difficulty: string;
  duration_minutes: number;
  description: string;
  questions: AssessmentQuestion[];
  created_by?: string;
}

export interface AssessmentAnswerPayload {
  question_id: string;
  selected_option: number;
}

export interface AssessmentSubmissionPayload {
  assessment_id: string;
  student_id?: string;
  answers: AssessmentAnswerPayload[];
  callback?: (result: AssessmentSubmissionResult) => void;
}

export interface AssessmentSubmissionResult {
  score: number;
  total_questions: number;
  passed: boolean;
  percentage: number;
  details?: Array<{
    question_id: string;
    is_correct: boolean;
    explanation?: string;
  }>;
}

export type TraceabilityStatus = 'VERIFIED' | 'CALIBRATED' | 'TARGET_GAP';

export interface EvidenceTrace {
  skill: string;
  status: TraceabilityStatus;
  projectProof: string | null;
  projectTitle: string | null;
  assessmentSignal: string | null;
  assessmentScore: number | null;
  confidence: string;
}

export interface FacultyOpportunity {
  id: string;
  title: string;
  organization: string;
  description: string;
  domain: string;
  type: string;
  eligibility: string;
  stipend_grant: string;
  application_deadline?: string;
}

export interface MentorshipProgram {
  id: string;
  title: string;
  company: string;
  mentor_name?: string;
  mentor_title?: string;
  description: string;
  target_skills: string[];
  type: string;
  mode: string;
  duration_weeks?: number;
  enrolled?: boolean;
}

export interface InstitutionalAnalytics {
  total_enrolled: number;
  avg_assessment_score: number;
  placement_rate: number;
  cohort_students: StudentProfile[];
  top_demand_skills: Array<{ skill: string; demand_count: number }>;
  domain_distribution: Array<{ domain: string; count: number }>;
}

export interface NavTab {
  id: string;
  name: string;
}

export interface OptionItem {
  id: string;
  label: string;
}

export interface FacultyExperienceItem {
  title: string;
  organization: string;
  role_type?: string;
  start_year: string;
  end_year: string;
  description: string;
}

export interface FacultyPublicationItem {
  title: string;
  journal_or_conference: string;
  year: string;
  doi_or_url?: string;
  citations?: string;
}

export interface FacultyGrantItem {
  title: string;
  funding_agency: string;
  grant_amount: string;
  year: string;
  status: 'Active' | 'Completed' | 'Under Review';
  role: string;
}

export interface FacultyProjectItem {
  title: string;
  area: string;
  description: string;
  role: string;
  year: string;
  url?: string;
}

export interface FacultyConsultingItem {
  client_partner: string;
  area: string;
  duration: string;
  outcomes: string;
}

export interface FacultyProfile {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  institution: string;
  department?: string;
  designation?: string;
  bio?: string;
  domains: string[];
  experience: FacultyExperienceItem[];
  research_projects: FacultyProjectItem[];
  publications: FacultyPublicationItem[];
  grants: FacultyGrantItem[];
  consulting: FacultyConsultingItem[];
  google_scholar_url?: string;
  orcid_id?: string;
  has_resume?: boolean;
  resume_filename?: string;
  resume_mimetype?: string;
  resume_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FacultyApplicationItem {
  id: string;
  program_id: string;
  faculty_name: string;
  faculty_email: string;
  institution: string;
  proposal_summary: string;
  status: string;
  applied_at: string;
  cv_attached?: boolean;
  past_grants_summary?: string;
  experience_summary?: string;
  resume_url?: string;
  program?: FacultyOpportunity;
}
