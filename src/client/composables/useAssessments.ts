import { ref } from '../vue.js';
import { api } from '../services/api.js';
import type { AssessmentSuite, AssessmentSubmissionPayload } from '../types/index.js';

export function useAssessments() {
  const assessmentSuites = ref<AssessmentSuite[]>([]);
  const assessmentsLoading = ref(false);

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

  async function handleSubmitSuiteAssessment(
    submissionPayload: AssessmentSubmissionPayload,
    studentId: string,
    onUpdate?: () => Promise<void>
  ) {
    try {
      const res = await api.submitAssessmentSuite({
        ...submissionPayload,
        student_id: studentId
      });
      if (onUpdate) await onUpdate();
      if (typeof submissionPayload.callback === 'function') {
        submissionPayload.callback(res);
      }
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert('Assessment evaluation failed: ' + msg);
      throw err;
    }
  }

  async function handleCreateAssessmentSuite(suiteData: Partial<AssessmentSuite>) {
    try {
      await api.createAssessmentSuite(suiteData);
      await loadAssessments();
      alert('Assessment suite published successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert('Failed to publish assessment suite: ' + msg);
    }
  }

  async function handleUpdateAssessmentSuite({ id, suite }: { id: string; suite: Partial<AssessmentSuite> }) {
    try {
      await api.updateAssessmentSuite(id, suite);
      await loadAssessments();
      alert('Assessment suite updated successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert('Failed to update assessment suite: ' + msg);
    }
  }

  return {
    assessmentSuites,
    assessmentsLoading,
    loadAssessments,
    handleSubmitSuiteAssessment,
    handleCreateAssessmentSuite,
    handleUpdateAssessmentSuite
  };
}
