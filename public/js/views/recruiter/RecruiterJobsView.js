import { decodeHtml } from '../../utils/formatters.js';

export default {
  name: 'RecruiterJobsView',
  props: {
    jobs: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['open-post-modal', 'view-candidates'],
  setup() {
    return {
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
        <button @click="$emit('open-post-modal')" class="btn-primary text-sm px-4 py-2 rounded-lg font-medium shadow-sm">
          + Post New Role
        </button>
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
        <div v-for="job in jobs" :key="job.job_id" class="card p-6 transition-colors hover:border-[#DDD6FE] shadow-sm">
          <div class="flex flex-wrap justify-between items-start mb-3 gap-2">
            <div>
              <h3 class="font-serif text-lg text-brand-text mb-1">{{ decodeHtml(job.title) }}</h3>
              <div class="text-sm text-brand-muted flex items-center gap-2">
                <span class="font-medium text-brand-text">{{ decodeHtml(job.company) }}</span>
                <span v-if="job.stipend" class="font-mono text-xs bg-brand-surface px-2 py-0.5 rounded border border-brand-border text-[#581C87] font-medium">{{ job.stipend }}</span>
                <span v-if="job.eligibility" class="text-xs text-brand-muted">• {{ job.eligibility }}</span>
              </div>
            </div>
            <button @click="$emit('view-candidates', job.job_id)" class="text-xs border border-brand-border bg-brand-surface hover:bg-[#F5F3FF] text-[#581C87] hover:border-[#DDD6FE] px-3.5 py-1.5 rounded-lg transition-colors font-medium">
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
      </div>
    </div>
  `
};

