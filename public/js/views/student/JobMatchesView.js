import { decodeHtml } from '../../utils/formatters.js';

export default {
  name: 'JobMatchesView',
  props: {
    jobs: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    appliedJobIds: {
      type: Array,
      default: () => []
    }
  },
  emits: ['apply-job'],
  setup(props) {
    function isJobApplied(jobId) {
      return props.appliedJobIds.includes(jobId);
    }

    return {
      decodeHtml,
      isJobApplied
    };
  },
  template: `
    <div class="space-y-6">
      <header class="mb-6">
        <h1 class="font-serif text-3xl text-brand-text mb-2">Available Positions</h1>
        <p class="text-brand-muted text-sm">Ranked by competency alignment with your evaluated skills and portfolio.</p>
      </header>

      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
        <span class="spinner mr-2"></span> Analyzing competency alignment and matching roles...
      </div>

      <div v-else-if="jobs.length === 0" class="card p-12 text-center text-brand-muted text-sm">
        No matching positions found. Upload your resume or add projects in the Profile tab to view matched opportunities.
      </div>

      <div v-else class="space-y-6">
        <div 
          v-for="m in jobs" 
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
              <span>📚 Recommended Coursework for this Role:</span>
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
      </div>
    </div>
  `
};

