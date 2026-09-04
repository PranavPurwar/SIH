import { createApp, ref, reactive, computed, onMounted } from './vue.js';
import { api, setAuthToken, getAuthToken } from './services/api.js';

import Navbar from './components/Navbar.js';
import PostJobModal from './components/PostJobModal.js';
import LoginView from './views/LoginView.js';
import ProfileView from './views/ProfileView.js';
import PublicCandidateView from './views/PublicCandidateView.js';
import JobMatchesView from './views/student/JobMatchesView.js';
import ApplicationsView from './views/student/ApplicationsView.js';
import CoursesView from './views/student/CoursesView.js';
import AssessmentView from './views/student/AssessmentView.js';
import RecruiterJobsView from './views/recruiter/RecruiterJobsView.js';
import RecruiterCandidatesView from './views/recruiter/RecruiterCandidatesView.js';
import FacultyCoursesView from './views/faculty/FacultyCoursesView.js';
import FacultyAssessmentsView from './views/faculty/FacultyAssessmentsView.js';
import FacultyOpportunitiesView from './views/faculty/FacultyOpportunitiesView.js';
import MentorshipHubView from './views/shared/MentorshipHubView.js';
import InstitutionalAnalyticsView from './views/faculty/InstitutionalAnalyticsView.js';
import TraceabilityMatrix from './components/TraceabilityMatrix.js';

