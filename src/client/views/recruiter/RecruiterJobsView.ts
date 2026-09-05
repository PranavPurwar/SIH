import { ref, computed, watch, defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';
import type { JobListing } from '../../types/index.js';

export interface RecruiterJobsViewProps {
  jobs: JobListing[];
  loading: boolean;
}

export default defineComponent({
  name: 'RecruiterJobsView',
  props: {
    jobs: {
      type: Array as PropType<JobListing[]>,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['open-post-modal', 'view-candidates'],
  setup(props, { emit }) {
    const currentPage = ref<number>(1);
    // Page size of 4 postings per page
    const pageSize = ref<number>(4);

    const totalPages = computed<number>(() => {
      const total = props.jobs?.length || 0;
      return Math.ceil(total / pageSize.value) || 1;
    });

    const paginatedJobs = computed<JobListing[]>(() => {
      const list = props.jobs || [];
      const start = (currentPage.value - 1) * pageSize.value;
      return list.slice(start, start + pageSize.value);
    });

    const startItem = computed<number>(() => {
      if (!props.jobs?.length) return 0;
      return (currentPage.value - 1) * pageSize.value + 1;
    });

    const endItem = computed<number>(() => {
      if (!props.jobs?.length) return 0;
      return Math.min(currentPage.value * pageSize.value, props.jobs.length);
    });

    // Google-style visible page buttons
    const visiblePages = computed<(number | string)[]>(() => {
      const current = currentPage.value;
      const total = totalPages.value;
      if (total <= 10) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      const pages: (number | string)[] = [];
      let start = Math.max(1, current - 4);
      let end = Math.min(total, current + 4);
      if (current <= 5) {
        start = 1;
        end = Math.min(total, 10);
      } else if (current + 4 >= total) {
        start = Math.max(1, total - 9);
        end = total;
      }
      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (end < total) {
        if (end < total - 1) pages.push('...');
        pages.push(total);
      }
      return pages;
    });

    watch(() => props.jobs?.length, () => {
      currentPage.value = 1;
    });

    function onPage(p: number) {
      if (p < 1 || p > totalPages.value || p === currentPage.value) return;
      currentPage.value = p;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return {
      currentPage,
      pageSize,
      totalPages,
      paginatedJobs,
      startItem,
      endItem,
      visiblePages,
      onPage,
      decodeHtml
    };
  },
  template: `
    <div class="space-y-6">
      <header class="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 class="font-serif text-3xl text-brand-text mb-2">Job Postings</h1>
          <p class="text-brand-muted text-sm">All open positions across the platform. Manage requisitions and monitor candidate pipelines.</p>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="jobs?.length > 0" class="text-xs font-mono text-brand-muted bg-brand-surface px-3 py-1.5 rounded-lg border border-brand-border">
            {{ jobs.length }} Requisitions Total
          </div>
          <button @click="$emit('open-post-modal')" class="btn-primary text-sm px-4 py-2 rounded-lg font-medium shadow-sm">
            + Post New Role
          </button>
        </div>
      </header>
      
      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
        <span class="spinner mr-2"></span> Loading active job requisitions...
      </div>

      <div v-else-if="jobs.length === 0" class="card p-12 text-center text-brand-muted text-sm">
        <div class="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-4 border border-brand-border text-[#581C87]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
        </div>
        <div class="font-serif text-lg text-brand-text mb-2">No active postings</div>
        <p class="max-w-sm mx-auto leading-relaxed">No jobs found in the platform database. Click "+ Post New Role" to create a requisition.</p>
      </div>
      
      <div v-else class="space-y-4">
        <div v-for="job in paginatedJobs" :key="job.job_id" class="card p-6 transition-colors hover:border-[#DDD6FE] shadow-sm">
          <div class="flex flex-wrap justify-between items-start mb-3 gap-2">
            <div>
              <h3 class="font-serif text-lg text-brand-text mb-1">{{ decodeHtml(job.title) }}</h3>
              <div class="text-sm text-brand-muted flex items-center gap-2">
                <span class="font-medium text-brand-text">{{ decodeHtml(job.company) }}</span>
                <span v-if="job.stipend" class="font-mono text-xs bg-brand-surface px-2 py-0.5 rounded border border-brand-border text-[#581C87] font-medium">{{ job.stipend }}</span>
                <span v-if="job.eligibility" class="text-xs text-brand-muted">• {{ job.eligibility }}</span>
              </div>
            </div>
            <button @click="$emit('view-candidates', job.job_id)" class="text-xs border border-brand-border bg-brand-surface hover:bg-[#F5F3FF] text-[#581C87] hover:border-[#DDD6FE] px-3.5 py-1.5 rounded-lg transition-colors font-medium cursor-pointer">
              View Candidates →
            </button>
          </div>
          <p class="text-sm text-brand-muted mb-4 leading-relaxed max-w-3xl">{{ decodeHtml(job.description) }}</p>
          <div class="text-xs flex flex-wrap items-center gap-2">
            <span class="text-brand-muted font-medium mr-1">Required Skills:</span>
            <span 
              class="bg-brand-surface border border-brand-border px-2 py-1 rounded text-brand-text font-mono text-[11px]" 
              v-for="s in job.required_skills" 
              :key="typeof s === 'string' ? s : s.skill"
            >
              {{ typeof s === 'string' ? s : s.skill }}
              <span v-if="s.min_depth" class="text-brand-muted text-[10px] ml-1">({{ Math.round(s.min_depth * 100) }}%)</span>
            </span>
          </div>
        </div>

        <!-- Google-Style Pagination Bar (Always visible when postings exist) -->
        <div v-if="jobs.length > 0" class="mt-10 pt-6 border-t border-brand-border flex flex-col items-center gap-4">
          <!-- Numbered Navigation Controls -->
          <div class="flex items-center gap-1 sm:gap-2 flex-wrap justify-center select-none">
            <!-- Previous Button -->
            <button 
              @click="onPage(currentPage - 1)" 
              :disabled="currentPage <= 1" 
              class="px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5"
              :class="currentPage <= 1 ? 'opacity-40 cursor-not-allowed bg-gray-50 border-brand-border text-brand-muted' : 'bg-white hover:bg-[#F5F3FF] hover:border-[#DDD6FE] text-[#581C87] border-brand-border font-semibold shadow-2xs cursor-pointer'"
              title="Go to previous page"
            >
              <span>‹ Previous</span>
            </button>

            <!-- Numbered Page Buttons (1 2 3 4 5...) -->
            <template v-for="(p, idx) in visiblePages" :key="idx">
              <span v-if="p === '...'" class="px-2 py-1 text-sm text-brand-muted select-none font-mono">…</span>
              <button 
                v-else
                @click="onPage(p)"
                :class="p === currentPage ? 'bg-[#581C87] text-white border-[#581C87] font-semibold shadow-sm scale-105' : 'bg-white text-brand-text hover:bg-[#F5F3FF] hover:text-[#581C87] hover:border-[#DDD6FE] border-brand-border'"
                class="w-9 h-9 rounded-lg text-xs font-mono font-medium border flex items-center justify-center transition-all cursor-pointer"
              >
                {{ p }}
              </button>
            </template>

            <!-- Next Button -->
            <button 
              @click="onPage(currentPage + 1)" 
              :disabled="currentPage >= totalPages" 
              class="px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5"
              :class="currentPage >= totalPages ? 'opacity-40 cursor-not-allowed bg-gray-50 border-brand-border text-brand-muted' : 'bg-white hover:bg-[#F5F3FF] hover:border-[#DDD6FE] text-[#581C87] border-brand-border font-semibold shadow-2xs cursor-pointer'"
              title="Go to next page"
            >
              <span>Next ›</span>
            </button>
          </div>

          <!-- Requisitions Range Summary -->
          <div class="text-xs text-brand-muted font-mono">
            Showing <span class="font-semibold text-brand-text">{{ startItem }}–{{ endItem }}</span> of <span class="font-semibold text-brand-text">{{ jobs.length }}</span> postings
            <span class="ml-1.5">(Page {{ currentPage }} of {{ totalPages }})</span>
          </div>
        </div>
      </div>
    </div>
  `
});
