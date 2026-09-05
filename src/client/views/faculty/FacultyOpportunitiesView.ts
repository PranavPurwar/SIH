import { ref, computed, onMounted, defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { api } from '../../services/api.js';
import type { AuthUser, FacultyOpportunity, FacultyProfile, FacultyApplicationItem } from '../../types/index.js';

export type { FacultyApplicationItem };

export interface FacultyOpportunitiesViewProps {
  facultyUser?: AuthUser | null;
}

export default defineComponent({
  name: 'FacultyOpportunitiesView',
  props: {
    facultyUser: {
      type: Object as PropType<AuthUser | null>,
      default: () => null
    }
  },
  setup(props) {
    const programs = ref<FacultyOpportunity[]>([]);
    const myApplications = ref<FacultyApplicationItem[]>([]);
    const facultyProfile = ref<FacultyProfile | null>(null);
    const loading = ref<boolean>(false);
    const searchQuery = ref<string>('');
    const selectedType = ref<string>('All');
    const selectedDomain = ref<string>('All');
    const activeTab = ref<string>('browse'); // 'browse' | 'my-proposals'

    // Proposal Submission Modal State
    const selectedProgram = ref<FacultyOpportunity | null>(null);
    const proposalForm = ref<{
      proposal_summary: string;
      faculty_name: string;
      faculty_email: string;
      institution: string;
      cv_attached: boolean;
      past_grants_summary: string;
      experience_summary: string;
      resume_url: string;
    }>({
      proposal_summary: '',
      faculty_name: props.facultyUser?.name || '',
      faculty_email: props.facultyUser?.email || '',
      institution: props.facultyUser?.institution_or_company || '',
      cv_attached: false,
      past_grants_summary: '',
      experience_summary: '',
      resume_url: ''
    });
    const isSubmitting = ref<boolean>(false);
    const submitSuccess = ref<boolean>(false);

    async function loadPrograms() {
      loading.value = true;
      try {
        const params: Record<string, string> = {};
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
      const email = props.facultyUser?.email;
      if (!email) return;
      try {
        const res = await api.getFacultyApplications(email);
        myApplications.value = res.applications || [];
      } catch (err) {
        console.error('Failed to load faculty applications:', err);
      }
    }

    async function loadFacultyProfile() {
      const email = props.facultyUser?.email;
      if (!email) return;
      try {
        const res = await api.getFacultyProfile(email);
        facultyProfile.value = res.profile;
      } catch (err) {
        console.error('Failed to load faculty profile for dossier:', err);
      }
    }

    onMounted(() => {
      loadPrograms();
      loadMyApplications();
      loadFacultyProfile();
    });

    const programTypes: string[] = ['All', 'FDP', 'Faculty Internship', 'Research Grant', 'Consultancy', 'Industrial Training'];
    const domains: string[] = [
      'All',
      'Pedagogy & Higher Ed',
      'Management & Leadership',
      'Healthcare & Medicine',
      'Humanities & Social Sciences',
      'Environmental & Sustainability',
      'Design & Architecture',
      'Law & Public Policy',
      'Agriculture & Food Systems',
      'Artificial Intelligence & Computing',
      'Systems & Engineering'
    ];

    const filteredPrograms = computed<FacultyOpportunity[]>(() => {
      const q = searchQuery.value.trim().toLowerCase();
      if (!q) return programs.value;
      return programs.value.filter((p: FacultyOpportunity) => {
        const fullText = `${p.title || ''} ${p.organization || ''} ${p.description || ''} ${p.domain || ''} ${p.type || ''} ${p.eligibility || ''} ${p.stipend_grant || ''}`.toLowerCase();
        return fullText.includes(q);
      });
    });

    async function openApplyModal(prog: FacultyOpportunity) {
      selectedProgram.value = prog;
      submitSuccess.value = false;

      if (!facultyProfile.value) {
        await loadFacultyProfile();
      }

      const prof = facultyProfile.value;
      const grantsSummary = prof?.grants?.length 
        ? `${prof.grants.length} funded grants (${prof.grants.map(g => g.funding_agency).join(', ')}), ${prof.publications?.length || 0} peer-reviewed publications`
        : '';
      const expSummary = prof?.experience?.length 
        ? `${prof.designation || 'Faculty'} at ${prof.institution || 'Institution'} (${prof.experience.length} recorded appointments)`
        : '';

      proposalForm.value = {
        proposal_summary: '',
        faculty_name: prof?.name || props.facultyUser?.name || '',
        faculty_email: prof?.email || props.facultyUser?.email || '',
        institution: prof?.institution || props.facultyUser?.institution_or_company || '',
        cv_attached: Boolean(prof?.has_resume || (prof?.grants && prof.grants.length > 0)),
        past_grants_summary: grantsSummary,
        experience_summary: expSummary,
        resume_url: prof?.resume_url || ''
      };
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
          proposal_summary: proposalForm.value.proposal_summary,
          cv_attached: proposalForm.value.cv_attached,
          past_grants_summary: proposalForm.value.past_grants_summary,
          experience_summary: proposalForm.value.experience_summary,
          resume_url: proposalForm.value.resume_url
        });
        submitSuccess.value = true;
        await loadMyApplications();
        setTimeout(() => {
          closeApplyModal();
        }, 1500);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        alert('Failed to submit proposal: ' + message);
      } finally {
        isSubmitting.value = false;
      }
    }

    return {
      programs,
      myApplications,
      facultyProfile,
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
                    'bg-amber-50 text-amber-900 border-amber-200': prog.type === 'Consultancy',
                    'bg-cyan-50 text-cyan-900 border-cyan-200': prog.type === 'Industrial Training'
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
                <th class="py-3 px-3 font-medium">Program</th>
                <th class="py-3 px-3 font-medium">Organization</th>
                <th class="py-3 px-3 font-medium">Type</th>
                <th class="py-3 px-3 font-medium">Academic Dossier</th>
                <th class="py-3 px-3 font-medium">Applied Date</th>
                <th class="py-3 px-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-brand-border">
              <tr v-for="app in myApplications" :key="app.id" class="hover:bg-brand-surface/40 transition-colors">
                <td class="py-3.5 px-2.5 font-medium text-brand-text max-w-lg">
                  <div>{{ app.program?.title || 'Faculty Program' }}</div>
                  <div v-if="app.proposal_summary" class="text-[11px] text-brand-muted line-clamp-1 mt-0.5 font-normal">{{ app.proposal_summary }}</div>
                </td>
                <td class="py-3.5 px-2.5 text-brand-muted max-w-md">{{ app.program?.organization || 'Industry Partner' }}</td>
                <td class="py-3.5 px-2.5 font-mono text-brand-muted">{{ app.program?.type || 'FDP' }}</td>
                <td class="py-3.5 px-2.5">
                  <div v-if="app.cv_attached" class="flex flex-col items-start gap-1 w-fit">
                    <span class="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium whitespace-nowrap">
                      <svg class="w-3 h-3 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      Attached
                    </span>
                  </div>
                  <span v-else class="text-[11px] text-brand-muted font-mono">Standard Application</span>
                </td>
                <td class="py-3.5 px-2.5 text-brand-muted font-mono">{{ new Date(app.applied_at).toLocaleDateString() }}</td>
                <td class="py-3.5 px-2.5 text-right">
                  <span 
                    class="text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-medium inline-block whitespace-nowrap"
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

            <!-- Academic CV & Track Record Dossier Panel -->
            <div class="p-3.5 rounded-xl border border-brand-border bg-brand-surface/40 space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      v-model="proposalForm.cv_attached" 
                      class="rounded border-brand-border text-[#581C87] focus:ring-[#581C87] cursor-pointer" 
                    />
                    <span class="text-xs font-semibold text-brand-text">Attach Academic CV & Research Dossier</span>
                  </label>
                  <p class="text-[11px] text-brand-muted mt-0.5 ml-5">
                    Includes verified record of research grants, publications, and professional appointments from your faculty profile.
                  </p>
                </div>
                <span v-if="proposalForm.cv_attached" class="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium whitespace-nowrap">
                  Dossier Included
                </span>
              </div>

              <div v-if="proposalForm.cv_attached" class="pl-5 space-y-2 border-l-2 border-[#581C87]/30 pt-1">
                <div v-if="facultyProfile?.has_resume" class="flex items-center justify-between text-xs text-brand-text bg-white p-2 rounded-lg border border-brand-border/60">
                  <div class="flex items-center gap-2 truncate">
                    <svg class="w-4 h-4 text-[#581C87] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <span class="font-mono text-[11px] truncate">{{ facultyProfile.resume_filename || 'Academic_CV.pdf' }}</span>
                  </div>
                  <a :href="facultyProfile.resume_url" target="_blank" download class="text-[11px] text-[#581C87] hover:underline font-mono shrink-0 ml-2">Preview ↗</a>
                </div>
                <div v-else class="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  ⚠️ No PDF CV uploaded yet. You can upload your CV anytime in the <strong>Faculty Profile & CV</strong> tab.
                </div>

                <div class="space-y-1">
                  <label class="text-[11px] font-mono text-brand-muted">Past Grants & Research Track Record</label>
                  <input 
                    v-model="proposalForm.past_grants_summary" 
                    placeholder="e.g. 3 funded NSF/DoD grants ($1.4M total), PI at MIT CSAIL" 
                    class="w-full text-xs border border-brand-border rounded-lg px-2.5 py-1.5 outline-none focus:border-[#581C87] bg-white text-brand-text" 
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-[11px] font-mono text-brand-muted">Academic / Industry Experience Summary</label>
                  <input 
                    v-model="proposalForm.experience_summary" 
                    placeholder="e.g. 28 years academic faculty, Principal Investigator, 4 international patents" 
                    class="w-full text-xs border border-brand-border rounded-lg px-2.5 py-1.5 outline-none focus:border-[#581C87] bg-white text-brand-text" 
                  />
                </div>
              </div>
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
});