const app = createApp({
  name: 'App',
  components: {
    Navbar,
    PostJobModal,
    LoginView,
    ProfileView,
    PublicCandidateView,
    JobMatchesView,
    ApplicationsView,
    CoursesView,
    AssessmentView,
    RecruiterJobsView,
    RecruiterCandidatesView,
    FacultyCoursesView,
    FacultyAssessmentsView,
    FacultyOpportunitiesView,
    MentorshipHubView,
    InstitutionalAnalyticsView,
    TraceabilityMatrix
  },
  setup() {
    const isAuthenticated = ref(!!getAuthToken());
    const authUser = ref(JSON.parse(localStorage.getItem('user') || 'null'));
    const publicCandidateId = ref(null);
    const initialRole = JSON.parse(localStorage.getItem('user') || '{}')?.role;
    const activeTab = ref(initialRole === 'faculty' ? 'faculty-programs' : 'jobs');

    const primaryNavTabs = computed(() => {
      const role = authUser.value?.role || 'student';
      if (role === 'recruiter') {
        return [
          { id: 'jobs', name: 'Job Postings' },
          { id: 'applications', name: 'Candidates Pipeline' },
          { id: 'profile', name: 'Company Profile' }
        ];
      } else if (role === 'faculty') {
        return [
          { id: 'faculty-programs', name: 'Faculty Opportunities' },
          { id: 'analytics', name: 'Institutional Analytics' },
          { id: 'mentorship', name: 'Mentorship & Programs' }
        ];
      }
      return [
        { id: 'jobs', name: 'Positions' },
        { id: 'applications', name: 'Applications' },
        { id: 'mentorship', name: 'Mentorship & Programs' },
        { id: 'courses', name: 'Courseware' },
        { id: 'quiz', name: 'Assessments' },
        { id: 'profile', name: 'Profile' }
      ];
    });

    const studentId = computed(() => authUser.value?.id || 'pranav-purwar');

    const student = reactive({ evaluated_skills: [], projects: [], assessments: [] });
    const radarMetrics = ref([]);
    const certifications = ref([]);
    const isUploadingResume = ref(false);

    const jobsLoading = ref(false);
    const jobMatches = ref([]);
    const studentApplications = ref([]);
    const appliedJobIds = computed(() => studentApplications.value.map(a => a.job_id));

    const coursesLoading = ref(false);
    const courses = ref([]);
    const coursePage = ref(1);
    const totalCourses = ref(0);
    const totalCoursePages = ref(1);
    const courseQuery = ref('');
    const selectedCourseDifficulty = ref('all');
    const selectedCourseSource = ref('all');

    const assessmentSuites = ref([]);
    const assessmentsLoading = ref(false);

    const showPostModal = ref(false);
    const recruiterJobs = ref([]);
    const recruiterCandidates = ref([]);
    const recruiterLoading = ref(false);
    const selectedRecruiterJobId = ref('all');

    function handleViewJobCandidates(jobId) {
      selectedRecruiterJobId.value = jobId || 'all';
      setTab('applications');
    }

    function checkRoute() {
      const path = window.location.pathname;
      if (path.startsWith('/candidate/') || path.startsWith('/student/')) {
        const parts = path.split('/');
        if (parts[2]) {
          publicCandidateId.value = parts[2];
        }
      } else if (path === '/jobs') {
        activeTab.value = 'jobs';
      } else if (path === '/courses') {
        activeTab.value = 'courses';
      } else if (path === '/assessments' || path === '/quiz') {
        activeTab.value = 'quiz';
      } else if (path === '/profile') {
        activeTab.value = 'profile';
      } else if (path === '/faculty' || path === '/faculty-programs') {
        activeTab.value = 'faculty-programs';
      } else if (path === '/analytics') {
        activeTab.value = 'analytics';
      } else if (path === '/mentorship') {
        activeTab.value = 'mentorship';
      } else if (path === '/recruiter') {
        activeTab.value = 'applications';
      }
    }

    function setTab(tabId) {
      activeTab.value = tabId;
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', `/${tabId === 'quiz' ? 'assessments' : tabId}`);
      }
      if (tabId === 'jobs') {
        if (authUser.value?.role === 'recruiter') loadRecruiterJobs();
        else loadJobMatches();
      } else if (tabId === 'courses') {
        loadCourses(1);
      } else if (tabId === 'quiz') {
        loadAssessments();
      } else if (tabId === 'applications') {
        if (authUser.value?.role === 'recruiter') loadRecruiterPipeline();
        else loadStudentApplications();
      } else if (tabId === 'profile') {
        loadStudentProfile();
      }
    }

    async function loadStudentProfile() {
      if (!isAuthenticated.value) return;
      try {
        const res = await api.getProfile(studentId.value);
        if (res?.student) {
          const profile = res.student;
          student.id = profile.id;
          student.name = profile.name;
          student.email = profile.email;
          student.degree = profile.degree;
          student.parsed_skills = profile.parsed_skills || [];
          student.projects = profile.projects || [];
          student.certifications = profile.certifications || [];
          student.assessments = profile.assessments || [];
          student.evaluated_skills = profile.evaluated_skills || [];
          student.has_resume = profile.has_resume;
          student.resume_url = profile.resume_url;

          radarMetrics.value = res.radar_chart || [];
          certifications.value = profile.certifications || [];
        }
      } catch (err) {
        console.warn('Profile load skipped:', err.message);
      }
    }

    async function loadJobMatches() {
      if (!isAuthenticated.value) return;
      jobsLoading.value = true;
      try {
        const res = await api.getJobMatches(studentId.value);
        jobMatches.value = res.matches || [];
      } catch (err) {
        console.error('Failed to load job matches:', err);
      } finally {
        jobsLoading.value = false;
      }
    }

    async function loadStudentApplications() {
      if (!isAuthenticated.value) return;
      try {
        const res = await api.getStudentApplications(studentId.value);
        studentApplications.value = res.applications || [];
      } catch (err) {
        console.error('Failed to load applications:', err);
      }
    }

    async function loadCourses(page = 1, query = courseQuery.value, difficulty = selectedCourseDifficulty.value, source = selectedCourseSource.value) {
      coursesLoading.value = true;
      coursePage.value = page;
      if (query !== undefined) courseQuery.value = query;
      if (difficulty !== undefined) selectedCourseDifficulty.value = difficulty;
      if (source !== undefined) selectedCourseSource.value = source;

      try {
        const res = await api.getCourses({
          page,
          limit: 12,
          q: courseQuery.value,
          difficulty: selectedCourseDifficulty.value,
          source: selectedCourseSource.value
        });

        courses.value = res.data;
        totalCourses.value = res.meta.total;
        totalCoursePages.value = Math.ceil(res.meta.total / (res.meta.limit || 12)) || 1;
      } catch (err) {
        console.error('Failed to load courses:', err);
      } finally {
        coursesLoading.value = false;
      }
    }

    function handleCourseSearch(query) {
      loadCourses(1, query, selectedCourseDifficulty.value, selectedCourseSource.value);
    }

    function handleCourseDifficulty(diff) {
      loadCourses(1, courseQuery.value, diff, selectedCourseSource.value);
    }

    function handleCourseSource(src) {
      loadCourses(1, courseQuery.value, selectedCourseDifficulty.value, src);
    }

    function handleCoursePage(p) {
      loadCourses(p, courseQuery.value, selectedCourseDifficulty.value, selectedCourseSource.value);
    }

    function handleCourseReset() {
      courseQuery.value = '';
      selectedCourseDifficulty.value = 'all';
      selectedCourseSource.value = 'all';
      loadCourses(1, '', 'all', 'all');
    }

    async function loadAssessments() {
      assessmentsLoading.value = true;
      try {
        const res = await api.getAssessmentSuites();
        assessmentSuites.value = res.suites || [];
      } catch (err) {
        console.error('Failed to load assessments:', err);
      } finally {
        assessmentsLoading.value = false;
      }
    }

    async function loadRecruiterJobs() {
      recruiterLoading.value = true;
      try {
        const res = await api.getJobs();
        recruiterJobs.value = res.jobs || [];
      } catch (err) {
        console.error('Failed to load recruiter jobs:', err);
      } finally {
        recruiterLoading.value = false;
      }
    }

    async function loadRecruiterPipeline() {
      recruiterLoading.value = true;
      try {
        const [appRes, jobRes] = await Promise.all([
          api.getAllApplications(),
          api.getJobs()
        ]);
        recruiterCandidates.value = appRes.applications || [];
        recruiterJobs.value = jobRes.jobs || [];
      } catch (err) {
        console.error('Failed to load recruiter pipeline:', err);
      } finally {
        recruiterLoading.value = false;
      }
    }

    async function handleLogin(credentials) {
      try {
        const res = await api.login(credentials);
        if (res && res.token) {
          setAuthToken(res.token, res.user);
          isAuthenticated.value = true;
          authUser.value = res.user;

          if (res.user.role === 'recruiter') {
            setTab('jobs');
          } else if (res.user.role === 'faculty') {
            setTab('faculty-programs');
          } else {
            setTab('jobs');
          }
        }
      } catch (err) {
        alert(err.message || 'Login failed');
      }
    }

    async function handleRegister(payload) {
      try {
        const res = await api.register(payload);
        if (res && res.token) {
          setAuthToken(res.token, res.user);
          isAuthenticated.value = true;
          authUser.value = res.user;

          if (res.user.role === 'recruiter') {
            setTab('jobs');
          } else if (res.user.role === 'faculty') {
            setTab('faculty-programs');
          } else {
            setTab('jobs');
          }
        }
      } catch (err) {
        alert(err.message || 'Registration failed');
      }
    }

    function handleLogout() {
      setAuthToken(null);
      isAuthenticated.value = false;
      authUser.value = null;
      window.location.pathname = '/';
    }

    async function handleResumeUpload(file) {
      isUploadingResume.value = true;
      try {
        const res = await api.uploadResume(file, studentId.value);
        if (res) {
          await loadStudentProfile();
          await loadJobMatches();
          alert('Resume extracted and competency radar updated successfully!');
        }
      } catch (err) {
        alert('Resume upload failed: ' + (err.message || 'Unknown error'));
      } finally {
        isUploadingResume.value = false;
      }
    }

    async function handleApplyJob(job) {
      try {
        await api.applyJob({
          student_id: studentId.value,
          job_id: job.job_id,
          match_pct: job.overall_match_pct || 0
        });
        await loadStudentApplications();
        alert(`Application submitted for ${job.title} at ${job.company}!`);
      } catch (err) {
        alert('Application submission failed: ' + err.message);
      }
    }

    async function handleAddProject(projectData) {
      try {
        await api.addProject(studentId.value, projectData);
        await loadStudentProfile();
        await loadJobMatches();
      } catch (err) {
        alert('Failed to add project: ' + err.message);
      }
    }

    async function handleUpdateProject({ index, project }) {
      try {
        await api.updateProject(studentId.value, index, project);
        await loadStudentProfile();
        await loadJobMatches();
      } catch (err) {
        alert('Failed to update project: ' + err.message);
      }
    }

    async function handleDeleteProject(index) {
      if (!confirm('Are you sure you want to delete this project?')) return;
      try {
        await api.deleteProject(studentId.value, index);
        await loadStudentProfile();
        await loadJobMatches();
      } catch (err) {
        alert('Failed to delete project: ' + err.message);
      }
    }

    async function handleDeleteSkill(skillName) {
      if (!confirm(`Delete skill "${skillName}" from profile?`)) return;
      try {
        await api.deleteSkill(studentId.value, skillName);
        await loadStudentProfile();
        await loadJobMatches();
      } catch (err) {
        alert('Failed to delete skill: ' + err.message);
      }
    }

    async function handleSubmitSuiteAssessment(submissionPayload) {
      try {
        const res = await api.submitAssessmentSuite({
          ...submissionPayload,
          student_id: studentId.value
        });
        await loadStudentProfile();
        await loadJobMatches();
        if (typeof submissionPayload.callback === 'function') {
          submissionPayload.callback(res);
        }
        return res;
      } catch (err) {
        alert('Assessment evaluation failed: ' + err.message);
        throw err;
      }
    }

    async function handleCreateJob(jobData) {
      try {
        await api.createJob(jobData);
        showPostModal.value = false;
        await loadRecruiterJobs();
        alert('Job posting published successfully!');
      } catch (err) {
        alert('Failed to create job: ' + err.message);
      }
    }

    async function handleUpdateCandidateStatus({ id, status }) {
      try {
        await api.updateApplicationStatus(id, status);
        await loadRecruiterPipeline();
      } catch (err) {
        alert('Status update failed: ' + err.message);
      }
    }

    async function handleCreateCourse(courseData) {
      try {
        await api.createCourse(courseData);
        await loadCourses(1);
        alert('Course curriculum added successfully!');
      } catch (err) {
        alert('Failed to add course: ' + err.message);
      }
    }

    async function handleCreateAssessmentSuite(suiteData) {
      try {
        await api.createAssessmentSuite(suiteData);
        await loadAssessments();
        alert('Assessment suite published successfully!');
      } catch (err) {
        alert('Failed to publish assessment suite: ' + err.message);
      }
    }

    async function handleUpdateAssessmentSuite({ id, suite }) {
      try {
        await api.updateAssessmentSuite(id, suite);
        await loadAssessments();
        alert('Assessment suite updated successfully!');
      } catch (err) {
        alert('Failed to update assessment suite: ' + err.message);
      }
    }

    function viewCandidatePublic(candId) {
      publicCandidateId.value = candId;
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', `/candidate/${candId}`);
      }
    }

    function closePublicCandidate() {
      publicCandidateId.value = null;
      const role = authUser.value?.role;
      if (role === 'recruiter') {
        activeTab.value = 'applications';
        loadRecruiterPipeline();
      }
      const targetRoute = role === 'recruiter' ? '/recruiter' : (activeTab.value === 'quiz' ? '/assessments' : `/${activeTab.value || 'jobs'}`);
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', targetRoute);
      }
    }

    function handleCandidateViewOpenLogin() {
      publicCandidateId.value = null;
      if (!isAuthenticated.value) {
        if (window.history && window.history.pushState) {
          window.history.pushState({}, '', '/login');
        }
      }
    }

    onMounted(async () => {
      checkRoute();
      window.addEventListener('popstate', checkRoute);

      if (isAuthenticated.value) {
        const role = authUser.value?.role;
        if (role === 'recruiter') {
          loadRecruiterJobs();
          loadRecruiterPipeline();
        } else if (role === 'faculty') {
          loadCourses(1);
          loadAssessments();
        } else {
          await loadStudentProfile();
          loadJobMatches();
          loadStudentApplications();
          loadCourses(1);
          loadAssessments();
        }
      }
    });

    return {
      isAuthenticated,
      authUser,
      publicCandidateId,
      activeTab,
      primaryNavTabs,
      student,
      radarMetrics,
      certifications,
      isUploadingResume,
      jobsLoading,
      jobMatches,
      studentApplications,
      appliedJobIds,
      coursesLoading,
      courses,
      coursePage,
      totalCourses,
      totalCoursePages,
      selectedCourseDifficulty,
      selectedCourseSource,
      assessmentSuites,
      assessmentsLoading,
      showPostModal,
      recruiterJobs,
      recruiterCandidates,
      recruiterLoading,
      selectedRecruiterJobId,
      handleViewJobCandidates,
      setTab,
      loadCourses,
      handleCourseSearch,
      handleCourseDifficulty,
      handleCourseSource,
      handleCoursePage,
      handleCourseReset,
      loadAssessments,
      handleLogin,
      handleRegister,
      handleLogout,
      handleResumeUpload,
      handleApplyJob,
      handleAddProject,
      handleUpdateProject,
      handleDeleteProject,
      handleDeleteSkill,
      handleSubmitSuiteAssessment,
      handleCreateJob,
      handleUpdateCandidateStatus,
      handleCreateCourse,
      handleCreateAssessmentSuite,
      handleUpdateAssessmentSuite,
      viewCandidatePublic,
      closePublicCandidate,
      handleCandidateViewOpenLogin
    };
  },
  template: `
    <div class="flex-1 flex flex-col min-h-screen">
      <public-candidate-view 
        v-if="publicCandidateId"
        :candidate-id="publicCandidateId"
        :is-authenticated="isAuthenticated"
        :auth-user="authUser"
        @navigate-home="closePublicCandidate"
        @open-login="handleCandidateViewOpenLogin"
      ></public-candidate-view>

      <login-view 
        v-else-if="!isAuthenticated"
        @login="handleLogin"
        @register="handleRegister"
      ></login-view>

      <div v-else class="flex-1 flex flex-col">
        <navbar 
          :auth-user="authUser"
          :active-tab="activeTab"
          :tabs="primaryNavTabs"
          @change-tab="setTab"
          @logout="handleLogout"
        ></navbar>

        <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <template v-if="authUser?.role === 'recruiter'">
            <recruiter-jobs-view 
              v-if="activeTab === 'jobs'"
              :jobs="recruiterJobs"
              :loading="recruiterLoading"
              @open-post-modal="showPostModal = true"
              @view-candidates="handleViewJobCandidates"
            ></recruiter-jobs-view>

            <recruiter-candidates-view 
              v-if="activeTab === 'applications'"
              :candidates="recruiterCandidates"
              :jobs="recruiterJobs"
              :selected-job-id="selectedRecruiterJobId"
              :loading="recruiterLoading"
              @filter-job="(jobId) => selectedRecruiterJobId = jobId || 'all'"
              @update-status="handleUpdateCandidateStatus"
              @view-candidate="viewCandidatePublic"
            ></recruiter-candidates-view>
          </template>

          <template v-else-if="authUser?.role === 'faculty'">
            <faculty-opportunities-view 
              v-if="activeTab === 'faculty-programs'"
              :faculty-user="authUser"
            ></faculty-opportunities-view>

            <institutional-analytics-view 
              v-if="activeTab === 'analytics'"
              :faculty-user="authUser"
              @view-candidate="viewCandidatePublic"
            ></institutional-analytics-view>

            <mentorship-hub-view 
              v-if="activeTab === 'mentorship'"
              user-role="faculty"
              :current-user="authUser"
            ></mentorship-hub-view>

            <faculty-courses-view 
              v-if="activeTab === 'courses'"
              :faculty-user="authUser"
              :courses="courses"
              :loading="coursesLoading"
              :current-page="coursePage"
              :total-pages="totalCoursePages"
              :total-courses="totalCourses"
              :selected-difficulty="selectedCourseDifficulty"
              :selected-source="selectedCourseSource"
              @create-course="handleCreateCourse"
              @refresh-courses="loadCourses(1)"
              @search="handleCourseSearch"
              @change-page="handleCoursePage"
              @filter-difficulty="handleCourseDifficulty"
              @filter-source="handleCourseSource"
              @reset-filters="handleCourseReset"
            ></faculty-courses-view>

            <faculty-assessments-view 
              v-if="activeTab === 'quiz'"
              :assessments="assessmentSuites"
              :loading="assessmentsLoading"
              @create-assessment="handleCreateAssessmentSuite"
              @update-assessment="handleUpdateAssessmentSuite"
              @refresh-assessments="loadAssessments"
            ></faculty-assessments-view>
          </template>

          <template v-else>
            <job-matches-view 
              v-if="activeTab === 'jobs'"
              :jobs="jobMatches"
              :loading="jobsLoading"
              :applied-job-ids="appliedJobIds"
              @apply-job="handleApplyJob"
            ></job-matches-view>

            <applications-view 
              v-if="activeTab === 'applications'"
              :applications="studentApplications"
            ></applications-view>

            <mentorship-hub-view 
              v-if="activeTab === 'mentorship'"
              user-role="student"
              :current-user="authUser"
            ></mentorship-hub-view>

            <courses-view 
              v-if="activeTab === 'courses'"
              :courses="courses"
              :loading="coursesLoading"
              :current-page="coursePage"
              :total-pages="totalCoursePages"
              :total-courses="totalCourses"
              :selected-difficulty="selectedCourseDifficulty"
              :selected-source="selectedCourseSource"
              @search="handleCourseSearch"
              @change-page="handleCoursePage"
              @filter-difficulty="handleCourseDifficulty"
              @filter-source="handleCourseSource"
              @reset-filters="handleCourseReset"
            ></courses-view>

            <assessment-view 
              v-if="activeTab === 'quiz'"
              :assessments="assessmentSuites"
              :student="student"
              :student-assessments="student.assessments || []"
              :loading="assessmentsLoading"
              @submit-suite-assessment="handleSubmitSuiteAssessment"
            ></assessment-view>
          </template>

          <profile-view 
            v-if="activeTab === 'profile'"
            :auth-user="authUser"
            :student="student"
            :radar-metrics="radarMetrics"
            :is-uploading="isUploadingResume"
            :courses="courses"
            :assessments="assessmentSuites"
            :total-courses="totalCourses"
            @upload-resume="handleResumeUpload"
            @add-project="handleAddProject"
            @update-project="handleUpdateProject"
            @delete-project="handleDeleteProject"
            @delete-skill="handleDeleteSkill"
            @navigate-tab="setTab"
          ></profile-view>
        </main>

        <post-job-modal 
          :is-open="showPostModal"
          :default-company="authUser?.name || 'Enterprise Systems'"
          @close="showPostModal = false"
          @submit-job="handleCreateJob"
        ></post-job-modal>
      </div>
    </div>
  `
});

app.mount('#app');
