import { ref, computed, onMounted, defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { api } from '../../services/api.js';
import type { AuthUser, MentorshipProgram, Role } from '../../types/index.js';

export interface MentorshipHubViewProps {
  userRole?: Role | string;
  currentUser?: AuthUser | null;
}

export default defineComponent({
  name: 'MentorshipHubView',
  props: {
    userRole: {
      type: String,
      default: 'student'
    },
    currentUser: {
      type: Object as PropType<AuthUser | null>,
      default: () => null
    }
  },
  setup(props) {
    const programs = ref<MentorshipProgram[]>([]);
    const loading = ref<boolean>(false);
    const searchQuery = ref<string>('');
    const selectedType = ref<string>('All');
    const activeTab = ref<string>('browse'); // 'browse' | 'enrolled'
    const enrolledIds = ref<Set<string>>(new Set());
    const selectedProgramModal = ref<MentorshipProgram | null>(null);
    const enrollSuccess = ref<boolean>(false);

    const storageKey = computed<string>(() => {
      const id = props.currentUser?.id || props.currentUser?.email || 'guest';
      return `mentorship_enrolled_${id}`;
    });

    function loadEnrolledStorage() {
      try {
        const raw = localStorage.getItem(storageKey.value);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            enrolledIds.value = new Set(parsed);
          }
        }
      } catch (err) {
        console.warn('Could not parse enrolled programs storage:', err);
      }
    }

    function saveEnrolledStorage() {
      try {
        localStorage.setItem(storageKey.value, JSON.stringify(Array.from(enrolledIds.value)));
      } catch (err) {
        console.warn('Could not save enrolled programs storage:', err);
      }
    }

    async function loadPrograms() {
      loading.value = true;
      try {
        const res = await api.getLearningPrograms({
          type: selectedType.value !== 'All' ? selectedType.value : undefined
        });
        programs.value = (res.programs || []) as MentorshipProgram[];
      } catch (err) {
        console.error('Failed to load learning & mentorship programs:', err);
        programs.value = [];
      } finally {
        loading.value = false;
      }
    }

    onMounted(() => {
      loadEnrolledStorage();
      loadPrograms();
    });

    const programTypes: string[] = ['All', 'Mentorship', 'Workshop', 'Innovation Challenge', 'Live Project', 'Certification Course'];

    const filteredPrograms = computed<MentorshipProgram[]>(() => {
      let list = programs.value;
      if (selectedType.value !== 'All') {
        list = list.filter(p => p.type === selectedType.value);
      }
      const q = searchQuery.value.trim().toLowerCase();
      if (!q) return list;
      return list.filter((p: MentorshipProgram) => {
        const skillsText = Array.isArray(p.target_skills) ? p.target_skills.join(' ') : '';
        const fullText = `${p.title || ''} ${p.company || ''} ${p.description || ''} ${p.type || ''} ${p.mode || ''} ${skillsText}`.toLowerCase();
        return fullText.includes(q);
      });
    });

    const enrolledPrograms = computed<MentorshipProgram[]>(() => {
      return programs.value.filter((p: MentorshipProgram) => enrolledIds.value.has(p.id));
    });

    function openEnrollModal(prog: MentorshipProgram) {
      selectedProgramModal.value = prog;
      enrollSuccess.value = false;
    }

    function closeEnrollModal() {
      selectedProgramModal.value = null;
    }

    function enrollInProgram(prog: MentorshipProgram) {
      enrolledIds.value.add(prog.id);
      saveEnrolledStorage();
      enrollSuccess.value = true;
      setTimeout(() => {
        closeEnrollModal();
      }, 1200);
    }

    function cancelEnrollment(progId: string) {
      enrolledIds.value.delete(progId);
      saveEnrolledStorage();
    }

    return {
      programs,
      loading,
      searchQuery,
      selectedType,
      programTypes,
      activeTab,
      enrolledIds,
      filteredPrograms,
      enrolledPrograms,
      selectedProgramModal,
      enrollSuccess,
      loadPrograms,
      openEnrollModal,
      closeEnrollModal,
      enrollInProgram,
      cancelEnrollment
    };
  },
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif text-2xl sm:text-3xl text-brand-text font-normal">Industry Mentorship & Collaborative Learning</h2>
          <p class="text-sm text-brand-muted mt-1">1-on-1 industry mentorship, technical bootcamps, innovation challenges, and live project cohorts.</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-lg border border-brand-border bg-brand-surface p-0.5 text-xs font-mono">
            <button 
              @click="activeTab = 'browse'" 
              :class="activeTab === 'browse' ? 'bg-white text-[#581C87] font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
              class="px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              Explore Programs ({{ filteredPrograms.length }})
            </button>
            <button 
              @click="activeTab = 'enrolled'" 
              :class="activeTab === 'enrolled' ? 'bg-white text-[#581C87] font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
              class="px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              My Cohorts ({{ enrolledIds.size }})
            </button>
          </div>
        </div>
      </header>

      <!-- Search & Filter Controls (Explore Tab) -->
      <div v-if="activeTab === 'browse'" class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-brand-border bg-white shadow-2xs">
        <!-- Live Search Input -->
        <div class="relative flex-1 max-w-md">
          <svg class="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search mentorship, workshops, or skills (e.g. CUDA, GraphRAG, Virtualization)..." 
            class="w-full text-xs pl-9 pr-8 py-2 border border-brand-border rounded-lg outline-none focus:border-[#581C87] bg-white font-sans text-brand-text placeholder:text-brand-muted"
          />
          <button 
            v-if="searchQuery" 
            @click="searchQuery = ''" 
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text p-0.5 cursor-pointer text-xs"
            title="Clear search"
          >
            ✕
          </button>
        </div>

        <!-- Type Filter Dropdown -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-brand-muted uppercase tracking-wider font-mono">Format:</span>
          <select 
            v-model="selectedType" 
            class="text-xs border border-brand-border rounded-lg px-3 py-1.5 outline-none focus:border-[#581C87] bg-white font-mono text-brand-text cursor-pointer"
          >
            <option v-for="t in programTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>

      <!-- Explore Programs Grid -->
      <div v-if="activeTab === 'browse'">
        <div v-if="loading" class="text-center py-16 text-sm text-brand-muted font-mono">
          <span class="spinner mr-2"></span> Loading collaborative programs...
        </div>

        <div v-else-if="filteredPrograms.length === 0" class="card p-12 text-center text-brand-muted text-sm">
          No active programs match your search or filter criteria. Try clearing the search query or selecting "All".
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div 
            v-for="prog in filteredPrograms" 
            :key="prog.id"
            class="bg-white rounded-xl border border-brand-border p-5 space-y-4 hover:border-[#DDD6FE] transition-all shadow-2xs flex flex-col justify-between"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <span 
                  class="text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-medium"
                  :class="{
                    'bg-purple-50 text-purple-900 border-purple-200': prog.type === 'Mentorship',
                    'bg-blue-50 text-blue-900 border-blue-200': prog.type === 'Workshop',
                    'bg-amber-50 text-amber-900 border-amber-200': prog.type === 'Innovation Challenge',
                    'bg-emerald-50 text-emerald-900 border-emerald-200': prog.type === 'Live Project' || prog.type === 'Certification Course'
                  }"
                >
                  {{ prog.type }}
                </span>
                <span class="text-[11px] font-mono text-brand-muted">{{ prog.mode || 'Virtual' }}</span>
              </div>

              <div>
                <h3 class="font-serif text-lg text-brand-text leading-snug">{{ prog.title }}</h3>
                <div class="text-xs text-brand-muted font-medium mt-1">{{ prog.company }}</div>
              </div>

              <p class="text-xs text-brand-muted leading-relaxed line-clamp-3">{{ prog.description }}</p>

              <!-- Target Skill Badges -->
              <div v-if="prog.target_skills?.length" class="flex flex-wrap gap-1 pt-1">
                <span 
                  v-for="sk in prog.target_skills" 
                  :key="sk"
                  class="bg-brand-surface border border-brand-border text-brand-text px-1.5 py-0.5 rounded text-[10px] font-mono"
                >
                  {{ sk }}
                </span>
              </div>

              <div class="p-2.5 rounded-lg bg-brand-surface/70 border border-brand-border/60 text-[11px] space-y-1 font-mono">
                <div v-if="prog.duration" class="text-brand-text flex items-center justify-between">
                  <span class="text-brand-muted">Cohort Duration:</span>
                  <span>{{ prog.duration }}</span>
                </div>
                <div v-if="prog.stipend_or_perk" class="text-emerald-700 font-medium truncate" :title="prog.stipend_or_perk">
                  {{ prog.stipend_or_perk }}
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-brand-border/60 flex items-center justify-between">
              <span class="text-xs font-mono text-brand-muted">Cohort Active</span>
              <button 
                v-if="!enrolledIds.has(prog.id)"
                @click="openEnrollModal(prog)"
                class="btn-primary text-xs px-3.5 py-1.5 rounded-lg font-medium cursor-pointer"
              >
                Enroll / Apply →
              </button>
              <div v-else class="flex items-center gap-1.5">
                <span class="text-xs font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  ✓ Enrolled
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- My Enrolled Cohorts Tab -->
      <div v-else-if="activeTab === 'enrolled'">
        <div v-if="enrolledPrograms.length === 0" class="card p-12 text-center text-brand-muted text-sm space-y-2">
          <div class="font-serif text-lg text-brand-text">No active cohort enrollments yet</div>
          <p class="max-w-md mx-auto">Explore industry mentorships, engineering workshops, and hackathons in the "Explore Programs" tab and join a cohort.</p>
          <div class="pt-2">
            <button @click="activeTab = 'browse'" class="btn-primary text-xs px-4 py-2 rounded-lg font-medium cursor-pointer">
              Browse Available Cohorts →
            </button>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="text-xs text-brand-muted font-mono">
            You are enrolled in {{ enrolledPrograms.length }} active collaborative learning initiative{{ enrolledPrograms.length === 1 ? '' : 's' }}.
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              v-for="prog in enrolledPrograms" 
              :key="prog.id"
              class="bg-white rounded-xl border border-brand-border p-5 space-y-3 shadow-2xs"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                  Active Enrollment
                </span>
                <span class="text-[11px] font-mono text-brand-muted">{{ prog.mode || 'Virtual' }}</span>
              </div>

              <div>
                <h3 class="font-serif text-lg text-brand-text">{{ prog.title }}</h3>
                <div class="text-xs text-brand-muted mt-0.5">{{ prog.company }} • {{ prog.type }}</div>
              </div>

              <p class="text-xs text-brand-muted leading-relaxed">{{ prog.description }}</p>

              <div class="p-3 rounded-lg bg-brand-surface/70 border border-brand-border/60 text-xs font-mono space-y-1">
                <div><span class="text-brand-muted">Duration:</span> {{ prog.duration }}</div>
                <div v-if="prog.stipend_or_perk" class="text-emerald-700 font-medium">{{ prog.stipend_or_perk }}</div>
              </div>

              <div class="pt-2 border-t border-brand-border/60 flex items-center justify-between">
                <button 
                  @click="cancelEnrollment(prog.id)"
                  class="text-xs text-rose-700 hover:text-rose-900 font-mono cursor-pointer"
                >
                  Leave Cohort
                </button>
                <div class="text-xs text-brand-text font-mono bg-purple-50 text-purple-900 border border-purple-200 px-3 py-1 rounded-md">
                  Cohort Onboarding Confirmed
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Enrollment Confirmation Modal -->
      <div 
        v-if="selectedProgramModal"
        class="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        @click.self="closeEnrollModal"
      >
        <div class="bg-white rounded-2xl border border-brand-border shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="p-5 border-b border-brand-border flex items-start justify-between gap-4 bg-brand-surface/40">
            <div>
              <span class="text-[10px] font-mono uppercase text-[#581C87] font-semibold">{{ selectedProgramModal.type }} Enrollment</span>
              <h3 class="font-serif text-xl text-brand-text leading-snug mt-0.5">{{ selectedProgramModal.title }}</h3>
              <p class="text-xs text-brand-muted mt-1">{{ selectedProgramModal.company }}</p>
            </div>
            <button @click="closeEnrollModal" class="text-brand-muted hover:text-brand-text p-1 cursor-pointer">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="p-5 space-y-4 text-xs">
            <div v-if="enrollSuccess" class="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono text-center">
              ✓ Enrollment confirmed! Cohort onboarding link sent to your academic email.
            </div>

            <p class="text-brand-muted leading-relaxed">
              {{ selectedProgramModal.description }}
            </p>

            <div class="p-3 rounded-lg bg-brand-surface border border-brand-border font-mono space-y-1">
              <div><span class="text-brand-muted">Format:</span> {{ selectedProgramModal.mode || 'Virtual' }}</div>
              <div><span class="text-brand-muted">Duration:</span> {{ selectedProgramModal.duration }}</div>
              <div v-if="selectedProgramModal.stipend_or_perk" class="text-emerald-700 font-medium">{{ selectedProgramModal.stipend_or_perk }}</div>
            </div>

            <div class="pt-3 border-t border-brand-border flex items-center justify-end gap-2">
              <button @click="closeEnrollModal" class="btn-secondary text-xs px-3.5 py-1.5 rounded-lg cursor-pointer">Cancel</button>
              <button @click="enrollInProgram(selectedProgramModal)" class="btn-primary text-xs px-4 py-2 rounded-lg font-medium cursor-pointer">
                Confirm Cohort Enrollment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
});
