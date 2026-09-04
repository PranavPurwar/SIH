import { ref, watch } from '../vue.js';
import { buildEvidenceTraceabilityMatrix } from '../utils/traceability.js';

export default {
  name: 'TraceabilityMatrix',
  props: {
    candidate: {
      type: Object,
      required: true
    },
    job: {
      type: Object,
      default: null
    }
  },
  setup(props) {
    const traces = ref([]);

    function updateTraces() {
      traces.value = buildEvidenceTraceabilityMatrix(props.candidate, props.job);
    }

    watch(() => [props.candidate, props.job], () => {
      updateTraces();
    }, { immediate: true, deep: true });

    return {
      traces
    };
  },
  template: `
    <div class="evidence-matrix font-sans">
      <div class="border border-brand-border rounded-xl bg-white overflow-hidden shadow-2xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-brand-border bg-brand-surface/70 text-brand-muted font-mono uppercase tracking-wider text-[11px]">
                <th class="py-2.5 px-4 font-medium">Required Skill</th>
                <th class="py-2.5 px-4 font-medium">Project Ingestion Proof</th>
                <th class="py-2.5 px-4 font-medium">Assessment Signal</th>
                <th class="py-2.5 px-4 font-medium text-right">Confidence</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-border/70">
              <tr 
                v-for="trace in traces" 
                :key="trace.skill"
                class="hover:bg-brand-surface/40 transition-colors"
              >
                <!-- 1. Required Skill & Status -->
                <td class="py-3 px-4 align-top whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span 
                      class="w-1.5 h-1.5 rounded-full shrink-0" 
                      :class="trace.status === 'VERIFIED' ? 'bg-emerald-500' : (trace.status === 'CALIBRATED' ? 'bg-purple-500' : 'bg-amber-500')"
                    ></span>
                    <span class="font-semibold text-brand-text text-xs">{{ trace.skill }}</span>
                  </div>
                  <div class="mt-1">
                    <span 
                      :class="trace.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : (trace.status === 'CALIBRATED' ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-amber-50 text-amber-800 border-amber-200')"
                      class="text-[10px] font-mono px-2 py-0.5 rounded border font-medium inline-block"
                    >
                      {{ trace.status }} · {{ trace.depthPct }}% Depth
                    </span>
                  </div>
                </td>

                <!-- 2. Project Attribution & Keywords -->
                <td class="py-3 px-4 align-top max-w-xs">
                  <div class="font-medium text-brand-text truncate" :title="trace.ingestion.sourceProject">
                    {{ trace.ingestion.sourceProject }}
                  </div>
                  <div class="text-[11px] text-brand-muted mt-0.5 flex items-center gap-1.5">
                    <span>{{ trace.ingestion.lineRange }}</span>
                    <span>•</span>
                    <span class="font-mono text-purple-900">{{ trace.ingestion.distance }} match</span>
                  </div>
                  <div class="flex flex-wrap gap-1 mt-1.5">
                    <span 
                      v-for="kw in trace.ingestion.keywordSignatures" 
                      :key="kw"
                      class="bg-brand-surface border border-brand-border text-brand-text px-1.5 py-0.2 rounded text-[10px] font-mono"
                    >
                      {{ kw }}
                    </span>
                  </div>
                </td>

                <!-- 3. Assessment Signal -->
                <td class="py-3 px-4 align-top max-w-xs">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-medium text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[10px]">
                      {{ trace.assessment.passedSuite }}
                    </span>
                    <span class="text-brand-text font-semibold text-xs">
                      {{ trace.assessment.score }}% Score
                    </span>
                  </div>
                  <div class="text-[11px] text-brand-muted mt-1 leading-snug line-clamp-2" :title="trace.assessment.question">
                    {{ trace.assessment.question }}
                  </div>
                </td>

                <!-- 4. Calibration Variance -->
                <td class="py-3 px-4 align-top text-right whitespace-nowrap">
                  <div class="font-mono font-medium text-brand-text text-xs">
                    σ = {{ trace.confidence.sigma }}
                  </div>
                  <div class="text-[10px] text-emerald-700 font-mono mt-0.5">
                    {{ trace.confidence.reliabilityLabel }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};
