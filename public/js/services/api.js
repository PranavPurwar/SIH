/**
 * API Service Client
 * Handles authenticated JSON requests, FormData uploads, and named domain operations.
 */

let authToken = localStorage.getItem('token') || '';

export function setAuthToken(token) {
  authToken = token || '';
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

export function getAuthToken() {
  return authToken || localStorage.getItem('token') || '';
}

export async function api(method, path, body = null, isFormData = false) {
  try {
    const options = { method, headers: {} };
    const token = getAuthToken();

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      if (isFormData) {
        options.body = body;
      } else {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
    }

    const res = await fetch(path, options);

    if (res.status === 401) {
      setAuthToken('');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw new Error('Unauthorized');
    }

    const json = await res.json();
    if (json.error) {
      throw new Error(json.error.message || 'API Error');
    }

    if (json.meta !== undefined) return json;
    return json.data !== undefined ? json.data : json;
  } catch (e) {
    console.error(`API Error on ${path}:`, e);
    throw e;
  }
}

// Attach HTTP verb convenience helpers
api.request = api;
api.get = (path) => api('GET', path);
api.post = (path, body, isFormData = false) => api('POST', path, body, isFormData);
api.put = (path, body) => api('PUT', path, body);
api.patch = (path, body) => api('PATCH', path, body);
api.delete = (path) => api('DELETE', path);

// Auth Domain
api.login = (credentials) => api('POST', '/api/auth/login', credentials);
api.register = (payload) => api('POST', '/api/auth/register', payload);
api.getMe = () => api('GET', '/api/auth/me');

// Candidate & Profile Domain
api.getProfile = (studentId) => api('GET', `/api/students/${encodeURIComponent(studentId)}/profile`);
api.getPublicProfile = (candidateId) => api('GET', `/api/students/${encodeURIComponent(candidateId)}/public`);
api.uploadResume = (file, studentId) => {
  const formData = new FormData();
  formData.append('resume', file);
  if (studentId) formData.append('student_id', studentId);
  return api('POST', '/api/students/upload-resume', formData, true);
};
api.addProject = (studentId, projectData) => api('POST', `/api/students/${encodeURIComponent(studentId)}/projects`, projectData);
api.updateProject = (studentId, index, projectData) => api('PUT', `/api/students/${encodeURIComponent(studentId)}/projects/${index}`, projectData);
api.deleteProject = (studentId, index) => api('DELETE', `/api/students/${encodeURIComponent(studentId)}/projects/${index}`);
api.deleteSkill = (studentId, skillName) => api('DELETE', `/api/students/${encodeURIComponent(studentId)}/skills/${encodeURIComponent(skillName)}`);

// Job & Matching Domain
api.getJobs = (params = {}) => {
  const query = new URLSearchParams();
  if (params.company) query.append('company', params.company);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api('GET', `/api/jobs${qs}`);
};
api.getJobMatches = (studentId) => api('GET', `/api/jobs/matches/${encodeURIComponent(studentId)}`);
api.createJob = (jobData) => api('POST', '/api/jobs/create', jobData);

// Applications Domain
api.getAllApplications = () => api('GET', '/api/applications');
api.getStudentApplications = (studentId) => api('GET', `/api/applications/student/${encodeURIComponent(studentId)}`);
api.applyJob = (payload) => api('POST', '/api/applications/apply', payload);
api.updateApplicationStatus = (id, status, notes) => api('PATCH', `/api/applications/${encodeURIComponent(id)}/status`, { status, notes });

// Courseware Domain
api.getCourses = (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));
  if (params.q) query.append('q', params.q);
  if (params.domain) query.append('domain', params.domain);
  if (params.difficulty) query.append('difficulty', params.difficulty);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api('GET', `/api/courses${qs}`);
};
api.createCourse = (courseData) => api('POST', '/api/courses/create', courseData);

// Assessment Suites Domain
api.getAssessmentSuites = (params = {}) => {
  const query = new URLSearchParams();
  if (params.q) query.append('q', params.q);
  if (params.institution) query.append('institution', params.institution);
  if (params.difficulty) query.append('difficulty', params.difficulty);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return api('GET', `/api/assessments${qs}`);
};
api.createAssessmentSuite = (suiteData) => api('POST', '/api/assessments/create', suiteData);
api.updateAssessmentSuite = (id, suiteData) => api('PUT', `/api/assessments/${encodeURIComponent(id)}`, suiteData);
api.submitAssessmentSuite = (payload) => api('POST', '/api/assessments/submit', payload);

export default api;


