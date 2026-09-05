import { createApp, ref, onMounted, watch } from './vue.js';

// Domain Composables
import { useAuth } from './composables/useAuth.js';
import { useNavigation } from './composables/useNavigation.js';
import { useCourses } from './composables/useCourses.js';
import { useJobs } from './composables/useJobs.js';
import { useStudentProfile } from './composables/useStudentProfile.js';
import { useAssessments } from './composables/useAssessments.js';

// Types
import type { JobListing, CourseItem, AssessmentSuite } from './types/index.js';

// Components & Views
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
import FacultyProfileView from './views/faculty/FacultyProfileView.js';

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
    FacultyProfileView,
    MentorshipHubView,
    InstitutionalAnalyticsView
  },
  setup() {
    // 1. Auth & Navigation
    const { isAuthenticated, authUser, handleLogin, handleRegister, handleLogout } = useAuth();
    const {
      activeTab,
      publicCandidateId,
      primaryNavTabs,
      setTab,
      checkRoute,
      closePublicCandidate,
      viewCandidatePublic,
      handleCandidateViewOpenLogin
    } = useNavigation(authUser, isAuthenticated);

    function onTabChange(tabId: string) {
      setTab(tabId);
      if (tabId === 'courses') {
        const inst = authUser.value?.role === 'faculty' ? (authUser.value?.institution_or_company || '') : '';
        if (selectedCourseProvider.value !== inst || courses.value.length === 0) {
          handleCourseProvider(inst);
        }
      } else if (tabId === 'quiz' && assessmentSuites.value.length === 0) {
        loadAssessments();
      }
    }

    // 2. Courses
    const {
      courses,
      coursesLoading,
      coursePage,
      totalCourses,
      totalCoursePages,
      selectedCourseDifficulty,
      selectedCourseSource,
      selectedCourseProvider,
      loadCourses,
      handleCourseSearch,
      handleCoursePage,
      handleCourseDifficulty,
      handleCourseSource,
      handleCourseProvider,
      handleCourseReset,
      handleCreateCourse,
      handleUpdateCourse
    } = useCourses();

    // 3. Jobs & Recruiting
    const {
      jobsLoading,
      jobMatches,
      studentApplications,
      appliedJobIds,
      recruiterJobs,
      recruiterCandidates,
      recruiterLoading,
      selectedRecruiterJobId,
      loadJobs,
      handleApplyJob,
      handleCreateJob,
      handleUpdateCandidateStatus,
      handleViewJobCandidates,
    } = useJobs(authUser);

    // 4. Student Profile
    const {
      student,
      radarMetrics,
      certifications,
      isUploadingResume,
      loadStudentProfile,
      handleResumeUpload,
      handleAddProject,
      handleUpdateProject,
      handleDeleteProject,
      handleDeleteSkill
    } = useStudentProfile();

    // 5. Assessments
    const {
      assessmentSuites,
      assessmentsLoading,
      loadAssessments,
      handleSubmitSuiteAssessment,
      handleCreateAssessmentSuite,
      handleUpdateAssessmentSuite
    } = useAssessments();

    // Recruiter Post Job Modal
    const showPostModal = ref<boolean>(false);

    async function loadUserData() {
      if (!isAuthenticated.value || !authUser.value) return;
      const role = authUser.value.role;
      if (role === 'recruiter') {
        await loadJobs();
      } else if (role === 'faculty') {
        const inst = authUser.value.institution_or_company || '';
        selectedCourseProvider.value = inst;
        await Promise.all([loadCourses(1, '', 'all', 'all', inst), loadAssessments()]);
      } else {
        const studentId = authUser.value.id;
        await Promise.all([
          loadStudentProfile(studentId),
          loadJobs(studentId),
          loadCourses(1),
          loadAssessments()
        ]);
      }
    }

    watch([isAuthenticated, authUser], () => {
      if (isAuthenticated.value && authUser.value) {
        loadUserData();
      }
    });

    onMounted(async () => {
      checkRoute();
      window.addEventListener('popstate', checkRoute);
      await loadUserData();
    });

    return {
      // Auth & Navigation
      isAuthenticated,
      authUser,
      publicCandidateId,
      activeTab,
      primaryNavTabs,
      setTab,
      onTabChange,
      handleLogin,
      handleRegister,
      handleLogout,
      closePublicCandidate,
      viewCandidatePublic,
      handleCandidateViewOpenLogin,

      // Courses
      courses,
      coursesLoading,
      coursePage,
      totalCourses,
      totalCoursePages,
      selectedCourseDifficulty,
      selectedCourseSource,
      selectedCourseProvider,
      loadCourses,
      handleCourseSearch,
      handleCoursePage,
      handleCourseDifficulty,
      handleCourseSource,
      handleCourseProvider,
      handleCourseReset,
      handleCreateCourse,
      handleUpdateCourse,

      // Jobs
      jobsLoading,
      jobMatches,
      studentApplications,
      appliedJobIds,
      recruiterJobs,
      recruiterCandidates,
      recruiterLoading,
      selectedRecruiterJobId,
      showPostModal,
      handleApplyJob,
      handleCreateJob,
      handleUpdateCandidateStatus,
      handleViewJobCandidates,

      // Student Profile
      student,
      radarMetrics,
      certifications,
      isUploadingResume,
      handleResumeUpload,
      handleAddProject,
      handleUpdateProject,
      handleDeleteProject,
      handleDeleteSkill,

      // Assessments
      assessmentSuites,
      assessmentsLoading,
      loadAssessments,
      handleSubmitSuiteAssessment,
      handleCreateAssessmentSuite,
      handleUpdateAssessmentSuite
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
          @change-tab="onTabChange"
          @set-tab="onTabChange"
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

            <faculty-profile-view 
              v-if="activeTab === 'faculty-profile' || activeTab === 'profile'"
              :faculty-user="authUser"
            ></faculty-profile-view>

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
              :course-query="courseQuery"
              :selected-difficulty="selectedCourseDifficulty"
              :selected-source="selectedCourseSource"
              :selected-provider="selectedCourseProvider"
              @create-course="handleCreateCourse"
              @update-course="handleUpdateCourse"
              @refresh-courses="loadCourses(1)"
              @search="handleCourseSearch"
              @change-page="handleCoursePage"
              @filter-difficulty="handleCourseDifficulty"
              @filter-source="handleCourseSource"
              @filter-provider="handleCourseProvider"
              @reset-filters="handleCourseReset"
            ></faculty-courses-view>

            <faculty-assessments-view 
              v-if="activeTab === 'quiz'"
              :faculty-user="authUser"
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
              :course-query="courseQuery"
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
          :default-company="authUser?.institution_or_company || authUser?.name || ''"
          @close="showPostModal = false"
          @submit-job="handleCreateJob"
        ></post-job-modal>
      </div>
    </div>
  `
});

app.mount('#app');
