import { ref, computed, onMounted } from '../../vue.js';
import { api } from '../../services/api.js';

export default {
  name: 'FacultyOpportunitiesView',
  props: {
    facultyUser: {
      type: Object,
      default: () => ({})
    }
  },
  setup(props) {
    const programs = ref([]);
    const myApplications = ref([]);
    const loading = ref(false);
    const searchQuery = ref('');
    const selectedType = ref('All');
    const selectedDomain = ref('All');
    const activeTab = ref('browse'); // 'browse' | 'my-proposals'

    // Proposal Submission Modal State
    const selectedProgram = ref(null);
    const proposalForm = ref({
      proposal_summary: '',
      faculty_name: props.facultyUser?.name || 'Prof. Gerald Sussman',
      faculty_email: props.facultyUser?.email || 'faculty@mit.edu',
      institution: props.facultyUser?.institution_or_company || 'MIT EECS Department'
    });
    const isSubmitting = ref(false);
    const submitSuccess = ref(false);

    async function loadPrograms() {
      loading.value = true;
      try {
        const params = {};
        if (selectedType.value !== 'All') params.type = selectedType.value;
        if (selectedDomain.value !== 'All') params.domain = selectedDomain.value;
        const res = await api.getFacultyPrograms(params);
        programs.value = res.programs || [];
      } catch (err) {
        console.error('Failed to load faculty programs:', err);
      } finally {
        loading.value = false;
      }
    }

    async function loadMyApplications() {
      const email = props.facultyUser?.email || 'faculty@mit.edu';
      try {
        const res = await api.getFacultyApplications(email);
        myApplications.value = res.applications || [];
      } catch (err) {
        console.error('Failed to load faculty applications:', err);
      }
    }

    onMounted(() => {
      loadPrograms();
      loadMyApplications();
    });

    const programTypes = ['All', 'FDP', 'Faculty Internship', 'Research Grant', 'Consultancy', 'Industrial Training'];
    const domains = ['All', 'Artificial Intelligence', 'Systems & OS', 'Cloud & Security', 'Compilers & Architecture'];

    const filteredPrograms = computed(() => {
      const q = searchQuery.value.trim().toLowerCase();
      if (!q) return programs.value;
      return programs.value.filter(p => {
        const fullText = `${p.title || ''} ${p.organization || ''} ${p.description || ''} ${p.domain || ''} ${p.type || ''} ${p.eligibility || ''} ${p.stipend_grant || ''}`.toLowerCase();
        return fullText.includes(q);
      });
    });

    function openApplyModal(prog) {
      selectedProgram.value = prog;
      proposalForm.value.proposal_summary = '';
      submitSuccess.value = false;
    }

    function closeApplyModal() {
      selectedProgram.value = null;
    }

    async function submitProposal() {
      if (!selectedProgram.value) return;
      isSubmitting.value = true;
      try {
        await api.applyFacultyProgram({
          program_id: selectedProgram.value.id,
          faculty_name: proposalForm.value.faculty_name,
          faculty_email: proposalForm.value.faculty_email,
          institution: proposalForm.value.institution,
          proposal_summary: proposalForm.value.proposal_summary
        });
        submitSuccess.value = true;
        await loadMyApplications();
        setTimeout(() => {
          closeApplyModal();
        }, 1500);
      } catch (err) {
        alert('Failed to submit proposal: ' + err.message);
      } finally {
        isSubmitting.value = false;
      }
    }

    return {
      programs,
      myApplications,
      loading,
      searchQuery,
      filteredPrograms,
      selectedType,
      selectedDomain,
      programTypes,
      domains,
      activeTab,
      selectedProgram,
      proposalForm,
      isSubmitting,
      submitSuccess,
      loadPrograms,
      openApplyModal,
      closeApplyModal,
      submitProposal
    };
  },
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif text-2xl sm:text-3xl text-brand-text font-normal">Faculty Development & Industrial Training</h2>
          <p class="text-sm text-brand-muted mt-1">Industry sabbaticals, research grants, consultancy retainers, and Faculty Development Programs (FDPs).</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-lg border border-brand-border bg-brand-surface p-0.5 text-xs font-mono">
            <button 
              @click="activeTab = 'browse'" 
              :class="activeTab === 'browse' ? 'bg-white text-[#581C87] font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
              class="px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              Browse Programs ({{ filteredPrograms.length }})
            </button>
            <button 
              @click="activeTab = 'my-proposals'" 
              :class="activeTab === 'my-proposals' ? 'bg-white text-[#581C87] font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
              class="px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              My Proposals ({{ myApplications.length }})
            </button>
          </div>
        </div>
      </header>

      <!-- Search & Filter Controls (for browse tab) -->
      <div v-if="activeTab === 'browse'" class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-brand-border bg-white shadow-2xs">
        
        <!-- Live Keyword Search Bar -->
        <div class="relative flex-1 max-w-md">
          <svg class="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search programs by partner, title, or topic (e.g. NVIDIA, Sabbatical, Kernel)..." 
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

        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-brand-muted uppercase tracking-wider font-mono">Type:</span>
            <select 
              v-model="selectedType" 
              @change="loadPrograms"
              class="text-xs border border-brand-border rounded-lg px-3 py-1.5 outline-none focus:border-[#581C87] bg-white font-mono text-brand-text cursor-pointer"
            >
              <option v-for="t in programTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-brand-muted uppercase tracking-wider font-mono">Domain:</span>
            <select 
              v-model="selectedDomain" 
              @change="loadPrograms"
              class="text-xs border border-brand-border rounded-lg px-3 py-1.5 outline-none focus:border-[#581C87] bg-white font-mono text-brand-text cursor-pointer"
            >
              <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Browse Programs Grid -->
      <div v-if="activeTab === 'browse'">
        <div v-if="loading" class="text-center py-16 text-sm text-brand-muted font-mono">
          <span class="spinner mr-2"></span> Loading faculty programs...
        </div>

        <div v-else-if="filteredPrograms.length === 0" class="card p-12 text-center text-brand-muted text-sm">
          No faculty opportunities match "{{ searchQuery || selectedType }}". Try clearing your search query.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            v-for="prog in filteredPrograms" 
            :key="prog.id"
            class="bg-white rounded-xl border border-brand-border p-5 sm:p-6 space-y-4 hover:border-[#DDD6FE] transition-all shadow-2xs flex flex-col justify-between"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-3">
                <span 
                  class="text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-medium"
                  :class="{
                    'bg-purple-50 text-purple-900 border-purple-200': prog.type === 'FDP',
                    'bg-blue-50 text-blue-900 border-blue-200': prog.type === 'Faculty Internship',
                    'bg-emerald-50 text-emerald-900 border-emerald-200': prog.type === 'Research Grant',
                    'bg-amber-50 text-amber-900 border-amber-200': prog.type === 'Consultancy'
                  }"
                >
                  {{ prog.type }}
                </span>
                <span v-if="prog.domain" class="text-xs text-brand-muted font-mono">{{ prog.domain }}</span>
              </div>

              <div>
                <h3 class="font-serif text-lg text-brand-text leading-snug">{{ prog.title }}</h3>
                <div class="text-xs text-brand-muted font-medium mt-1">{{ prog.organization }}</div>
              </div>

              <p class="text-xs text-brand-muted leading-relaxed">{{ prog.description }}</p>

              <div class="p-3 rounded-lg bg-brand-surface/70 border border-brand-border/60 text-xs space-y-1.5 font-mono">
                <div v-if="prog.stipend_grant" class="flex items-center gap-1.5 text-brand-text font-medium">
                  <span class="text-emerald-700">Grant / Honorarium:</span>
                  <span>{{ prog.stipend_grant }}</span>
                </div>
                <div class="flex items-center justify-between text-brand-muted text-[11px]">
                  <span>Duration: {{ prog.duration || 'Flexible' }}</span>
                  <span v-if="prog.deadline">Deadline: {{ prog.deadline }}</span>
                </div>
                <div v-if="prog.eligibility" class="text-[11px] text-brand-muted truncate">
                  Eligibility: {{ prog.eligibility }}
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-brand-border/60 flex items-center justify-between">
              <span class="text-xs text-brand-muted font-mono">Sponsored Academic Initiative</span>
              <button 
                @click="openApplyModal(prog)"
                class="btn-primary text-xs px-3.5 py-1.5 rounded-lg font-medium cursor-pointer"
              >
                Submit Proposal →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- My Submitted Proposals Tab -->
      <div v-else-if="activeTab === 'my-proposals'">
        <div v-if="myApplications.length === 0" class="card p-12 text-center text-brand-muted text-sm">
          No proposals submitted yet. Browse the open programs above and apply with your research or FDP proposal.
        </div>

        <div v-else class="border border-brand-border rounded-xl bg-white overflow-hidden shadow-2xs">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-brand-border bg-brand-surface/70 text-brand-muted font-mono uppercase tracking-wider text-[11px]">
                <th class="py-3 px-4 font-medium">Program</th>
                <th class="py-3 px-4 font-medium">Organization</th>
                <th class="py-3 px-4 font-medium">Type</th>
                <th class="py-3 px-4 font-medium">Applied Date</th>
                <th class="py-3 px-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-border">
              <tr v-for="app in myApplications" :key="app.id" class="hover:bg-brand-surface/40 transition-colors">
                <td class="py-3.5 px-4 font-medium text-brand-text">{{ app.program?.title || 'Faculty Program' }}</td>
                <td class="py-3.5 px-4 text-brand-muted">{{ app.program?.organization || 'Industry Partner' }}</td>
                <td class="py-3.5 px-4 font-mono text-brand-muted">{{ app.program?.type || 'FDP' }}</td>
                <td class="py-3.5 px-4 text-brand-muted font-mono">{{ new Date(app.applied_at).toLocaleDateString() }}</td>
                <td class="py-3.5 px-4 text-right">
                  <span 
                    class="text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-medium inline-block"
                    :class="{
                      'bg-amber-50 text-amber-800 border-amber-200': app.status === 'Submitted' || app.status === 'Under Review',
                      'bg-emerald-50 text-emerald-800 border-emerald-200': app.status === 'Approved' || app.status === 'Completed'
                    }"
                  >
                    {{ app.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Proposal Submission Modal -->
      <div 
        v-if="selectedProgram"
        class="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        @click.self="closeApplyModal"
      >
        <div class="bg-white rounded-2xl border border-brand-border shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="p-5 border-b border-brand-border flex items-start justify-between gap-4 bg-brand-surface/40">
            <div>
              <span class="text-[10px] font-mono uppercase text-[#581C87] font-semibold">{{ selectedProgram.type }} Application</span>
              <h3 class="font-serif text-xl text-brand-text leading-snug mt-0.5">{{ selectedProgram.title }}</h3>
              <p class="text-xs text-brand-muted mt-1">{{ selectedProgram.organization }}</p>
            </div>
            <button @click="closeApplyModal" class="text-brand-muted hover:text-brand-text p-1 cursor-pointer">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form @submit.prevent="submitProposal" class="p-5 space-y-4">
            <div v-if="submitSuccess" class="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-mono text-center">
              ✓ Proposal submitted successfully to {{ selectedProgram.organization }}!
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-brand-text font-mono">Faculty Name</label>
              <input v-model="proposalForm.faculty_name" required class="w-full text-xs border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text" />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-brand-text font-mono">Academic Email</label>
              <input v-model="proposalForm.faculty_email" type="email" required class="w-full text-xs border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text" />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-brand-text font-mono">Institution / Department</label>
              <input v-model="proposalForm.institution" required class="w-full text-xs border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text" />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-brand-text font-mono">Statement of Intent / Research Proposal</label>
              <textarea v-model="proposalForm.proposal_summary" rows="4" placeholder="Briefly outline your background, lab research focus, and how this program will align with your teaching/research..." class="w-full text-xs border border-brand-border rounded-lg p-3 outline-none focus:border-[#581C87] bg-white text-brand-text resize-none"></textarea>
            </div>

            <div class="pt-3 border-t border-brand-border flex items-center justify-end gap-2">
              <button type="button" @click="closeApplyModal" class="btn-secondary text-xs px-3.5 py-1.5 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" :disabled="isSubmitting" class="btn-primary text-xs px-4 py-2 rounded-lg font-medium cursor-pointer">
                {{ isSubmitting ? 'Submitting...' : 'Submit Proposal' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
};
