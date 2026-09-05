/**
 * Typed API Service Client
 * Handles authenticated JSON requests, FormData uploads, and named domain operations.
 */
import type { 
  AuthUser, 
  LoginCredentials, 
  RegisterPayload, 
  DemoAccount,
  CourseItem, 
  CourseFilter, 
  PaginatedResult,
  JobListing, 
  JobApplication,
  StudentProfile,
  StudentProject,
  RadarMetric,
  AssessmentSuite,
  AssessmentSubmissionPayload,
  AssessmentSubmissionResult,
  FacultyOpportunity,
  FacultyProfile,
  MentorshipProgram,
  InstitutionalAnalytics
} from '../types/index.js';
import type { FacultyApplicationItem } from '../views/faculty/FacultyOpportunitiesView.js';

let authToken: string = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';

export function setAuthToken(token: string | null, user?: AuthUser | null): void {
  authToken = token || '';
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('token', token);
      if (user) localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
}

export function getAuthToken(): string {
  if (authToken) return authToken;
  return typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
}

export async function api<T = unknown>(
  method: string,
  path: string,
  body: unknown = null,
  isFormData = false
): Promise<T> {
  try {
    const options: RequestInit = { method, headers: {} as Record<string, string> };
    const token = getAuthToken();

    if (token) {
      (options.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      if (isFormData) {
        options.body = body as FormData;
      } else {
        (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
    }

    const res = await fetch(path, options);

    if (res.status === 401) {
      setAuthToken('');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      throw new Error('Unauthorized');
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(json.error.message || 'API Error');
    }

    if (json.meta !== undefined) return json as T;
    return (json.data !== undefined ? json.data : json) as T;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`API Error on ${path}:`, message);
    throw e;
  }
}

// Attach HTTP verb convenience helpers
api.request = api;
api.get = <T = unknown>(path: string) => api<T>('GET', path);
api.post = <T = unknown>(path: string, body?: unknown, isFormData = false) => api<T>('POST', path, body, isFormData);
api.put = <T = unknown>(path: string, body?: unknown) => api<T>('PUT', path, body);
api.patch = <T = unknown>(path: string, body?: unknown) => api<T>('PATCH', path, body);
api.delete = <T = unknown>(path: string) => api<T>('DELETE', path);

// Auth Domain
api.login = (credentials: LoginCredentials): Promise<{ token: string; user: AuthUser }> => 
  api<{ token: string; user: AuthUser }>('POST', '/api/auth/login', credentials);
api.register = (payload: RegisterPayload): Promise<{ token: string; user: AuthUser }> => 
  api<{ token: string; user: AuthUser }>('POST', '/api/auth/register', payload);
api.getMe = (): Promise<{ user: AuthUser }> => api<{ user: AuthUser }>('GET', '/api/auth/me');
api.getDemoAccounts = (): Promise<{ accounts: DemoAccount[] }> => 
  api<{ accounts: DemoAccount[] }>('GET', '/api/auth/demo-accounts');

// Candidate & Profile Domain
api.getProfile = (studentId: string): Promise<{ student: StudentProfile; radar_chart?: RadarMetric[] }> => 
  api<{ student: StudentProfile; radar_chart?: RadarMetric[] }>('GET', `/api/students/${encodeURIComponent(studentId)}/profile`);
api.getPublicProfile = (candidateId: string): Promise<{ student: StudentProfile; radar_chart?: RadarMetric[] }> => 
  api<{ student: StudentProfile; radar_chart?: RadarMetric[] }>('GET', `/api/students/${encodeURIComponent(candidateId)}/public`);
api.uploadResume = (file: File, studentId?: string): Promise<{ success: boolean; extracted_skills?: string[] }> => {
  const formData = new FormData();
  formData.append('resume', file);
  if (studentId) formData.append('student_id', studentId);
  return api<{ success: boolean; extracted_skills?: string[] }>('POST', '/api/students/upload-resume', formData, true);
};
api.addProject = (studentId: string, projectData: StudentProject): Promise<{ success: boolean; project?: StudentProject }> => 
  api<{ success: boolean; project?: StudentProject }>('POST', `/api/students/${encodeURIComponent(studentId)}/projects`, projectData);
api.updateProject = (studentId: string, index: number, projectData: Partial<StudentProject>): Promise<{ success: boolean }> => 
  api<{ success: boolean }>('PUT', `/api/students/${encodeURIComponent(studentId)}/projects/${index}`, projectData);
api.deleteProject = (studentId: string, index: number): Promise<{ success: boolean }> => 
  api<{ success: boolean }>('DELETE', `/api/students/${encodeURIComponent(studentId)}/projects/${index}`);
api.deleteSkill = (studentId: string, skillName: string): Promise<{ success: boolean }> => 
  api<{ success: boolean }>('DELETE', `/api/students/${encodeURIComponent(studentId)}/skills/${encodeURIComponent(skillName)}`);

// Job & Matching Domain
api.getJobs = (params: { company?: string } = {}): Promise<{ jobs: JobListing[] }> => {
  const query = new URLSearchParams();
  if (params.company) query.append('company', params.company);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api<{ jobs: JobListing[] }>('GET', `/api/jobs${qs}`);
};
api.getJobMatches = (studentId: string): Promise<{ matches: JobListing[] }> => 
  api<{ matches: JobListing[] }>('GET', `/api/jobs/matches/${encodeURIComponent(studentId)}`);
api.createJob = (jobData: Partial<JobListing>): Promise<{ success: boolean; job: JobListing }> => 
  api<{ success: boolean; job: JobListing }>('POST', '/api/jobs/create', jobData);

// Applications Domain
api.getAllApplications = (): Promise<{ applications: JobApplication[] }> => 
  api<{ applications: JobApplication[] }>('GET', '/api/applications');
api.getStudentApplications = (studentId: string): Promise<{ applications: JobApplication[] }> => 
  api<{ applications: JobApplication[] }>('GET', `/api/applications/student/${encodeURIComponent(studentId)}`);
api.applyJob = (payload: { student_id: string; job_id: string; match_pct?: number }): Promise<{ success: boolean; application: JobApplication }> => 
  api<{ success: boolean; application: JobApplication }>('POST', '/api/applications/apply', payload);
api.updateApplicationStatus = (id: string, status: string, notes?: string): Promise<{ success: boolean; application: JobApplication }> => 
  api<{ success: boolean; application: JobApplication }>('PATCH', `/api/applications/${encodeURIComponent(id)}/status`, { status, notes });

// Courseware Domain
api.getCourses = (params: CourseFilter = {}): Promise<PaginatedResult<CourseItem>> => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  if (params.query) query.append('q', params.query);
  if (params.domain) query.append('domain', params.domain);
  if (params.difficulty && params.difficulty !== 'all') query.append('difficulty', params.difficulty);
  if (params.provider) query.append('provider', params.provider);
  if (params.source && params.source !== 'all') query.append('source', params.source);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api<PaginatedResult<CourseItem>>('GET', `/api/courses${qs}`);
};
api.createCourse = (courseData: Partial<CourseItem>): Promise<{ success: boolean; course: CourseItem }> => 
  api<{ success: boolean; course: CourseItem }>('POST', '/api/courses/create', courseData);
api.updateCourse = (id: string, courseData: Partial<CourseItem>): Promise<{ success: boolean; course: CourseItem }> => 
  api<{ success: boolean; course: CourseItem }>('PUT', `/api/courses/${encodeURIComponent(id)}`, courseData);

// Assessment Suites Domain
api.getAssessmentSuites = (params: { q?: string; institution?: string; difficulty?: string } = {}): Promise<{ suites: AssessmentSuite[] }> => {
  const query = new URLSearchParams();
  if (params.q) query.append('q', params.q);
  if (params.institution) query.append('institution', params.institution);
  if (params.difficulty) query.append('difficulty', params.difficulty);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api<{ suites: AssessmentSuite[] }>('GET', `/api/assessments${qs}`);
};
api.createAssessmentSuite = (suiteData: Partial<AssessmentSuite>): Promise<{ success: boolean; suite: AssessmentSuite }> => 
  api<{ success: boolean; suite: AssessmentSuite }>('POST', '/api/assessments/create', suiteData);
api.updateAssessmentSuite = (id: string, suiteData: Partial<AssessmentSuite>): Promise<{ success: boolean; suite: AssessmentSuite }> => 
  api<{ success: boolean; suite: AssessmentSuite }>('PUT', `/api/assessments/${encodeURIComponent(id)}`, suiteData);
api.submitAssessmentSuite = (payload: AssessmentSubmissionPayload): Promise<AssessmentSubmissionResult> => 
  api<AssessmentSubmissionResult>('POST', '/api/assessments/submit', payload);

// Faculty Opportunities & Industrial Training Domain
api.getFacultyPrograms = (params: { type?: string; domain?: string } = {}): Promise<{ programs: FacultyOpportunity[] }> => {
  const query = new URLSearchParams();
  if (params.type) query.append('type', params.type);
  if (params.domain) query.append('domain', params.domain);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api<{ programs: FacultyOpportunity[] }>('GET', `/api/faculty/programs${qs}`);
};
api.getFacultyProfile = (email: string): Promise<{ profile: FacultyProfile }> =>
  api<{ profile: FacultyProfile }>('GET', `/api/faculty/profile/${encodeURIComponent(email)}`);

api.updateFacultyProfile = (email: string, payload: Partial<FacultyProfile>): Promise<{ profile: FacultyProfile }> =>
  api<{ profile: FacultyProfile }>('PUT', `/api/faculty/profile/${encodeURIComponent(email)}`, payload);

api.uploadFacultyCV = (email: string, file: File): Promise<{ success: boolean; filename: string; resume_url: string }> => {
  const formData = new FormData();
  formData.append('email', email);
  formData.append('cv', file);
  return api<{ success: boolean; filename: string; resume_url: string }>('POST', '/api/faculty/profile/upload-cv', formData, true);
};

api.applyFacultyProgram = (payload: {
  program_id: string;
  faculty_name: string;
  faculty_email: string;
  institution: string;
  proposal_summary: string;
  cv_attached?: boolean;
  past_grants_summary?: string;
  experience_summary?: string;
  resume_url?: string;
}): Promise<{ success: boolean }> => 
  api<{ success: boolean }>('POST', '/api/faculty/apply', payload);
api.getFacultyApplications = (email: string): Promise<{ applications: FacultyApplicationItem[] }> => 
  api<{ applications: FacultyApplicationItem[] }>('GET', `/api/faculty/applications/${encodeURIComponent(email)}`);

// Mentorship & Industry Learning Programs Domain
api.getLearningPrograms = (params: { type?: string } = {}): Promise<{ programs: MentorshipProgram[] }> => {
  const type = params.type;
  const query = new URLSearchParams();
  if (type && type !== 'All') query.append('type', type);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api<{ programs: MentorshipProgram[] }>('GET', `/api/learning/programs${qs}`);
};
api.createLearningProgram = (payload: Partial<MentorshipProgram>): Promise<{ success: boolean; program: MentorshipProgram }> => 
  api<{ success: boolean; program: MentorshipProgram }>('POST', '/api/learning/create', payload);

// Institutional Analytics Domain
api.getInstitutionalAnalytics = (params: { institution?: string } = {}): Promise<InstitutionalAnalytics> => {
  const query = new URLSearchParams();
  if (params.institution) query.append('institution', params.institution);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api<InstitutionalAnalytics>('GET', `/api/analytics/institution${qs}`);
};

api.getInstitutionStudents = (params: { q?: string; institution?: string } = {}): Promise<{ students: StudentProfile[] }> => {
  const query = new URLSearchParams();
  if (params.q) query.append('q', params.q);
  if (params.institution) query.append('institution', params.institution);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api<{ students: StudentProfile[] }>('GET', `/api/analytics/institution/students${qs}`);
};

export default api;
