import { ref, computed, onMounted, defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { api } from '../../services/api.js';
import type { AuthUser, InstitutionalAnalytics, StudentProfile } from '../../types/index.js';

export interface InstitutionalAnalyticsViewProps {
  facultyUser?: AuthUser | null;
}

export default defineComponent({
  name: 'InstitutionalAnalyticsView',
  props: {
    facultyUser: {
      type: Object as PropType<AuthUser | null>,
      default: () => null
    }
  },
  emits: ['view-candidate'],
  setup(props, { emit }) {
    const analytics = ref<InstitutionalAnalytics | null>(null);
    const loading = ref<boolean>(true);
    const studentSearchQuery = ref<string>('');

    async function loadAnalytics() {
      loading.value = true;
      try {
        const institution = props.facultyUser?.institution_or_company || '';
        const res = await api.getInstitutionalAnalytics({ institution });
        analytics.value = res as InstitutionalAnalytics;
      } catch (err) {
        console.error('Failed to load institutional analytics:', err);
      } finally {
        loading.value = false;
      }
    }

    onMounted(() => {
      loadAnalytics();
    });

    const filteredCohortStudents = computed<StudentProfile[]>(() => {
      if (!analytics.value?.cohort_students) return [];
      const q = studentSearchQuery.value.trim().toLowerCase();
      if (!q) return analytics.value.cohort_students;
      return analytics.value.cohort_students.filter((st: StudentProfile & { latest_status?: string }) => {
        const skillsText = (st.parsed_skills || []).join(' ').toLowerCase();
        const text = `${st.name} ${st.email} ${st.degree || ''} ${skillsText} ${st.latest_status || ''}`.toLowerCase();
        return text.includes(q);
      });
    });

    function viewCandidate(candId: string) {
      emit('view-candidate', candId);
    }

    return {
      analytics,
      loading,
      studentSearchQuery,
      filteredCohortStudents,
      viewCandidate
    };
  },
  template: `
    <div class="space-y-6">
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif text-2xl sm:text-3xl text-brand-text font-normal">Institutional Placement & Skill Analytics</h2>
          <p class="text-sm text-brand-muted mt-1">Cohort-level skill mapping, industry demand trends, and recruitment conversion metrics.</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="text-xs font-mono text-[#581C87] bg-[#F5F3FF] border border-[#DDD6FE] px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <span class="font-medium">{{ analytics?.institution_name || facultyUser?.institution_or_company || 'Affiliated Institution' }}</span>
          </div>
        </div>
      </header>

      <!-- Institutional Access Isolation Notice -->
      <div class="p-3.5 rounded-xl border border-purple-200 bg-purple-50/70 text-xs text-purple-900 flex items-center justify-between gap-3 shadow-2xs">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-purple-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          <span><strong>Institutional Data Isolation:</strong> Displaying student metrics strictly for <strong>{{ analytics?.institution_name || facultyUser?.institution_or_company || 'your institution' }}</strong>. Access to other universities' student records is restricted.</span>
        </div>
        <span class="font-mono text-[11px] text-purple-800 shrink-0">FERPA / Institutional Scope Enforced</span>
      </div>

      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted font-mono">
        <span class="spinner mr-2"></span> Aggregating cohort telemetry and placement funnel...
      </div>

      <div v-else-if="analytics" class="space-y-6">
        
        <!-- KPI Cards Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border border-brand-border p-5 space-y-1.5 shadow-2xs">
            <div class="text-[11px] font-mono text-brand-muted uppercase tracking-wider">Placement Readiness</div>
            <div class="font-serif text-3xl text-[#581C87] font-semibold">
              {{ analytics.placement_readiness_pct ?? 0 }}%
            </div>
            <div class="text-[11px] text-emerald-700 font-mono">Competency Baseline</div>
          </div>

          <div class="bg-white rounded-xl border border-brand-border p-5 space-y-1.5 shadow-2xs">
            <div class="text-[11px] font-mono text-brand-muted uppercase tracking-wider">Enrolled Cohort</div>
            <div class="font-serif text-3xl text-brand-text font-semibold">
              {{ analytics.total_students ?? 0 }}
            </div>
            <div class="text-[11px] text-brand-muted font-mono">Affiliated Students</div>
          </div>

          <div class="bg-white rounded-xl border border-brand-border p-5 space-y-1.5 shadow-2xs">
            <div class="text-[11px] font-mono text-brand-muted uppercase tracking-wider">Target Requisitions</div>
            <div class="font-serif text-3xl text-brand-text font-semibold">
              {{ analytics.total_jobs ?? 0 }}
            </div>
            <div class="text-[11px] text-brand-muted font-mono">Industry Positions</div>
          </div>

          <div class="bg-white rounded-xl border border-brand-border p-5 space-y-1.5 shadow-2xs">
            <div class="text-[11px] font-mono text-brand-muted uppercase tracking-wider">Shortlisted / Placed</div>
            <div class="font-serif text-3xl text-emerald-700 font-semibold">
              {{ analytics.placed_or_shortlisted_count ?? 0 }}
            </div>
            <div class="text-[11px] text-brand-muted font-mono">
              {{ analytics.total_applications > 0 ? Math.round(((analytics.placed_or_shortlisted_count ?? 0) / analytics.total_applications) * 100) : 0 }}% Conversion Rate
            </div>
          </div>
        </div>

        <!-- Enrolled Student Cohort Directory & Student Search -->
        <div class="bg-white rounded-xl border border-brand-border overflow-hidden shadow-2xs p-5 sm:p-6 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-brand-text">Enrolled Student Cohort Directory</h3>
              <p class="text-xs text-brand-muted mt-0.5">Search and audit verified student portfolios under {{ analytics.institution_name }}.</p>
            </div>
            <div class="text-xs font-mono text-brand-muted">
              {{ filteredCohortStudents.length }} Student{{ filteredCohortStudents.length === 1 ? '' : 's' }} in Cohort
            </div>
          </div>

          <!-- Student Search Bar -->
          <div class="relative">
            <svg class="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input 
              v-model="studentSearchQuery" 
              type="text" 
              placeholder="Search students by name, degree, or verified skills (e.g. Arjun, Elena, Distributed Systems)..." 
              class="w-full text-xs pl-9 pr-8 py-2.5 border border-brand-border rounded-lg outline-none focus:border-[#581C87] bg-white font-sans text-brand-text placeholder:text-brand-muted"
            />
            <button 
              v-if="studentSearchQuery" 
              @click="studentSearchQuery = ''" 
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text p-0.5 cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>

          <!-- Student Cohort Table -->
          <div class="overflow-x-auto border border-brand-border/70 rounded-xl">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-brand-border bg-brand-surface/70 text-brand-muted font-mono uppercase tracking-wider text-[11px]">
                  <th class="py-2.5 px-4 font-medium">Student Name & Degree</th>
                  <th class="py-2.5 px-4 font-medium">Readiness Index</th>
                  <th class="py-2.5 px-4 font-medium">Verified Skills</th>
                  <th class="py-2.5 px-4 font-medium">Pipeline Status</th>
                  <th class="py-2.5 px-4 font-medium text-right">Portfolio</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-brand-border">
                <tr v-if="filteredCohortStudents.length === 0">
                  <td colspan="5" class="py-10 text-center text-brand-muted text-xs">
                    No students currently enrolled under {{ analytics.institution_name }}.
                  </td>
                </tr>
                <tr v-for="st in filteredCohortStudents" :key="st.id" class="hover:bg-brand-surface/40 transition-colors">
                  <!-- Name & Degree -->
                  <td class="py-3 px-4 align-top whitespace-nowrap">
                    <div class="font-medium text-brand-text">{{ st.name }}</div>
                    <div class="text-[11px] text-brand-muted mt-0.5 max-w-xs truncate" :title="st.degree">
                      {{ st.degree }}
                    </div>
                  </td>

                  <!-- Readiness Score -->
                  <td class="py-3 px-4 align-top whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <span class="font-mono font-semibold text-xs text-[#581C87]">{{ st.readiness_pct }}%</span>
                      <div class="w-16 bg-brand-border rounded-full h-1.5 overflow-hidden">
                        <div class="bg-[#581C87] h-full rounded-full" :style="{ width: st.readiness_pct + '%' }"></div>
                      </div>
                    </div>
                  </td>

                  <!-- Skills -->
                  <td class="py-3 px-4 align-top max-w-xs">
                    <div class="flex flex-wrap gap-1">
                      <span 
                        v-for="sk in (st.parsed_skills || []).slice(0, 4)" 
                        :key="sk"
                        class="bg-brand-surface border border-brand-border text-brand-text px-1.5 py-0.5 rounded text-[10px] font-mono"
                      >
                        {{ sk }}
                      </span>
                      <span v-if="(st.parsed_skills || []).length > 4" class="text-[10px] font-mono text-brand-muted self-center">
                        +{{ st.parsed_skills.length - 4 }}
                      </span>
                    </div>
                  </td>

                  <!-- Pipeline Status -->
                  <td class="py-3 px-4 align-top whitespace-nowrap">
                    <span 
                      class="text-[11px] font-mono px-2 py-0.5 rounded border font-medium inline-block"
                      :class="{
                        'bg-emerald-50 text-emerald-800 border-emerald-200': st.latest_status === 'Selected' || st.latest_status === 'Shortlisted',
                        'bg-purple-50 text-purple-800 border-purple-200': st.latest_status === 'Under Review',
                        'bg-brand-surface text-brand-muted border-brand-border': st.latest_status !== 'Selected' && st.latest_status !== 'Shortlisted' && st.latest_status !== 'Under Review'
                      }"
                    >
                      {{ st.latest_status }}
                    </span>
                    <div class="text-[10px] text-brand-muted font-mono mt-0.5">{{ st.applications_count }} active requisition{{ st.applications_count === 1 ? '' : 's' }}</div>
                  </td>

                  <!-- Portfolio Action -->
                  <td class="py-3 px-4 align-top text-right whitespace-nowrap">
                    <button 
                      @click="viewCandidate(st.id)"
                      class="btn-secondary text-xs px-2.5 py-1 rounded-md font-medium cursor-pointer"
                      title="Inspect student skills & evidence"
                    >
                      View Portfolio →
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- In-Demand Skills vs Curriculum Gap Table -->
        <div class="bg-white rounded-xl border border-brand-border overflow-hidden shadow-2xs space-y-4 p-5 sm:p-6">
          <div>
            <h3 class="text-sm font-semibold text-brand-text">Industry In-Demand Skills & Institutional Coverage</h3>
            <p class="text-xs text-brand-muted mt-0.5">Identifies competencies actively demanded by recruiting partners against student curriculum depth.</p>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-brand-border bg-brand-surface/70 text-brand-muted font-mono uppercase tracking-wider text-[11px]">
                  <th class="py-2.5 px-4 font-medium">Competency</th>
                  <th class="py-2.5 px-4 font-medium">Employer Demand</th>
                  <th class="py-2.5 px-4 font-medium">Cohort Alignment</th>
                  <th class="py-2.5 px-4 font-medium text-right">Curriculum Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-brand-border">
                <tr v-if="(analytics.top_in_demand_skills || []).length === 0">
                  <td colspan="4" class="py-8 text-center text-brand-muted text-xs">
                    No active skill demand data available for this cohort.
                  </td>
                </tr>
                <tr v-for="sk in (analytics.top_in_demand_skills || [])" :key="sk.skill" class="hover:bg-brand-surface/40 transition-colors">
                  <td class="py-3 px-4 font-medium text-brand-text font-mono">{{ sk.skill }}</td>
                  <td class="py-3 px-4 text-brand-muted">
                    <span class="font-mono bg-[#F5F3FF] text-[#581C87] border border-[#DDD6FE] px-2 py-0.5 rounded text-[11px] font-medium">
                      {{ sk.demand_count }} Role Requirements
                    </span>
                  </td>
                  <td class="py-3 px-4 max-w-xs">
                    <div class="flex items-center gap-2">
                      <div class="flex-1 bg-brand-border rounded-full h-1.5 overflow-hidden">
                        <div class="bg-emerald-600 h-full rounded-full" :style="{ width: (100 - sk.avg_gap_pct) + '%' }"></div>
                      </div>
                      <span class="font-mono text-xs text-brand-text">{{ 100 - sk.avg_gap_pct }}% Covered</span>
                    </div>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <span 
                      class="text-[10px] font-mono px-2 py-0.5 rounded border font-medium"
                      :class="sk.avg_gap_pct > 30 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'"
                    >
                      {{ sk.avg_gap_pct > 30 ? 'FDP Remediation Recommended' : 'Optimal Syllabus Alignment' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Hiring Funnel & Domain Distribution Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          <!-- Hiring Funnel Breakdown -->
          <div class="bg-white rounded-xl border border-brand-border p-5 space-y-4 shadow-2xs">
            <div>
              <h4 class="text-sm font-semibold text-brand-text">Recruitment & Placement Funnel</h4>
              <p class="text-xs text-brand-muted mt-0.5">Candidate status transitions across partner job requisitions.</p>
            </div>

            <div class="space-y-2.5 text-xs font-mono">
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-brand-surface border border-brand-border">
                <span class="text-brand-text">1. Total Applications Submitted</span>
                <span class="font-bold text-[#581C87]">{{ analytics.hiring_funnel?.applied ?? 0 }}</span>
              </div>
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-brand-surface border border-brand-border">
                <span class="text-brand-text">2. Under Technical Review</span>
                <span class="font-bold text-brand-text">{{ analytics.hiring_funnel?.under_review ?? 0 }}</span>
              </div>
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                <span class="text-purple-900 font-medium">3. Shortlisted for Interviews</span>
                <span class="font-bold text-purple-900">{{ analytics.hiring_funnel?.shortlisted ?? 0 }}</span>
              </div>
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span class="text-emerald-900 font-medium">4. Selected / Placed</span>
                <span class="font-bold text-emerald-900">{{ analytics.hiring_funnel?.selected ?? 0 }}</span>
              </div>
            </div>
          </div>

          <!-- Domain Competency Breakdown -->
          <div class="bg-white rounded-xl border border-brand-border p-5 space-y-4 shadow-2xs">
            <div>
              <h4 class="text-sm font-semibold text-brand-text">Domain Competency Distribution</h4>
              <p class="text-xs text-brand-muted mt-0.5">Average verified depth across technical tracks.</p>
            </div>

            <div class="space-y-3 pt-1">
              <div v-if="(analytics.domain_competency_distribution || []).length === 0" class="py-6 text-center text-brand-muted text-xs">
                No domain competency telemetry recorded for this cohort.
              </div>
              <div v-for="d in (analytics.domain_competency_distribution || [])" :key="d.domain" class="space-y-1">
                <div class="flex items-center justify-between text-xs font-mono">
                  <span class="font-medium text-brand-text">{{ d.domain }}</span>
                  <span class="text-[#581C87] font-semibold">{{ Math.round(d.avg_score) }}% Avg</span>
                </div>
                <div class="bg-brand-border/70 rounded-full h-2 overflow-hidden">
                  <div class="bg-[#581C87] h-full rounded-full" :style="{ width: Math.min(100, d.avg_score) + '%' }"></div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  `
});
