import { ref, computed, onMounted, defineComponent } from '../vue.js';
import type { PropType } from '../vue.js';
import RadarChart from '../components/RadarChart.js';
import TraceabilityMatrix from '../components/TraceabilityMatrix.js';
import { formatTimeline } from '../utils/formatters.js';
import type {
  AuthUser,
  StudentProfile,
  RadarMetric,
  StudentCertification,
  StudentAssessmentAttempt,
  StudentProject
} from '../types/index.js';

export interface PublicCandidateViewProps {
  candidateId: string;
  isAuthenticated: boolean;
  authUser: AuthUser | null;
}

export default defineComponent({
  name: 'PublicCandidateView',
  components: {
    RadarChart,
    TraceabilityMatrix
  },
  props: {
    candidateId: {
      type: String,
      required: true
    },
    isAuthenticated: {
      type: Boolean,
      default: false
    },
    authUser: {
      type: Object as PropType<AuthUser | null>,
      default: null
    }
  },
  emits: ['navigate-home', 'open-login'],
  setup(props, { emit }) {
    const loading = ref<boolean>(true);
    const error = ref<string | null>(null);
    const student = ref<StudentProfile | null>(null);
    const radarMetrics = ref<RadarMetric[]>([]);
    const activeSection = ref<string>('credentials');
    const copiedId = ref<string | null>(null);
    const copiedLink = ref<boolean>(false);

    async function loadPublicProfile() {
      loading.value = true;
      error.value = null;
      try {
        const res = await fetch(`/api/students/${props.candidateId}/public`);
        const json = await res.json();
        if (json.data && json.data.student) {
          student.value = json.data.student;
          radarMetrics.value = json.data.radar_chart || [];
        } else {
          error.value = json.error?.message || 'Candidate profile not found';
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        error.value = 'Failed to load public candidate profile: ' + message;
      } finally {
        loading.value = false;
      }
    }

    const allCertifications = computed<StudentCertification[]>(() => {
      return student.value?.certifications || [];
    });

    const allAssessments = computed<StudentAssessmentAttempt[]>(() => {
      return student.value?.assessments || [];
    });

    const allProjects = computed<StudentProject[]>(() => {
      return student.value?.projects || [];
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

    function copyShareLink() {
      const url = window.location.origin + '/candidate/' + props.candidateId;
      navigator.clipboard.writeText(url).then(() => {
        copiedLink.value = true;
        setTimeout(() => {
          copiedLink.value = false;
        }, 2000);
      });
    }

    onMounted(() => {
      loadPublicProfile();
    });

    return {
      loading,
      error,
      student,
      radarMetrics,
      activeSection,
      allCertifications,
      allAssessments,
      allProjects,
      getCertTitle,
      getCertIssuer,
      getCertDate,
      getCertScore,
      getCertId,
      copyCredentialId,
      copiedId,
      copyShareLink,
      copiedLink,
      formatTimeline
    };
  },
  template: `
    <div class="min-h-screen bg-brand-bg pb-16">
      <!-- Public Top Navigation Bar -->
      <header class="border-b border-brand-border bg-[#FAF8FC]/95 backdrop-blur-md sticky top-0 z-30 shadow-2xs">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <a href="/" @click.prevent="$emit('navigate-home')" class="font-serif text-xl text-brand-text font-semibold tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#581C87]"></span>
              <span>SkillBridge</span>
            </a>
            <span class="text-xs text-brand-border font-mono">/</span>
            <span class="text-xs font-mono bg-brand-surface text-brand-text px-2.5 py-1 rounded border border-brand-border flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Verified Talent Network
            </span>
          </div>

          <div class="flex items-center gap-3">
            <a 
              :href="'/api/students/' + (student?.id || candidateId) + '/resume'"
              target="_blank"
              class="btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span>View Resume ↗</span>
            </a>
            <button 
              @click="copyShareLink"
              class="btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <svg class="w-3.5 h-3.5 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
              <span>{{ copiedLink ? 'Link Copied!' : 'Share' }}</span>
            </button>

            <!-- When authenticated, show back to dashboard/pipeline button -->
            <button 
              v-if="isAuthenticated"
              @click="$emit('navigate-home')"
              class="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              <span>Back to {{ authUser?.role === 'recruiter' ? 'Candidates Pipeline' : 'Dashboard' }}</span>
            </button>

            <!-- When unauthenticated, show Sign In button -->
            <button 
              v-else
              @click="$emit('open-login')"
              class="btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <!-- Main Content Container -->
      <main class="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-24 space-y-3">
          <div class="spinner mx-auto"></div>
          <p class="text-sm text-brand-muted">Retrieving verified candidate credentials from blockchain and PostgreSQL...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="card p-12 text-center space-y-4">
          <div class="w-12 h-12 rounded-full bg-brand-surface text-brand-text flex items-center justify-center mx-auto text-xl font-serif">!</div>
          <h2 class="font-serif text-xl text-brand-text">Profile Not Available</h2>
          <p class="text-sm text-brand-muted max-w-md mx-auto">{{ error }}</p>
          <a href="/" @click.prevent="$emit('navigate-home')" class="btn-secondary inline-block px-4 py-2 rounded-lg text-sm font-medium mt-2">
            ← Return to SkillBridge Home
          </a>
        </div>

        <!-- Verified Profile Layout -->
        <template v-else-if="student">
          <!-- Profile Header Card -->
          <div class="card p-6 sm:p-8">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div class="flex items-start sm:items-center gap-4">
                <div class="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] flex items-center justify-center text-[#581C87] text-3xl font-serif shrink-0">
                  {{ (student.name || 'C').charAt(0) }}
                </div>
                <div>
                  <div class="flex flex-wrap items-center gap-2.5 mb-1">
                    <h1 class="font-serif text-2xl sm:text-3xl text-brand-text">{{ student.name }}</h1>
                    <span class="text-xs font-mono bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <svg class="w-3 h-3 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      Verified Candidate
                    </span>
                  </div>
                  <div class="text-sm text-brand-muted">{{ student.email }}</div>
                  <div v-if="student.degree" class="text-xs text-brand-text font-medium mt-1.5 flex items-center gap-1.5">
                    <svg class="w-4 h-4 opacity-70 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                    </svg>
                    <span>{{ student.degree }}</span>
                  </div>
                </div>
              </div>

              <div class="sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-brand-border flex sm:flex-col justify-between items-start sm:items-end gap-2.5">
                <div>
                  <div class="text-[11px] font-mono text-brand-muted">Candidate Handle</div>
                  <div class="font-mono text-xs font-medium text-brand-text select-all mt-0.5">@{{ student.id }}</div>
                </div>
                <a 
                  :href="'/api/students/' + student.id + '/resume'"
                  target="_blank"
                  class="btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium text-[#581C87] hover:bg-[#F5F3FF] border border-[#DDD6FE] flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <svg class="w-3.5 h-3.5 text-[#581C87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span>Resume (PDF) ↗</span>
                </a>
              </div>
            </div>
          </div>

          <!-- Key Metrics Row -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="card p-4 text-center">
              <div class="text-2xl font-serif text-brand-text">{{ allCertifications.length }}</div>
              <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Credentials</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-serif text-brand-text">{{ allAssessments.length }}</div>
              <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Assessments Passed</div>
            </div>
            <div class="card p-4 text-center">
              <div class="text-2xl font-serif text-brand-text">{{ student.evaluated_skills?.length || 0 }}</div>
              <div class="text-xs text-brand-muted mt-1 uppercase tracking-wider font-mono">Skills Evaluated</div>
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
                  :class="activeSection === 'credentials' ? 'bg-[#F5F3FF] text-[#581C87] border border-[#DDD6FE] font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
                >
                  Verified Credentials ({{ allCertifications.length }})
                </button>
                <button 
                  @click="activeSection = 'assessments'"
                  class="px-4 py-1.5 rounded-lg text-xs font-mono transition-colors"
                  :class="activeSection === 'assessments' ? 'bg-[#F5F3FF] text-[#581C87] border border-[#DDD6FE] font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
                >
                  Assessment History ({{ allAssessments.length }})
                </button>
                <button 
                  @click="activeSection = 'projects'"
                  class="px-4 py-1.5 rounded-lg text-xs font-mono transition-colors"
                  :class="activeSection === 'projects' ? 'bg-[#F5F3FF] text-[#581C87] border border-[#DDD6FE] font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
                >
                  Engineering Projects ({{ allProjects.length }})
                </button>
                <button 
                  @click="activeSection = 'traceability'"
                  class="px-4 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5"
                  :class="activeSection === 'traceability' ? 'bg-[#F5F3FF] text-[#581C87] border border-[#DDD6FE] font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                  <span>Evidence Traceability Matrix</span>
                </button>
              </div>
            </div>

            <!-- 1. Verified Credentials Tab -->
            <div v-if="activeSection === 'credentials'">
              <div v-if="allCertifications.length > 0" class="space-y-4">
                <div 
                  v-for="(cert, idx) in allCertifications" 
                  :key="idx"
                  class="p-4 rounded-xl border border-brand-border bg-white transition-all hover:border-[#DDD6FE]"
                >
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div class="flex items-start gap-3.5">
                      <div class="w-10 h-10 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center shrink-0 mt-0.5 text-[#581C87]">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <span v-if="getCertScore(cert)" class="text-xs font-mono font-medium px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800">
                        {{ getCertScore(cert) }}
                      </span>
                      <span class="text-[11px] font-mono px-2 py-0.5 rounded border border-brand-border bg-brand-surface text-brand-text">
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
                No institutional credentials recorded.
              </div>
            </div>

            <!-- 2. Assessment History Tab -->
            <div v-else-if="activeSection === 'assessments'">
              <div v-if="allAssessments.length > 0" class="space-y-4">
                <div 
                  v-for="(asmt, idx) in allAssessments" 
                  :key="idx"
                  class="p-4 rounded-xl border border-brand-border bg-white transition-all hover:border-[#DDD6FE]"
                >
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded border border-brand-border bg-brand-surface text-brand-text">
                          {{ asmt.code }}
                        </span>
                        <h4 
                          @click="$emit('navigate-home')"
                          class="font-medium text-sm text-brand-text hover:text-[#581C87] hover:underline cursor-pointer transition-colors"
                          title="View assessment in SkillBridge"
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
                      <span 
                        :class="asmt.passed ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'"
                        class="text-[11px] font-mono px-2 py-0.5 rounded border"
                      >
                        {{ asmt.passed ? 'Passed' : 'Review' }}
                      </span>
                    </div>
                  </div>

                  <!-- Skill Tags -->
                  <div v-if="asmt.target_skills?.length" class="mt-3 pt-2.5 border-t border-brand-border/60 flex flex-wrap gap-1.5">
                    <span 
                      v-for="sk in asmt.target_skills" 
                      :key="sk"
                      class="text-[11px] px-2 py-0.5 rounded-md bg-brand-surface text-brand-text border border-brand-border font-mono"
                    >
                      {{ sk }}
                    </span>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-8 text-brand-muted text-sm italic">
                No institutional assessments evaluated yet.
              </div>
            </div>

            <!-- 3. Projects and Work Tab -->
            <div v-else-if="activeSection === 'projects'">
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
                    <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-brand-border bg-brand-surface text-brand-text shrink-0 self-start">
                      Verified Artifact
                    </span>
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
                No projects recorded.
              </div>
            </div>

            <!-- 4. Evidence Traceability Matrix Tab -->
            <div v-if="activeSection === 'traceability'" class="space-y-4">
              <traceability-matrix :candidate="student"></traceability-matrix>
            </div>
          </div>
        </template>
      </main>
    </div>
  `
});

