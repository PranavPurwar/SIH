import { ref, computed } from '../vue.js';
import type { Ref } from '../vue.js';
import { api } from '../services/api.js';
import type { JobListing, JobApplication, AuthUser } from '../types/index.js';

export function useJobs(currentUser: Ref<AuthUser | null>) {
  const jobsLoading = ref(false);
  const jobMatches = ref<JobListing[]>([]);
  const studentApplications = ref<JobApplication[]>([]);
  const appliedJobIds = computed(() => studentApplications.value.map(a => a.job_id));

  const showPostModal = ref(false);
  const recruiterJobs = ref<JobListing[]>([]);
  const recruiterCandidates = ref<JobApplication[]>([]);
  const recruiterLoading = ref(false);
  const selectedRecruiterJobId = ref('all');

  async function loadJobMatches(studentId: string) {
    if (!studentId) return;
    jobsLoading.value = true;
    try {
      const res = await api.getJobMatches(studentId);
      jobMatches.value = res.matches || [];
    } catch (err) {
      console.error('Failed to load job matches:', err);
    } finally {
      jobsLoading.value = false;
    }
  }

  async function loadStudentApplications(studentId: string) {
    if (!studentId) return;
    try {
      const res = await api.getStudentApplications(studentId);
      studentApplications.value = res.applications || [];
    } catch (err) {
      console.error('Failed to load applications:', err);
    }
  }

  async function handleApplyJob(job: JobListing) {
    const user = currentUser.value;
    if (!user) {
      alert('You must be signed in to apply for positions');
      return;
    }
    try {
      await api.applyJob({
        student_id: user.id,
        job_id: job.job_id,
        match_pct: job.overall_match_pct || 0
      });
      await loadStudentApplications(user.id);
      alert(`Application submitted for ${job.title} at ${job.company}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert('Application submission failed: ' + msg);
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

  async function handleCreateJob(jobData: Partial<JobListing>) {
    try {
      await api.createJob(jobData);
      showPostModal.value = false;
      await loadRecruiterJobs();
      alert('Job posting published successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert('Failed to create job: ' + msg);
    }
  }

  async function handleUpdateCandidateStatus({ id, status }: { id: string; status: string }) {
    try {
      await api.updateApplicationStatus(id, status);
      await loadRecruiterPipeline();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert('Status update failed: ' + msg);
    }
  }

  function handleViewJobCandidates(jobId: string, setTab: (tab: string) => void) {
    selectedRecruiterJobId.value = jobId || 'all';
    setTab('applications');
  }

  async function loadJobs(studentId?: string) {
    if (studentId) {
      await Promise.all([
        loadJobMatches(studentId),
        loadStudentApplications(studentId)
      ]);
    } else {
      await Promise.all([
        loadRecruiterJobs(),
        loadRecruiterPipeline()
      ]);
    }
  }

  return {
    jobsLoading,
    jobMatches,
    studentApplications,
    appliedJobIds,
    showPostModal,
    recruiterJobs,
    recruiterCandidates,
    recruiterLoading,
    selectedRecruiterJobId,
    loadJobs,
    loadJobMatches,
    loadStudentApplications,
    handleApplyJob,
    loadRecruiterJobs,
    loadRecruiterPipeline,
    handleCreateJob,
    handleUpdateCandidateStatus,
    handleViewJobCandidates
  };
}
