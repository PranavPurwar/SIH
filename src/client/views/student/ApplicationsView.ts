import { defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { formatDate } from '../../utils/formatters.js';
import type { JobApplication } from '../../types/index.js';

export interface ApplicationsViewProps {
  applications: JobApplication[];
}

export default defineComponent({
  name: 'ApplicationsView',
  props: {
    applications: {
      type: Array as PropType<JobApplication[]>,
      default: () => []
    }
  },
  setup(props) {
    return {
      formatDate
    };
  },
  template: `
    <div class="space-y-4">
      <header class="mb-6">
        <h1 class="font-serif text-2xl sm:text-3xl text-brand-text mb-1">My Applications</h1>
        <p class="text-brand-muted text-xs sm:text-sm">Track your recruitment pipeline stages and match snapshots.</p>
      </header>

      <div class="card overflow-hidden">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-brand-border bg-brand-surface text-brand-muted font-medium text-[11px] uppercase tracking-wider">
              <th class="py-2.5 px-3.5">Role</th>
              <th class="py-2.5 px-3">Company</th>
              <th class="py-2.5 px-3">Date</th>
              <th class="py-2.5 px-3 text-center">Match</th>
              <th class="py-2.5 px-3.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-brand-border/60">
            <tr v-if="applications.length === 0">
              <td colspan="5" class="py-12 text-center text-brand-muted text-xs">No applications submitted yet.</td>
            </tr>
            <tr v-for="app in applications" :key="app.id" class="hover:bg-[#FAF8FC] transition-colors">
              <td class="py-2.5 px-3.5 text-brand-text font-medium text-xs">{{ app.job?.title || 'Engineering Role' }}</td>
              <td class="py-2.5 px-3 text-brand-muted">{{ app.job?.company || 'Industry Partner' }}</td>
              <td class="py-2.5 px-3 text-brand-muted font-mono text-[11px]">{{ formatDate(app.applied_at) }}</td>
              <td class="py-2.5 px-3 text-center">
                <span class="font-mono text-xs font-semibold text-[#581C87] bg-[#F5F3FF] border border-[#DDD6FE] px-2 py-0.5 rounded-md inline-block">
                  {{ app.match_pct || 0 }}%
                </span>
              </td>
              <td class="py-2.5 px-3.5 text-right">
                <span 
                  :class="app.status === 'Selected' || app.status === 'Shortlisted' ? 'text-emerald-800 border-emerald-300 bg-emerald-50' : app.status === 'Rejected' ? 'text-rose-800 border-rose-200 bg-rose-50' : 'text-brand-text border-brand-border bg-brand-surface'"
                  class="font-medium text-[11px] font-mono border px-2 py-0.5 rounded-md inline-block"
                >
                  {{ app.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
});

