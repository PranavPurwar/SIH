import { ref, reactive, computed, defineComponent } from '../vue.js';
import type { PropType } from '../vue.js';
import RadarChart from '../components/RadarChart.js';
import { decodeHtml, formatTimeline } from '../utils/formatters.js';
import type {
  AuthUser,
  StudentProfile,
  StudentCertification,
  StudentAssessmentAttempt,
  StudentProject,
  CourseItem,
  AssessmentSuite,
  RadarMetric
} from '../types/index.js';

export interface ProfileViewProps {
  authUser?: AuthUser | null;
  student: StudentProfile | null;
  radarMetrics?: RadarMetric[];
  isUploading?: boolean;
  certifications?: StudentCertification[];
  courses?: CourseItem[];
  assessments?: AssessmentSuite[];
  totalCourses?: number;
}

export default defineComponent({
  name: 'ProfileView',
  components: {
    RadarChart
  },
  props: {
    authUser: {
      type: Object as PropType<AuthUser | null>,
      default: null
    },
    student: {
      type: Object as PropType<StudentProfile | null>,
      default: () => null
    },
    radarMetrics: {
      type: Array as PropType<RadarMetric[]>,
      default: () => []
    },
    isUploading: {
      type: Boolean,
      default: false
    },
    certifications: {
      type: Array as PropType<StudentCertification[]>,
      default: () => []
    },
    courses: {
      type: Array as PropType<CourseItem[]>,
      default: () => []
    },
    assessments: {
      type: Array as PropType<AssessmentSuite[]>,
      default: () => []
    },
    totalCourses: {
      type: Number,
      default: 2152
    }
  },
  emits: ['upload-resume', 'navigate-tab', 'add-project', 'update-project', 'delete-project', 'delete-skill'],
  setup(props, { emit }) {
    const resumeInput = ref<HTMLInputElement | null>(null);
    const activeSection = ref<string>('credentials');
    const copiedId = ref<string | null>(null);

    const showAddProjectModal = ref<boolean>(false);
    const editingProjectIndex = ref<number | null>(null);
    const projectForm = reactive<StudentProject & { tools_used_str?: string }>({
      title: '',
      category: 'Engineering',
      url: '',
      tools_used: '',
      description: '',
      start_date: '',
      end_date: '',
      is_current: false
    });

    function resetProjectForm() {
      projectForm.title = '';
      projectForm.category = 'Engineering';
      projectForm.url = '';
      projectForm.tools_used = '';
      projectForm.description = '';
      projectForm.start_date = '';
      projectForm.end_date = '';
      projectForm.is_current = false;
      editingProjectIndex.value = null;
    }

    function openCreateProject() {
      resetProjectForm();
      showAddProjectModal.value = true;
    }

    function openEditProject(proj: StudentProject, idx: number) {
      editingProjectIndex.value = idx;
      projectForm.title = proj.title || '';
      projectForm.category = proj.category || 'Engineering';
      projectForm.url = proj.url || '';
      projectForm.tools_used = Array.isArray(proj.tools_used) ? proj.tools_used.join(', ') : (proj.tools_used || '');
      projectForm.description = proj.description || '';
      projectForm.start_date = proj.start_date || '';
      projectForm.end_date = proj.end_date || '';
      projectForm.is_current = Boolean(proj.is_current || proj.end_date === 'Present');
      showAddProjectModal.value = true;
    }

    function submitProject() {
      if (!projectForm.title || !projectForm.description) {
        alert('Please provide at least a project title and description.');
        return;
      }
      const payload: StudentProject = {
        title: projectForm.title,
        category: projectForm.category,
        url: projectForm.url,
        tools_used: projectForm.tools_used,
        description: projectForm.description,
        start_date: projectForm.start_date || undefined,
        end_date: projectForm.is_current ? 'Present' : (projectForm.end_date || undefined),
        is_current: projectForm.is_current
      };

      if (editingProjectIndex.value !== null) {
        emit('update-project', {
          index: editingProjectIndex.value,
          ...payload
        });
      } else {
        emit('add-project', payload);
      }
      showAddProjectModal.value = false;
      resetProjectForm();
    }

    function handleDeleteProject(idx: number) {
      if (confirm('Are you sure you want to remove this project?')) {
        emit('delete-project', idx);
      }
    }

    function handleDeleteSkill(skillName: string) {
      if (confirm(`Remove skill "${skillName}" from your profile?`)) {
        emit('delete-skill', skillName);
      }
    }

    function triggerFileInput() {
      if (resumeInput.value) {
        resumeInput.value.click();
      }
    }

    function onFileSelected(event: Event) {
      const target = event.target as HTMLInputElement;
      const file = target?.files?.[0];
      if (file) {
        emit('upload-resume', file);
      }
    }

    const allCertifications = computed<StudentCertification[]>(() => {
      return props.student?.certifications || props.certifications || [];
    });

    const allAssessments = computed<StudentAssessmentAttempt[]>(() => {
      return props.student?.assessments || [];
    });

    function getCertTitle(cert: StudentCertification | null | undefined): string {
      if (!cert) return 'Verified Credential';
      return cert.name || cert.title || 'Verified Credential';
    }

    function getCertIssuer(cert: StudentCertification | null | undefined): string {
      return cert?.issuer || 'Academic Consortium';
    }

    function getCertDate(cert: StudentCertification | null | undefined): string {
      return cert?.issue_date || cert?.date || (cert?.completed_at ? new Date(cert.completed_at).toLocaleDateString() : '');
    }

    function getCertScore(cert: StudentCertification | null | undefined): string | number | null {
      return cert?.score || (cert?.score_pct ? `${cert.score_pct}%` : null);
    }

    function getCertId(cert: StudentCertification | null | undefined): string | null {
      return cert?.credential_id || cert?.id || null;
    }

    function copyCredentialId(id: string) {
      if (!id) return;
      navigator.clipboard.writeText(id).then(() => {
        copiedId.value = id;
        setTimeout(() => {
          copiedId.value = null;
        }, 2000);
      });
    }

    const allProjects = computed(() => {
      return props.student?.projects || [];
    });

    const displayName = computed(() => {
      if (props.authUser?.role === 'student') {
        return props.student?.name || props.authUser?.name || '';
      }
      return props.authUser?.name || '';
    });

    const displayEmail = computed(() => {
      return props.authUser?.email || props.student?.email || '';
    });

    const displayRole = computed(() => {
      return props.authUser?.role || '';
    });

    const displayAffiliation = computed(() => {
      if (props.authUser?.role === 'student') {
        return props.student?.degree || props.authUser?.institution_or_company || '';
      }
      return props.authUser?.institution_or_company || '';
    });

    return {
      resumeInput,
      triggerFileInput,
      onFileSelected,
      activeSection,
      allCertifications,
      allAssessments,
      allProjects,
      displayName,
      displayEmail,
      displayRole,
      displayAffiliation,
      getCertTitle,
      getCertIssuer,
      getCertDate,
      getCertScore,
      getCertId,
      copyCredentialId,
      showAddProjectModal,
      editingProjectIndex,
      openCreateProject,
      openEditProject,
      handleDeleteProject,
      handleDeleteSkill,
      projectForm,
      resetProjectForm,
      submitProject,
      copiedId,
      formatTimeline,
      decodeHtml
    };
  },
  template: `
    <div class="space-y-8 max-w-6xl">
      <header class="mb-8">
        <h1 class="font-serif text-3xl text-brand-text mb-2">
          {{ authUser?.role === 'recruiter' ? 'Company Profile' : authUser?.role === 'faculty' ? 'Institution Profile' : 'Student Portfolio' }}
        </h1>
        <p class="text-brand-muted text-sm">
          {{ authUser?.role === 'student' ? 'Verified multi-signal competency portfolio, credentials, and depth calibration.' : authUser?.role === 'faculty' ? 'Manage verified OpenCourseWare curricula, assessment benchmarks, and academic accreditations.' : 'Manage company requisitions, talent benchmarks, and evaluation pipelines.' }}
        </p>
      </header>

      <!-- Profile Header -->
      <div class="card p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl border border-brand-border bg-[#F1F5F9] flex items-center justify-center text-brand-text text-2xl font-serif">
              {{ (displayName || 'S').charAt(0) }}
            </div>
            <div>
              <div class="flex items-center gap-2.5">
                <h2 class="font-serif text-xl text-brand-text">{{ displayName }}</h2>
                <span class="text-[11px] font-mono px-2 py-0.5 rounded border border-brand-border bg-[#F1F5F9] text-brand-text capitalize">
                  {{ displayRole }}
                </span>
                <span v-if="authUser?.role === 'faculty'" class="text-[11px] font-mono px-2 py-0.5 rounded border border-[#DDD6FE] bg-[#F5F3FF] text-[#581C87]">
                  ✓ Verified Consortium
                </span>
              </div>
              <div class="text-sm text-brand-muted mt-0.5">{{ displayEmail }}</div>
              <div v-if="displayAffiliation" class="text-xs text-brand-muted mt-1 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                </svg>
                <span>{{ displayAffiliation }}</span>
              </div>
            </div>
          </div>

          <div v-if="authUser?.role === 'student'" class="flex flex-col sm:flex-row items-stretch gap-3">
            <a 
              :href="'/api/students/' + (studentProfile?.id || authUser?.id) + '/resume'" 
              target="_blank" 
              class="btn-secondary px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap text-[#581C87] hover:bg-[#F5F3FF] border border-[#DDD6FE]"
            >
              <svg class="w-4 h-4 text-[#581C87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span>View Resume ↗</span>
            </a>
            <input 
              type="file" 
              ref="resumeInput" 
              accept=".pdf" 
              @change="onFileSelected" 
              class="hidden" 
            />
            <button 
              @click="triggerFileInput"
              :disabled="isUploading"
              class="btn-primary px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span v-if="isUploading" class="spinner"></span>
              <svg v-else class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              <span>{{ isUploading ? 'Processing Resume...' : 'Upload / Update Resume' }}</span>
            </button>
          </div>

          <div v-else-if="authUser?.role === 'faculty'" class="flex items-center gap-3">
            <button 
              @click="$emit('navigate-tab', 'courses')"
              class="btn-primary text-xs px-4 py-2 rounded-lg font-medium shadow-sm"
            >
              Manage Courseware →
            </button>
          </div>
        </div>
      </div>

      <template v-if="authUser?.role === 'faculty'">
        <!-- Key Metrics Row (Faculty View) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="card p-4 text-center">
            <div class="text-2xl font-serif text-brand-text">{{ totalCourses > 0 ? totalCourses.toLocaleString() : '2,152' }}</div>
            <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">OCW Modules</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-2xl font-serif text-brand-text">{{ assessments.length > 0 ? assessments.length : 4 }}</div>
            <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Assessment Suites</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-2xl font-serif text-brand-text">16</div>
            <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Core Disciplines</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-2xl font-serif text-[#581C87]">100%</div>
            <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Open Access</div>
          </div>
        </div>

        <!-- OpenCourseWare Curricula Section -->
        <div class="card p-6 space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-brand-border pb-4">
            <div>
              <h3 class="font-serif text-lg text-brand-text">Consortium & Institutional Courseware Modules</h3>
              <p class="text-xs text-brand-muted">Indexed syllabus modules matched against industry skill benchmarks.</p>
            </div>
            <button 
              @click="$emit('navigate-tab', 'courses')"
              class="text-xs border border-brand-border bg-brand-surface hover:bg-[#F3EEF9] text-brand-text px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Browse All {{ totalCourses > 0 ? totalCourses.toLocaleString() : '2,152' }} Modules →
            </button>
          </div>

          <div v-if="courses.length === 0" class="text-center py-8 text-brand-muted text-sm italic">
            <span class="spinner mr-2"></span> Loading published courseware modules...
          </div>

          <div v-else class="space-y-3">
            <div 
              v-for="c in courses.slice(0, 6)" 
              :key="c.course_id" 
              class="p-4 rounded-xl border border-brand-border bg-[#FAF8FC] transition-all hover:border-[#DDD6FE]"
            >
              <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                <div>
                  <h4 class="font-medium text-sm text-brand-text leading-snug">{{ decodeHtml(c.title) }}</h4>
                  <div class="text-xs text-brand-muted mt-1 flex items-center gap-2">
                    <span v-if="c.provider" class="font-medium text-brand-text">{{ c.provider }}</span>
                    <span>• {{ c.duration_hours || 40 }} Hours</span>
                    <span v-if="c.target_domain">• {{ c.target_domain }}</span>
                  </div>
                </div>
                <span class="text-[11px] font-mono bg-[#F3EEF9] text-brand-text border border-brand-border px-2 py-0.5 rounded self-start shrink-0">
                  {{ c.difficulty || 'Intermediate' }}
                </span>
              </div>
              <p class="text-xs text-brand-muted line-clamp-2 leading-relaxed mb-2">
                {{ decodeHtml(c.description) }}
              </p>
              <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-brand-border/60 text-xs">
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="sk in (c.target_skills || []).slice(0, 4)" 
                    :key="sk"
                    class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F3EEF9] text-brand-text border border-brand-border"
                  >
                    {{ sk }}
                  </span>
                </div>
                <a :href="c.url || '#'" target="_blank" class="text-xs font-mono text-[#581C87] hover:underline flex items-center gap-1">
                  <span>View Syllabus</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Institutional Assessment Suites Section -->
        <div class="card p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-brand-border pb-4">
            <div>
              <h3 class="font-serif text-lg text-brand-text">Institutional Assessment Suites</h3>
              <p class="text-xs text-brand-muted">Cryptographically verified academic certification exams issued by consortium institutions.</p>
            </div>
            <button 
              @click="$emit('navigate-tab', 'quiz')"
              class="text-xs border border-brand-border bg-brand-surface hover:bg-[#F3EEF9] text-brand-text px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Manage Suites →
            </button>
          </div>

          <div v-if="assessments.length === 0" class="text-center py-8 text-brand-muted text-sm italic">
            No institutional assessment suites currently published.
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div 
              v-for="asmt in assessments" 
              :key="asmt.assessment_id || asmt.code"
              class="p-4 rounded-xl border border-brand-border bg-[#FAF8FC] space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#F3EEF9] border border-brand-border text-brand-text">
                  {{ asmt.code }}
                </span>
                <span class="text-xs text-brand-muted font-medium">{{ asmt.institution }}</span>
                <span class="text-[10px] font-mono text-[#581C87]">Pass Threshold: {{ asmt.passing_score || 65 }}%</span>
              </div>
              <h4 
                @click="$emit('navigate-tab', 'quiz')"
                class="font-medium text-sm text-brand-text hover:text-[#581C87] hover:underline cursor-pointer transition-colors"
                title="Click to view assessment details"
              >
                {{ asmt.title }}
              </h4>
              <div class="text-xs text-brand-muted flex items-center gap-2">
                <span>{{ asmt.institution }}</span>
                <span>• {{ asmt.duration_minutes || 45 }} mins</span>
                <span v-if="asmt.question_count || asmt.questions?.length">• {{ asmt.question_count || asmt.questions?.length }} questions</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="authUser?.role === 'student'">
        <!-- Key Metrics Row (Student View) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="card p-4 text-center">
            <div class="text-2xl font-serif text-brand-text">{{ allCertifications.length }}</div>
            <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Credentials</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-2xl font-serif text-brand-text">{{ allAssessments.length }}</div>
            <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Evaluations</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-2xl font-serif text-brand-text">{{ student?.evaluated_skills?.length || 0 }}</div>
            <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Skills Calibrated</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-2xl font-serif text-[#581C87]">
              {{ allAssessments.length > 0 ? Math.round(allAssessments.reduce((acc, a) => acc + (a.score_pct || 0), 0) / allAssessments.length) : 100 }}%
            </div>
            <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Average Score</div>
          </div>
        </div>


        <!-- Interactive Credentials, Assessments and Projects Hub -->
        <div class="card p-6">
          <!-- Section Tabs -->
          <div class="flex items-center justify-between border-b border-brand-border pb-4 mb-6">
            <div class="flex flex-wrap items-center gap-2">
              <button 
                @click="activeSection = 'credentials'"
                class="px-4 py-1.5 rounded-lg text-xs font-mono transition-colors"
                :class="activeSection === 'credentials' ? 'bg-[#F1F5F9] text-brand-text border border-brand-border font-medium' : 'text-brand-muted hover:text-brand-text'"
              >
                Verified Credentials ({{ allCertifications.length }})
              </button>
              <button 
                @click="activeSection = 'assessments'"
                class="px-4 py-1.5 rounded-lg text-xs font-mono transition-colors"
                :class="activeSection === 'assessments' ? 'bg-[#F1F5F9] text-brand-text border border-brand-border font-medium' : 'text-brand-muted hover:text-brand-text'"
              >
                Assessment History ({{ allAssessments.length }})
              </button>
              <button 
                @click="activeSection = 'projects'"
                class="px-4 py-1.5 rounded-lg text-xs font-mono transition-colors"
                :class="activeSection === 'projects' ? 'bg-[#F1F5F9] text-brand-text border border-brand-border font-medium' : 'text-brand-muted hover:text-brand-text'"
              >
                Engineering Projects ({{ allProjects.length }})
              </button>
            </div>
          </div>

          <!-- 1. Verified Credentials Tab -->
          <div v-if="activeSection === 'credentials'">
            <div v-if="allCertifications.length > 0" class="space-y-4">
              <div 
                v-for="(cert, idx) in allCertifications" 
                :key="idx"
                class="p-4 rounded-xl border border-brand-border bg-[#FAF8FC] transition-all hover:border-[#DDD6FE]"
              >
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div class="flex items-start gap-3.5">
                    <div class="w-10 h-10 rounded-lg bg-[#F3EEF9] border border-brand-border flex items-center justify-center shrink-0 mt-0.5">
                      <svg class="w-5 h-5 text-[#581C87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 class="font-medium text-sm text-brand-text leading-tight">
                        {{ getCertTitle(cert) }}
                      </h4>
                      <div class="text-xs text-brand-muted mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{{ getCertIssuer(cert) }}</span>
                        <span v-if="getCertDate(cert)">•</span>
                        <span v-if="getCertDate(cert)">Issued {{ getCertDate(cert) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 self-start shrink-0">
                    <span v-if="getCertScore(cert)" class="text-xs font-mono font-medium px-2 py-0.5 rounded border border-[#DDD6FE] bg-[#F5F3FF] text-[#581C87]">
                      {{ getCertScore(cert) }}
                    </span>
                    <span class="text-[11px] font-mono px-2 py-0.5 rounded border border-brand-border bg-[#FFFFFF] text-brand-text">
                      Verified
                    </span>
                  </div>
                </div>

                <!-- Credential ID Bar -->
                <div v-if="getCertId(cert)" class="mt-3.5 pt-2.5 border-t border-brand-border/60 flex items-center justify-between text-xs">
                  <div class="font-mono text-[11px] text-brand-muted">
                    Credential ID: <span class="text-brand-text select-all">{{ getCertId(cert) }}</span>
                  </div>
                  <button 
                    @click="copyCredentialId(getCertId(cert))"
                    class="text-[11px] font-mono text-brand-muted hover:text-brand-text flex items-center gap-1 transition-colors"
                  >
                    <svg v-if="copiedId !== getCertId(cert)" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                    <span>{{ copiedId === getCertId(cert) ? 'Copied!' : 'Copy ID' }}</span>
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-brand-muted text-sm italic">
              No institutional credentials earned yet. Complete role-based assessments with ≥ 65% to earn verified certificates.
            </div>
          </div>

          <!-- 2. Assessment History Tab -->
          <div v-else-if="activeSection === 'assessments'">
            <div v-if="allAssessments.length > 0" class="space-y-4">
              <div 
                v-for="(asmt, idx) in allAssessments" 
                :key="idx"
                class="p-4 rounded-xl border border-brand-border bg-[#FAF8FC] transition-all hover:border-[#DDD6FE]"
              >
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded border border-brand-border bg-[#F3EEF9] text-brand-text">
                        {{ asmt.code }}
                      </span>
                      <h4 
                        @click="$emit('navigate-tab', 'quiz')"
                        class="font-medium text-sm text-brand-text hover:text-[#581C87] hover:underline cursor-pointer transition-colors"
                        title="Click to view assessment details"
                      >
                        {{ asmt.title }}
                      </h4>
                    </div>
                    <div class="text-xs text-brand-muted mt-1">
                      {{ asmt.institution }} • Completed {{ asmt.completed_at ? new Date(asmt.completed_at).toLocaleDateString() : 'Recently' }}
                    </div>
                  </div>

                  <div class="flex items-center gap-3 self-start sm:self-center">
                    <div class="text-right">
                      <div class="text-sm font-semibold font-mono text-[#581C87]">{{ asmt.score_pct }}%</div>
                      <div class="text-[10px] font-mono text-brand-muted uppercase">{{ asmt.tier || 'Calibrated' }}</div>
                    </div>
                    <span class="text-[11px] font-mono px-2 py-0.5 rounded border border-[#DDD6FE] bg-[#F5F3FF] text-[#581C87]">
                      {{ asmt.passed ? 'Passed' : 'Review' }}
                    </span>
                  </div>
                </div>

                <!-- Skill Tags -->
                <div v-if="asmt.target_skills?.length" class="mt-3 pt-2.5 border-t border-brand-border/60 flex flex-wrap gap-1.5">
                  <span 
                    v-for="sk in asmt.target_skills" 
                    :key="sk"
                    class="text-[11px] px-2 py-0.5 rounded-md bg-[#F3EEF9] text-brand-text border border-brand-border font-mono"
                  >
                    {{ sk }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-brand-muted text-sm italic">
              No assessment evaluations recorded yet. Take an assessment in the Assessments tab to begin skill calibration.
            </div>
          </div>

          <!-- 3. Projects and Work Tab -->
          <div v-else-if="activeSection === 'projects'">
            <div class="flex items-center justify-between gap-3 mb-4">
              <div>
                <h4 class="text-xs font-mono font-medium text-brand-muted uppercase tracking-wider">Portfolio & Verified Artifacts</h4>
                <p class="text-xs text-brand-muted">Projects across engineering, research, design, and open source.</p>
              </div>
              <button 
                @click="openCreateProject" 
                class="btn-primary text-xs px-3 py-1.5 rounded-lg font-mono flex items-center gap-1.5 shadow-xs"
              >
                <span>+ Add Project</span>
              </button>
            </div>

            <div v-if="allProjects.length > 0" class="space-y-4">
              <div 
                v-for="(proj, idx) in allProjects" 
                :key="idx"
                class="p-4 rounded-xl border border-brand-border bg-white transition-all hover:border-[#DDD6FE]"
              >
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <h4 class="font-medium text-sm text-brand-text leading-snug">{{ proj.title }}</h4>
                      <span v-if="proj.category" class="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5F3FF] text-[#581C87] border border-[#DDD6FE]">
                        {{ proj.category }}
                      </span>
                      <span v-if="formatTimeline(proj.start_date, proj.end_date, proj.is_current, proj.duration)" class="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-surface text-brand-muted border border-brand-border flex items-center gap-1">
                        <svg class="w-3 h-3 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span>{{ formatTimeline(proj.start_date, proj.end_date, proj.is_current, proj.duration) }}</span>
                      </span>
                    </div>
                    <a 
                      v-if="proj.url || proj.project_url" 
                      :href="proj.url || proj.project_url" 
                      target="_blank" 
                      class="text-xs font-mono text-[#581C87] hover:underline inline-flex items-center gap-1 mt-1 break-all"
                    >
                      <span>🔗 {{ proj.url || proj.project_url }} ↗</span>
                    </a>
                  </div>
                  
                  <div class="flex items-center gap-2 self-start shrink-0">
                    <button 
                      @click="openEditProject(proj, idx)"
                      class="px-2 py-1 rounded text-xs font-mono text-brand-muted hover:text-brand-text hover:bg-brand-surface border border-brand-border bg-white transition-colors flex items-center gap-1"
                      title="Edit Project"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                      </svg>
                      <span>Edit</span>
                    </button>
                    <button 
                      @click="handleDeleteProject(idx)"
                      class="px-2 py-1 rounded text-xs font-mono text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 bg-white transition-colors flex items-center gap-1"
                      title="Delete Project"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
                <p class="text-xs text-brand-muted leading-relaxed mb-3">
                  {{ proj.description }}
                </p>
                <div v-if="proj.tools_used?.length" class="flex flex-wrap gap-1.5 pt-2 border-t border-brand-border/60">
                  <span 
                    v-for="tool in proj.tools_used" 
                    :key="tool"
                    class="text-[11px] px-2 py-0.5 rounded-md bg-brand-surface text-brand-text border border-brand-border font-mono"
                  >
                    {{ tool }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-8 text-brand-muted text-sm italic">
              No projects added yet. Click "+ Add Project" above or upload a resume to populate your portfolio.
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="authUser?.role === 'recruiter'">
        <div class="card p-8 text-center space-y-4">
          <div class="w-12 h-12 rounded-full bg-[#F5F3FF] text-[#581C87] flex items-center justify-center mx-auto text-xl font-serif">🏢</div>
          <h3 class="font-serif text-xl text-brand-text">Company Requisitions and Talent Operations</h3>
          <p class="text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
            Manage your open engineering requisitions, monitor evaluated applicant pipelines, and calibrate candidate competency benchmarks.
          </p>
          <div class="flex justify-center gap-3 pt-2">
            <button @click="$emit('navigate-tab', 'jobs')" class="btn-primary text-xs px-4 py-2 rounded-lg font-medium">
              View Active Jobs →
            </button>
            <button @click="$emit('navigate-tab', 'applications')" class="btn-secondary text-xs px-4 py-2 rounded-lg font-medium">
              Candidate Pipeline →
            </button>
          </div>
        </div>
      </template>

      <div v-if="showAddProjectModal" class="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="card max-w-xl w-full p-6 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-brand-border pb-3">
            <div>
              <h3 class="font-serif text-lg text-brand-text">{{ editingProjectIndex !== null ? 'Edit Project / Artifact' : 'Add Project or Artifact' }}</h3>
              <p class="text-xs text-brand-muted">{{ editingProjectIndex !== null ? 'Update project architecture details, repository links, timeline, or tools.' : 'Showcase your technical engineering, research, design, or open source work.' }}</p>
            </div>
            <button @click="showAddProjectModal = false" class="text-brand-muted hover:text-brand-text text-base">✕</button>
          </div>

          <form @submit.prevent="submitProject" class="space-y-3.5">
            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Project Title *</label>
              <input 
                v-model="projectForm.title" 
                required 
                placeholder="e.g. Bryte AI Platform, GPU Frustum Canvas, Open-Source Research" 
                class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-xs outline-none focus:border-[#581C87]"
              />
            </div>

            <!-- Category & Repository Link -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Category / Domain</label>
                <select 
                  v-model="projectForm.category" 
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-xs outline-none focus:border-[#581C87]"
                >
                  <option value="Engineering">Engineering / Systems</option>
                  <option value="AI & ML">AI & Machine Learning</option>
                  <option value="Open Source">Open Source / Toolchains</option>
                  <option value="Research">Research & Papers</option>
                  <option value="Product">Product & Design</option>
                  <option value="Writing">Writing & Documentation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Project URL / Repository</label>
                <input 
                  v-model="projectForm.url" 
                  type="url" 
                  placeholder="https://github.com/user/project or demo" 
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-xs outline-none focus:border-[#581C87] font-mono"
                />
              </div>
            </div>

            <!-- Project Timeline (Month / Year) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-brand-surface rounded-xl border border-brand-border">
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Start Date (Month / Year)</label>
                <input 
                  v-model="projectForm.start_date" 
                  type="month"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#581C87] font-mono"
                />
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-medium text-brand-muted">End Date</label>
                  <label class="inline-flex items-center gap-1 text-[11px] text-[#581C87] cursor-pointer font-medium select-none">
                    <input type="checkbox" v-model="projectForm.is_current" class="rounded text-[#581C87] focus:ring-0">
                    <span>Ongoing / Present</span>
                  </label>
                </div>
                <input 
                  v-if="!projectForm.is_current"
                  v-model="projectForm.end_date" 
                  type="month"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#581C87] font-mono"
                />
                <div v-else class="w-full bg-white border border-[#DDD6FE] text-[#581C87] px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#581C87]"></span>
                  <span>Present (Active)</span>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Technologies / Tools Used (comma-separated)</label>
              <input 
                v-model="projectForm.tools_used" 
                placeholder="e.g. Kotlin, Rust, PostgreSQL, WebGL, PyTorch, Neo4j" 
                class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-xs outline-none focus:border-[#581C87] font-mono"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Description & Key Contributions *</label>
              <textarea 
                v-model="projectForm.description" 
                required 
                rows="3" 
                placeholder="Describe what you built, architecture choices, performance benchmarks, and impact..." 
                class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-xs outline-none focus:border-[#581C87]"
              ></textarea>
            </div>

            <div class="flex justify-end gap-2.5 pt-2 border-t border-brand-border">
              <button 
                type="button" 
                @click="showAddProjectModal = false" 
                class="btn-secondary text-xs px-3.5 py-1.5 rounded-lg"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                class="btn-primary text-xs px-4 py-1.5 rounded-lg font-medium"
              >
                {{ editingProjectIndex !== null ? 'Update Project & Recalibrate' : 'Save Project & Calibrate Radar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
});
