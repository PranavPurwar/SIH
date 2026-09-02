import { ref, computed, watch } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';

export default {
  name: 'RecruiterCandidatesView',
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
        list = list.filter(c => {
          return c.job_id === targetId ||
                 (c.job && c.job.job_id === targetId) ||
                 (c.job_title && c.job_title.toLowerCase() === targetId.toLowerCase());
        });
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
      decodeHtml
    };
  },
  template: `
    <div class="space-y-6">
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-serif text-2xl sm:text-3xl text-brand-text font-normal">Candidate Pipeline</h2>
          <p class="text-sm text-brand-muted mt-1">Review student applications, match calibrations, and pipeline status.</p>
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
            <span class="text-xs text-brand-muted font-medium shrink-0">Position:</span>
            <select 
              v-model="activeJobFilter" 
              @change="onFilterChange"
              class="text-xs border border-brand-border bg-[#FAF8FC] text-brand-text rounded-lg px-3 py-1.5 outline-none font-medium focus:border-[#581C87] transition-colors w-full sm:w-72 truncate"
            >
              <option value="all">All Positions ({{ candidates.length }} applicants)</option>
              <option v-for="job in availableJobOptions" :key="job.id" :value="job.id">
                {{ decodeHtml(job.title) }}{{ job.company ? ' (' + decodeHtml(job.company) + ')' : '' }} — {{ job.count }} applicant{{ job.count === 1 ? '' : 's' }}
              </option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-brand-muted font-medium shrink-0">Sort:</span>
            <select 
              v-model="sortBy" 
              class="text-xs border border-brand-border bg-[#FAF8FC] text-brand-text rounded-lg px-3 py-1.5 outline-none font-medium focus:border-[#581C87] transition-colors w-44"
            >
              <option value="posting">By Posting (Role)</option>
              <option value="match_desc">Highest Match Score</option>
              <option value="name_asc">Candidate Name (A-Z)</option>
              <option value="status">Application Status</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <input 
              v-model="searchFilter" 
              placeholder="Search candidate or skill..." 
              class="text-xs border border-brand-border bg-[#FAF8FC] text-brand-text rounded-lg px-3 py-1.5 outline-none focus:border-[#581C87] transition-colors w-44 sm:w-52"
            />
            <button 
              v-if="searchFilter" 
              @click="searchFilter = ''" 
              class="text-xs text-brand-muted hover:text-brand-text"
              title="Clear search"
            >
              ✕
            </button>
          </div>
        </div>

        <div v-if="selectedJobObj || searchFilter || sortBy !== 'posting'" class="flex items-center gap-2">
          <span v-if="selectedJobObj" class="text-xs font-mono text-[#581C87] bg-[#F5F3FF] px-2.5 py-1 rounded border border-[#DDD6FE] flex items-center gap-1.5 truncate max-w-xs">
            <span class="w-1.5 h-1.5 rounded-full bg-[#581C87]"></span>
            {{ decodeHtml(selectedJobObj.title) }}
          </span>
          <button 
            @click="clearFilter"
            class="text-xs font-mono text-brand-muted hover:text-brand-text border border-brand-border hover:bg-brand-surface px-2.5 py-1 rounded-lg transition-colors"
          >
            Reset Filters ✕
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
        <span class="spinner mr-2"></span> Loading candidate pipeline...
      </div>

      <div v-else class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm border-collapse">
            <thead>
              <tr class="border-b border-brand-border bg-brand-surface text-brand-muted font-medium text-xs">
                <th class="py-3.5 px-5">Candidate</th>
                <th class="py-3.5 px-5">Applied Position</th>
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
                  <button v-if="activeJobFilter !== 'all' || searchFilter" @click="clearFilter" class="btn-secondary text-xs px-3 py-1.5 rounded-lg mt-2 inline-block">
                    View All {{ candidates.length }} Applicants →
                  </button>
                </td>
              </tr>
              <tr v-for="app in filteredCandidates" :key="app.id" class="hover:bg-brand-surface/40 transition-colors">
                <td class="py-4 px-5 align-top">
                  <div>
                    <a 
                      :href="'/candidate/' + app.student_id" 
                      @click.prevent="viewCandidate(app.student_id)" 
                      class="text-brand-text font-medium hover:text-[#581C87] transition-colors"
                    >
                      {{ app.student?.name || app.student_id }}
                    </a>
                  </div>
                  <div class="text-xs text-brand-muted mt-0.5">{{ app.student?.degree || app.student?.email || 'Candidate' }}</div>
                  <div class="mt-1.5 flex items-center gap-3">
                    <a 
                      :href="'/candidate/' + app.student_id" 
                      @click.prevent="viewCandidate(app.student_id)"
                      class="text-xs font-mono text-brand-muted hover:text-[#581C87] transition-colors"
                    >
                      View Profile →
                    </a>
                    <span class="text-[10px] text-brand-border">•</span>
                    <a 
                      :href="'/api/students/' + app.student_id + '/resume'" 
                      target="_blank" 
                      class="text-xs font-mono text-[#581C87] hover:underline flex items-center gap-1 font-medium"
                    >
                      Resume ↗
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
    </div>
  `
};
