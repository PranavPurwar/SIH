import { ref, reactive } from '../vue.js';
import { api } from '../services/api.js';
import type { StudentProfile, RadarMetric, StudentCertification, StudentProject } from '../types/index.js';

export function useStudentProfile() {
  const student = reactive<StudentProfile>({
    id: '',
    name: '',
    email: '',
    degree: '',
    parsed_skills: [],
    projects: [],
    certifications: [],
    assessments: [],
    evaluated_skills: [],
    has_resume: false,
    resume_url: ''
  });

  const radarMetrics = ref<RadarMetric[]>([]);
  const certifications = ref<StudentCertification[]>([]);
  const isUploadingResume = ref(false);

  function getErrorMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback;
  }

  async function loadStudentProfile(studentId: string) {
    if (!studentId) return;
    try {
      const res = await api.getProfile(studentId);
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
    } catch (err: unknown) {
      console.warn('Profile load skipped:', getErrorMessage(err, 'Failed to load profile'));
    }
  }

  async function handleResumeUpload(file: File, studentId: string, onUpdate?: () => Promise<void>) {
    isUploadingResume.value = true;
    try {
      const res = await api.uploadResume(file, studentId);
      if (res) {
        await loadStudentProfile(studentId);
        if (onUpdate) await onUpdate();
        alert('Resume extracted and competency radar updated successfully!');
      }
    } catch (err: unknown) {
      alert('Resume upload failed: ' + getErrorMessage(err, 'Unknown error'));
    } finally {
      isUploadingResume.value = false;
    }
  }

  async function handleAddProject(projectData: StudentProject, studentId: string, onUpdate?: () => Promise<void>) {
    try {
      await api.addProject(studentId, projectData);
      await loadStudentProfile(studentId);
      if (onUpdate) await onUpdate();
    } catch (err: unknown) {
      alert('Failed to add project: ' + getErrorMessage(err, 'Unknown error'));
    }
  }

  async function handleUpdateProject({ index, project }: { index: number; project: Partial<StudentProject> }, studentId: string, onUpdate?: () => Promise<void>) {
    try {
      await api.updateProject(studentId, index, project);
      await loadStudentProfile(studentId);
      if (onUpdate) await onUpdate();
    } catch (err: unknown) {
      alert('Failed to update project: ' + getErrorMessage(err, 'Unknown error'));
    }
  }

  async function handleDeleteProject(index: number, studentId: string, onUpdate?: () => Promise<void>) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.deleteProject(studentId, index);
      await loadStudentProfile(studentId);
      if (onUpdate) await onUpdate();
    } catch (err: unknown) {
      alert('Failed to delete project: ' + getErrorMessage(err, 'Unknown error'));
    }
  }

  async function handleDeleteSkill(skillName: string, studentId: string, onUpdate?: () => Promise<void>) {
    if (!confirm(`Delete skill "${skillName}" from profile?`)) return;
    try {
      await api.deleteSkill(studentId, skillName);
      await loadStudentProfile(studentId);
      if (onUpdate) await onUpdate();
    } catch (err: unknown) {
      alert('Failed to delete skill: ' + getErrorMessage(err, 'Unknown error'));
    }
  }

  return {
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
  };
}
