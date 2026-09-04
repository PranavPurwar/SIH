import { ref, computed, watch } from '../../vue.js';
import TraceabilityMatrix from '../../components/TraceabilityMatrix.js';
import { decodeHtml } from '../../utils/formatters.js';

export default {
  name: 'RecruiterCandidatesView',
  components: {
    TraceabilityMatrix
  },
  props: {
    candidates: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    selectedJobId: {
      type: String,
      default: null
    },
    jobs: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update-status', 'view-candidate', 'filter-job'],
  setup(props, { emit }) {
    const activeJobFilter = ref(props.selectedJobId || 'all');
    const sortBy = ref('posting');
    const searchFilter = ref('');
    const selectedAppModal = ref(null);

    function openCandidateModal(app) {
      selectedAppModal.value = app;
    }

    function closeCandidateModal() {
      selectedAppModal.value = null;
    }

    watch(() => props.selectedJobId, (newVal) => {
      activeJobFilter.value = newVal || 'all';
    });

    function onFilterChange() {
      emit('filter-job', activeJobFilter.value === 'all' ? null : activeJobFilter.value);
    }

    function clearFilter() {
      activeJobFilter.value = 'all';
      searchFilter.value = '';
      emit('filter-job', null);
    }

    const availableJobOptions = computed(() => {
      const map = new Map();

      (props.jobs || []).forEach(j => {
        const id = j.job_id || j.id;
        if (id) {
          map.set(id, {
            id,
            title: j.title || 'Technical Role',
            company: j.company || '',
            count: 0
          });
        }
      });

      (props.candidates || []).forEach(c => {
        const id = c.job_id || c.job?.job_id;
        if (id) {
          if (!map.has(id)) {
            map.set(id, {
              id,
              title: c.job_title || c.job?.title || 'Technical Role',
              company: c.company || c.job?.company || '',
              count: 0
            });
          }
          const item = map.get(id);
          if (item) item.count++;
        }
      });

      return Array.from(map.values()).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    });

    const selectedJobObj = computed(() => {
      if (!activeJobFilter.value || activeJobFilter.value === 'all') return null;
      return availableJobOptions.value.find(j => j.id === activeJobFilter.value) || null;
    });

    const filteredCandidates = computed(() => {
      let list = [...(props.candidates || [])];

      if (activeJobFilter.value && activeJobFilter.value !== 'all') {
        const targetId = activeJobFilter.value;
        list = list.filter(c => c.job_id === targetId || c.job?.job_id === targetId);
      }

      if (searchFilter.value.trim()) {
        const q = searchFilter.value.toLowerCase().trim();
        list = list.filter(c => 
          (c.student?.name || '').toLowerCase().includes(q) ||
          (c.student?.email || '').toLowerCase().includes(q) ||
          (c.job_title || '').toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q) ||
          (c.status || '').toLowerCase().includes(q) ||
          (c.student?.parsed_skills || []).some(s => s.toLowerCase().includes(q))
        );
      }

      list.sort((a, b) => {
        if (sortBy.value === 'posting') {
          const comp = (a.job_title || '').localeCompare(b.job_title || '');
          if (comp !== 0) return comp;
          return (Number(b.match_pct) || 0) - (Number(a.match_pct) || 0);
        }
        if (sortBy.value === 'match_desc') {
          const scoreDiff = (Number(b.match_pct) || 0) - (Number(a.match_pct) || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return (a.job_title || '').localeCompare(b.job_title || '');
        }
        if (sortBy.value === 'name_asc') {
          const nameA = a.student?.name || a.student_id || '';
          const nameB = b.student?.name || b.student_id || '';
          return nameA.localeCompare(nameB);
        }
        if (sortBy.value === 'status') {
          const statusOrder = { 'Selected': 1, 'Shortlisted': 2, 'Under Review': 3, 'Applied': 4, 'Rejected': 5 };
          const orderA = statusOrder[a.status] || 99;
          const orderB = statusOrder[b.status] || 99;
          if (orderA !== orderB) return orderA - orderB;
          return (Number(b.match_pct) || 0) - (Number(a.match_pct) || 0);
        }
        return 0;
      });

      return list;
    });

    function onStatusChange(app) {
      emit('update-status', { id: app.id, status: app.status });
    }

    function viewCandidate(studentId) {
      emit('view-candidate', studentId);
    }

    return {
      activeJobFilter,
      sortBy,
      searchFilter,
      availableJobOptions,
      selectedJobObj,
      filteredCandidates,
      onFilterChange,
      clearFilter,
      onStatusChange,
      viewCandidate,
      decodeHtml,
      selectedAppModal,
      openCandidateModal,
      closeCandidateModal
    };
  },
  template: `
    <div class="space-y-6">
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-serif text-2xl sm:text-3xl text-brand-text font-normal">Candidate Pipeline</h2>
          <p class="text-sm text-brand-muted mt-1">Review applicant competencies, evidence verification, and hiring status.</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="text-xs font-mono bg-[#F5F3FF] text-[#581C87] border border-[#DDD6FE] px-3 py-1.5 rounded-lg flex items-center font-medium shadow-2xs">
            <span class="inline-block w-2 h-2 rounded-full bg-[#581C87] mr-1.5"></span>
            {{ filteredCandidates.length }} of {{ candidates.length }} Candidate{{ candidates.length === 1 ? '' : 's' }}
          </div>
        </div>
      </header>

      <div class="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-brand-border bg-white shadow-2xs">
        <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-brand-muted uppercase tracking-wider font-mono">Position:</span>
            <select 
              v-model="activeJobFilter" 
              @change="onFilterChange" 
              class="text-xs border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white font-mono text-brand-text transition-colors max-w-xs sm:max-w-md"
            >
              <option value="all">All Positions ({{ candidates.length }} applicants)</option>
              <option v-for="job in availableJobOptions" :key="job.id" :value="job.id">
                {{ decodeHtml(job.title) }} ({{ job.company }}) — {{ job.count }} applicant{{ job.count === 1 ? '' : 's' }}
              </option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-brand-muted uppercase tracking-wider font-mono">Sort:</span>
            <select 
              v-model="sortBy" 
              class="text-xs border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white font-mono text-brand-text transition-colors"
            >
              <option value="posting">Job Posting Group</option>
              <option value="match_desc">Highest Match Score</option>
              <option value="name_asc">Candidate Name (A-Z)</option>
              <option value="status">Pipeline Status</option>
            </select>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <input 
            type="text" 
            v-model="searchFilter" 
            placeholder="Filter candidates or skills..." 
            class="text-xs border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text w-full sm:w-56 transition-colors"
          />
          <button 
            v-if="activeJobFilter !== 'all' || searchFilter" 
            @click="clearFilter" 
            class="text-xs font-mono text-[#581C87] hover:underline whitespace-nowrap px-2 py-1"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <!-- Candidates Table View -->
      <div class="border border-brand-border rounded-xl bg-white overflow-hidden shadow-2xs">
        <div v-if="loading" class="text-center py-16 text-sm text-brand-muted font-mono">
          <span class="spinner mr-2"></span> Loading applicants and matching signals...
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-brand-border bg-brand-surface/70 text-brand-muted font-mono text-xs uppercase tracking-wider">
                <th class="py-3.5 px-5">Candidate</th>
                <th class="py-3.5 px-5">Target Position</th>
                <th class="py-3.5 px-5 text-center">Match Score</th>
                <th class="py-3.5 px-5">Key Skills</th>
                <th class="py-3.5 px-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-border">
              <tr v-if="filteredCandidates.length === 0">
                <td colspan="5" class="py-12 text-center text-brand-muted text-sm space-y-2">
                  <div class="font-medium text-brand-text">No applicants found for this filter.</div>
                  <p class="text-xs">Try adjusting your position filter or search term.</p>
                  <button v-if="activeJobFilter !== 'all' || searchFilter" @click="clearFilter" class="btn-secondary text-xs px-3 py-1.5 rounded-lg mt-2 inline-block cursor-pointer">
                    View All {{ candidates.length }} Applicants →
                  </button>
                </td>
              </tr>

              <tr 
                v-for="app in filteredCandidates" 
                :key="app.id"
                class="hover:bg-brand-surface/40 transition-colors"
              >
                <td class="py-4 px-5 align-top">
                  <div>
                    <button 
                      @click="openCandidateModal(app)" 
                      class="text-brand-text font-medium hover:text-[#581C87] transition-colors text-left cursor-pointer"
                    >
                      {{ app.student?.name || app.student_id }}
                    </button>
                  </div>
                  <div class="text-xs text-brand-muted mt-0.5">{{ app.student?.degree || app.student?.email || 'Candidate' }}</div>
                  <div class="mt-2 flex items-center gap-2 flex-wrap">
                    <button 
                      @click="openCandidateModal(app)"
                      class="text-xs font-mono px-2.5 py-1 rounded-md transition-colors inline-flex items-center gap-1.5 font-medium border border-[#DDD6FE] text-[#581C87] bg-[#F5F3FF] hover:bg-[#EDE9FE] cursor-pointer shadow-2xs"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                      </svg>
                      <span>Review Evidence</span>
                    </button>

                    <a 
                      :href="'/api/students/' + app.student_id + '/resume'" 
                      target="_blank" 
                      class="text-xs font-mono text-brand-muted hover:text-[#581C87] hover:underline flex items-center gap-1 font-medium px-1.5 py-0.5"
                    >
                      <span>Resume</span>
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                    </a>
                  </div>
                </td>

                <td class="py-4 px-5 align-top max-w-xs">
                  <div class="text-brand-text font-medium leading-snug">{{ decodeHtml(app.job_title) }}</div>
                  <div v-if="app.notes" class="text-xs text-brand-muted line-clamp-2 mt-1">{{ app.notes }}</div>
                </td>

                <td class="py-4 px-5 align-top text-center">
                  <div class="font-mono text-sm text-[#581C87] font-semibold bg-[#F5F3FF] border border-[#DDD6FE] px-2.5 py-1 rounded-lg inline-block">
                    {{ app.match_pct }}%
                  </div>
                </td>

                <td class="py-4 px-5 align-top">
                  <div class="flex flex-wrap gap-1.5 max-w-xs">
                    <span 
                      v-for="sk in (app.student?.parsed_skills || []).slice(0, 4)" 
                      :key="sk" 
                      class="text-xs bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-brand-text font-mono"
                    >
                      {{ sk }}
                    </span>
                    <span v-if="(app.student?.parsed_skills || []).length > 4" class="text-[11px] font-mono text-brand-muted self-center">
                      +{{ app.student.parsed_skills.length - 4 }}
                    </span>
                  </div>
                </td>

                <td class="py-4 px-5 align-top text-right">
                   <select 
                     v-model="app.status" 
                     @change="onStatusChange(app)" 
                     :class="{
                       'text-emerald-800 bg-emerald-50 border-emerald-300': app.status === 'Selected' || app.status === 'Shortlisted',
                       'text-rose-800 bg-rose-50 border-rose-200': app.status === 'Rejected',
                       'text-brand-text bg-white border-brand-border': app.status !== 'Selected' && app.status !== 'Shortlisted' && app.status !== 'Rejected'
                     }"
                     class="text-xs border rounded-lg px-2.5 py-1.5 outline-none font-medium focus:border-[#581C87] transition-colors shadow-2xs font-mono"
                   >
                     <option value="Applied">Applied</option>
                     <option value="Under Review">Under Review</option>
                     <option value="Shortlisted">Shortlisted</option>
                     <option value="Selected">Selected</option>
                     <option value="Rejected">Rejected</option>
                   </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Professional Candidate Review & Evidence Modal Dialog -->
      <div 
        v-if="selectedAppModal" 
        class="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        @click.self="closeCandidateModal"
      >
        <div class="bg-white rounded-2xl border border-brand-border shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          <!-- Dialog Header -->
          <div class="p-5 sm:p-6 border-b border-brand-border flex items-start justify-between gap-4 bg-brand-surface/40">
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h3 class="font-serif text-2xl text-brand-text font-normal">
                  {{ selectedAppModal.student?.name || selectedAppModal.student_id }}
                </h3>
                <span class="font-mono text-xs text-[#581C87] font-semibold bg-[#F5F3FF] border border-[#DDD6FE] px-2.5 py-0.5 rounded-full">
                  {{ selectedAppModal.match_pct }}% Role Match
                </span>
                <span 
                  :class="{
                    'text-emerald-800 bg-emerald-50 border-emerald-300': selectedAppModal.status === 'Selected' || selectedAppModal.status === 'Shortlisted',
                    'text-rose-800 bg-rose-50 border-rose-200': selectedAppModal.status === 'Rejected',
                    'text-brand-text bg-white border-brand-border': selectedAppModal.status !== 'Selected' && selectedAppModal.status !== 'Shortlisted' && selectedAppModal.status !== 'Rejected'
                  }"
                  class="text-[11px] font-mono px-2 py-0.5 rounded border font-medium"
                >
                  {{ selectedAppModal.status }}
                </span>
              </div>
              <div class="text-xs text-brand-muted mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span class="font-medium text-brand-text">Target: {{ decodeHtml(selectedAppModal.job_title) }}</span>
                <span>•</span>
                <span>{{ selectedAppModal.student?.degree || selectedAppModal.student?.email || 'Candidate' }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <a 
                :href="'/api/students/' + selectedAppModal.student_id + '/resume'" 
                target="_blank"
                class="btn-secondary text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium"
              >
                <span>Resume</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
              <button 
                @click="closeCandidateModal(); viewCandidate(selectedAppModal.student_id);" 
                class="btn-secondary text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium"
              >
                <span>Full Profile →</span>
              </button>
              <button 
                @click="closeCandidateModal" 
                class="text-brand-muted hover:text-brand-text p-1.5 rounded-lg hover:bg-brand-surface border border-transparent hover:border-brand-border transition-colors cursor-pointer"
                title="Close dialog"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Dialog Body: Project-Specific Required Skills Evidence Traceability -->
          <div class="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
            <div>
              <div class="text-xs font-mono text-[#581C87] font-semibold uppercase tracking-wider mb-1">
                Project Requirement Traceability
              </div>
              <p class="text-xs text-brand-muted">
                Cryptographic signal verification, embedding distance, and assessment question traces evaluated specifically for the skills required by this role.
              </p>
            </div>

            <traceability-matrix 
              :candidate="selectedAppModal.student" 
              :job="{ title: selectedAppModal.job_title, required_skills: selectedAppModal.required_skills }"
            ></traceability-matrix>
          </div>

          <!-- Dialog Footer: Triage Actions -->
          <div class="p-4 sm:p-5 border-t border-brand-border bg-brand-surface/60 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="text-xs font-medium text-brand-muted font-mono uppercase tracking-wider">Update Pipeline Status:</span>
              <select 
                v-model="selectedAppModal.status" 
                @change="onStatusChange(selectedAppModal)" 
                :class="{
                  'text-emerald-800 bg-emerald-50 border-emerald-300': selectedAppModal.status === 'Selected' || selectedAppModal.status === 'Shortlisted',
                  'text-rose-800 bg-rose-50 border-rose-200': selectedAppModal.status === 'Rejected',
                  'text-brand-text bg-white border-brand-border': selectedAppModal.status !== 'Selected' && selectedAppModal.status !== 'Shortlisted' && selectedAppModal.status !== 'Rejected'
                }"
                class="text-xs border rounded-lg px-3 py-1.5 outline-none font-medium focus:border-[#581C87] transition-colors shadow-2xs font-mono cursor-pointer"
              >
                <option value="Applied">Applied</option>
                <option value="Under Review">Under Review</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Selected">Selected</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <button 
              @click="closeCandidateModal" 
              class="btn-primary text-xs px-4 py-2 rounded-lg font-medium cursor-pointer"
            >
              Done Reviewing
            </button>
          </div>

        </div>
      </div>

    </div>
  `
};
