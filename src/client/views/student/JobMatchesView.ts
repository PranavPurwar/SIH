import { ref, computed, watch, defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';
import type { JobListing } from '../../types/index.js';

export interface JobMatchesViewProps {
  jobs: JobListing[];
  loading: boolean;
  appliedJobIds: string[];
}

export default defineComponent({
  name: 'JobMatchesView',
  props: {
    jobs: {
      type: Array as PropType<JobListing[]>,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    appliedJobIds: {
      type: Array as PropType<string[]>,
      default: () => []
    }
  },
  emits: ['apply-job'],
  setup(props, { emit }) {
    const currentPage = ref(1);
    // Page size of 3 positions per page for clean, focused viewing and easy page switching
    const pageSize = ref(3);

    const totalPages = computed<number>(() => {
      const total = props.jobs?.length || 0;
      return Math.ceil(total / pageSize.value) || 1;
    });

    const paginatedJobs = computed<JobListing[]>(() => {
      const list = props.jobs || [];
      const start = (currentPage.value - 1) * pageSize.value;
      return list.slice(start, start + pageSize.value);
    });

    const startItem = computed(() => {
      if (!props.jobs?.length) return 0;
      return (currentPage.value - 1) * pageSize.value + 1;
    });

    const endItem = computed(() => {
      if (!props.jobs?.length) return 0;
      return Math.min(currentPage.value * pageSize.value, props.jobs.length);
    });

    // Google-style visible page buttons
    const visiblePages = computed(() => {
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

    function isJobApplied(jobId: string) {
      return props.appliedJobIds.includes(jobId);
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
      decodeHtml,
      isJobApplied
    };
  },
  template: `
    <div class="space-y-6">
      <header class="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 class="font-serif text-3xl text-brand-text mb-2">Available Positions</h1>
          <p class="text-brand-muted text-sm">Ranked by competency alignment with your evaluated skills and portfolio.</p>
        </div>
        <div v-if="jobs?.length > 0" class="text-xs font-mono text-brand-muted bg-brand-surface px-3 py-1.5 rounded-lg border border-brand-border">
          {{ jobs.length }} Matched Positions Total
        </div>
      </header>

      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
        <span class="spinner mr-2"></span> Analyzing competency alignment and matching roles...
      </div>

      <div v-else-if="jobs.length === 0" class="card p-12 text-center text-brand-muted text-sm">
        No matching positions found. Upload your resume or add projects in the Profile tab to view matched opportunities.
      </div>

      <div v-else class="space-y-6">
        <div 
          v-for="m in paginatedJobs" 
          :key="m.job_id"
          class="card p-6 transition-colors hover:border-[#DDD6FE] space-y-4"
        >
          <div class="flex flex-wrap justify-between items-start mb-2 gap-4">
            <div>
              <h3 class="font-serif text-lg text-brand-text leading-tight mb-1">{{ decodeHtml(m.title) }}</h3>
              <div class="text-sm text-brand-muted flex items-center gap-2">
                <span class="font-medium text-brand-text">{{ m.company }}</span>
                <span v-if="m.stipend" class="font-mono text-xs bg-brand-surface px-1.5 py-0.5 rounded border border-brand-border text-brand-text font-medium">{{ m.stipend }}</span>
                <span v-if="m.eligibility" class="text-xs text-brand-muted">• {{ m.eligibility }}</span>
              </div>
            </div>

            <div class="text-right">
              <div class="font-mono text-sm text-[#581C87] font-semibold">{{ m.overall_match_pct }}% Match</div>
              <div class="text-[10px] text-brand-muted">Skill Alignment</div>
            </div>
          </div>

          <p class="text-sm text-brand-muted leading-relaxed mb-4 max-w-3xl">{{ decodeHtml(m.description) }}</p>

          <!-- Competencies Breakdown -->
          <div class="space-y-3 mb-4">
            <div v-if="m.matched_skills?.length">
              <span class="text-xs font-medium text-emerald-700 mr-2">Matched Skills:</span>
              <span v-for="s in m.matched_skills" :key="s.skill" class="inline-block text-xs bg-brand-surface text-brand-text px-2 py-1 rounded border border-brand-border mr-2 mb-2 font-mono">
                {{ s.skill }} <span class="text-brand-muted ml-1">({{ Math.round(s.candidate_depth * 100) }}%)</span>
              </span>
            </div>
            <div v-if="m.missing_skills?.length">
              <span class="text-xs font-medium text-rose-700 mr-2">Target Growth Areas:</span>
              <span v-for="g in m.missing_skills" :key="g" class="inline-block text-xs bg-rose-50/60 text-rose-800 px-2 py-1 rounded border border-rose-200 mr-2 mb-2 font-mono">
                {{ g }}
              </span>
            </div>
          </div>

          <!-- Recommended Courses for Gaps -->
          <div v-if="m.recommended_courses?.length" class="mb-4 p-4 rounded-xl bg-brand-surface border border-brand-border space-y-2">
            <div class="text-xs font-medium text-brand-text flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-[#581C87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
              <span>Recommended Coursework for this Role:</span>
            </div>
            <div class="space-y-2.5 pt-1">
              <div v-for="c in m.recommended_courses" :key="c.course_id || c.title" class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs border-t border-brand-border/60 pt-2 first:border-0 first:pt-0">
                <div>
                  <span class="text-brand-text font-medium">{{ decodeHtml(c.title) }}</span>
                  <div class="text-[11px] text-brand-muted mt-0.5">
                    <span>{{ decodeHtml(c.provider) || 'MIT OpenCourseWare' }}</span>
                    <span v-if="c.target_domain"> • {{ decodeHtml(c.target_domain) }}</span>
                    <span v-if="c.difficulty"> • {{ c.difficulty }}</span>
                  </div>
                </div>
                <a :href="c.url || '#'" target="_blank" class="text-xs font-mono text-[#581C87] hover:underline shrink-0 flex items-center gap-1 font-medium">
                  <span>View Syllabus ↗</span>
                </a>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-brand-border flex justify-end">
            <button 
              v-if="!isJobApplied(m.job_id)"
              @click="$emit('apply-job', m)"
              class="btn-primary text-sm px-4 py-2 rounded-lg font-medium"
            >
              Apply Now
            </button>
            <span v-else class="text-xs font-mono text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              ✓ Application Submitted
            </span>
          </div>
        </div>

        <!-- Google-Style Pagination Bar (Always visible when positions exist) -->
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

          <!-- Position Range Summary -->
          <div class="text-xs text-brand-muted font-mono">
            Showing <span class="font-semibold text-brand-text">{{ startItem }}–{{ endItem }}</span> of <span class="font-semibold text-brand-text">{{ jobs.length }}</span> positions
            <span class="ml-1.5">(Page {{ currentPage }} of {{ totalPages }})</span>
          </div>
        </div>
      </div>
    </div>
  `
});
