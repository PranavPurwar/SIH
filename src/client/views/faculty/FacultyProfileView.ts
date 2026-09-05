import { ref, computed, onMounted, defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { api } from '../../services/api.js';
import type {
  AuthUser,
  FacultyProfile,
  FacultyGrantItem,
  FacultyPublicationItem,
  FacultyExperienceItem,
  FacultyProjectItem
} from '../../types/index.js';

export interface FacultyProfileViewProps {
  facultyUser?: AuthUser | null;
}

export default defineComponent({
  name: 'FacultyProfileView',
  props: {
    facultyUser: {
      type: Object as PropType<AuthUser | null>,
      default: () => null
    }
  },
  setup(props) {
    const profile = ref<FacultyProfile | null>(null);
    const loading = ref<boolean>(true);
    const activeSection = ref<'overview' | 'grants' | 'publications' | 'experience'>('overview');
    const cvFileInput = ref<HTMLInputElement | null>(null);
    const isUploadingCV = ref<boolean>(false);
    const notification = ref<string | null>(null);

    // Edit Profile Modal
    const showEditModal = ref<boolean>(false);
    const editForm = ref<{
      name: string;
      designation: string;
      department: string;
      institution: string;
      bio: string;
      domains: string;
      google_scholar_url: string;
      orcid_id: string;
    }>({
      name: '',
      designation: '',
      department: '',
      institution: '',
      bio: '',
      domains: '',
      google_scholar_url: '',
      orcid_id: ''
    });

    // Add Item Modal (Project, Grant, Publication, Experience)
    const showAddModal = ref<'project' | 'grant' | 'publication' | 'experience' | null>(null);
    const projectForm = ref<FacultyProjectItem>({
      title: '',
      area: '',
      description: '',
      role: 'Lead Principal Investigator',
      year: new Date().getFullYear().toString(),
      url: ''
    });
    const grantForm = ref<FacultyGrantItem>({
      title: '',
      funding_agency: '',
      grant_amount: '',
      year: new Date().getFullYear().toString(),
      status: 'Active',
      role: 'Principal Investigator (PI)'
    });
    const pubForm = ref<FacultyPublicationItem>({
      title: '',
      journal_or_conference: '',
      year: new Date().getFullYear().toString(),
      doi_or_url: '',
      citations: ''
    });
    const expForm = ref<FacultyExperienceItem>({
      title: '',
      organization: '',
      role_type: 'Full-time Academic',
      start_year: '2020',
      end_year: 'Present',
      description: ''
    });

    function showNotice(msg: string) {
      notification.value = msg;
      setTimeout(() => {
        notification.value = null;
      }, 3500);
    }

    async function loadProfile() {
      const email = props.facultyUser?.email;
      if (!email) return;
      loading.value = true;
      try {
        const res = await api.getFacultyProfile(email);
        profile.value = res.profile;
        if (res.profile) {
          editForm.value = {
            name: res.profile.name || '',
            designation: res.profile.designation || '',
            department: res.profile.department || '',
            institution: res.profile.institution || '',
            bio: res.profile.bio || '',
            domains: (res.profile.domains || []).join(', '),
            google_scholar_url: res.profile.google_scholar_url || '',
            orcid_id: res.profile.orcid_id || ''
          };
        }
      } catch (err) {
        console.error('Failed to load faculty profile:', err);
      } finally {
        loading.value = false;
      }
    }

    onMounted(() => {
      loadProfile();
    });

    function triggerCVUpload() {
      if (cvFileInput.value) {
        cvFileInput.value.click();
      }
    }

    async function onCVFileSelected(e: Event) {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      const email = props.facultyUser?.email;
      if (!email) return;
      const file = target.files[0];

      isUploadingCV.value = true;
      try {
        const res = await api.uploadFacultyCV(email, file);
        if (profile.value) {
          profile.value.has_resume = true;
          profile.value.resume_filename = res.filename;
          profile.value.resume_url = res.resume_url;
        }
        showNotice(`✓ Academic CV "${file.name}" uploaded and attached successfully!`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        alert('Failed to upload CV: ' + msg);
      } finally {
        isUploadingCV.value = false;
        target.value = '';
      }
    }

    async function saveProfileEdits() {
      const email = props.facultyUser?.email;
      if (!email) return;
      try {
        const domainsArray = editForm.value.domains
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        const updated = await api.updateFacultyProfile(email, {
          name: editForm.value.name,
          designation: editForm.value.designation,
          department: editForm.value.department,
          institution: editForm.value.institution,
          bio: editForm.value.bio,
          domains: domainsArray,
          google_scholar_url: editForm.value.google_scholar_url,
          orcid_id: editForm.value.orcid_id
        });
        profile.value = updated.profile;
        showEditModal.value = false;
        showNotice('✓ Faculty profile updated successfully');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        alert('Failed to update profile: ' + msg);
      }
    }

    async function addProject() {
      if (!profile.value) return;
      if (!projectForm.value.title.trim()) {
        alert('Project title is required');
        return;
      }
      const email = props.facultyUser?.email;
      if (!email) return;
      const updatedProjects = [projectForm.value, ...(profile.value.research_projects || [])];
      try {
        const res = await api.updateFacultyProfile(email, { research_projects: updatedProjects });
        profile.value = res.profile;
        showAddModal.value = null;
        projectForm.value = {
          title: '',
          area: '',
          description: '',
          role: 'Lead Principal Investigator',
          year: new Date().getFullYear().toString(),
          url: ''
        };
        showNotice('✓ Research agenda project added to laboratory profile');
      } catch (err: unknown) {
        alert('Failed to save research project: ' + String(err));
      }
    }

    async function addGrant() {
      if (!profile.value) return;
      const email = props.facultyUser?.email;
      if (!email) return;
      const updatedGrants = [grantForm.value, ...(profile.value.grants || [])];
      try {
        const res = await api.updateFacultyProfile(email, { grants: updatedGrants });
        profile.value = res.profile;
        showAddModal.value = null;
        grantForm.value = {
          title: '',
          funding_agency: '',
          grant_amount: '',
          year: new Date().getFullYear().toString(),
          status: 'Active',
          role: 'Principal Investigator (PI)'
        };
        showNotice('✓ Research grant record added to dossier');
      } catch (err: unknown) {
        alert('Failed to save grant: ' + String(err));
      }
    }

    async function addPublication() {
      if (!profile.value) return;
      const email = props.facultyUser?.email;
      if (!email) return;
      const updatedPubs = [pubForm.value, ...(profile.value.publications || [])];
      try {
        const res = await api.updateFacultyProfile(email, { publications: updatedPubs });
        profile.value = res.profile;
        showAddModal.value = null;
        pubForm.value = {
          title: '',
          journal_or_conference: '',
          year: new Date().getFullYear().toString(),
          doi_or_url: '',
          citations: ''
        };
        showNotice('✓ Publication added to research bibliography');
      } catch (err: unknown) {
        alert('Failed to save publication: ' + String(err));
      }
    }

    async function addExperience() {
      if (!profile.value) return;
      const email = props.facultyUser?.email;
      if (!email) return;
      const updatedExp = [expForm.value, ...(profile.value.experience || [])];
      try {
        const res = await api.updateFacultyProfile(email, { experience: updatedExp });
        profile.value = res.profile;
        showAddModal.value = null;
        expForm.value = {
          title: '',
          organization: '',
          role_type: 'Full-time Academic',
          start_year: '2020',
          end_year: 'Present',
          description: ''
        };
        showNotice('✓ Academic appointment added');
      } catch (err: unknown) {
        alert('Failed to save appointment: ' + String(err));
      }
    }

    return {
      profile,
      loading,
      activeSection,
      cvFileInput,
      isUploadingCV,
      notification,
      showEditModal,
      editForm,
      showAddModal,
      projectForm,
      grantForm,
      pubForm,
      expForm,
      triggerCVUpload,
      onCVFileSelected,
      saveProfileEdits,
      addProject,
      addGrant,
      addPublication,
      addExperience
    };
  },
  template: `
    <div class="space-y-6">
      <!-- Notification Banner -->
      <div v-if="notification" class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-mono flex items-center justify-between shadow-2xs">
        <span>{{ notification }}</span>
        <button @click="notification = null" class="text-emerald-700 hover:text-emerald-900 cursor-pointer">✕</button>
      </div>

      <!-- Hidden CV File Input -->
      <input 
        type="file" 
        ref="cvFileInput" 
        @change="onCVFileSelected" 
        accept=".pdf" 
        class="hidden" 
      />

      <div v-if="loading" class="text-center py-20 text-sm text-brand-muted font-mono">
        <span class="spinner mr-2"></span> Loading faculty academic profile...
      </div>

      <div v-else-if="profile" class="space-y-6">
        <!-- Faculty Academic Profile Header Card -->
        <div class="bg-white rounded-2xl border border-brand-border p-6 sm:p-8 shadow-2xs space-y-6">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
            
            <!-- Left: Avatar, Title, Department -->
            <div class="flex items-start gap-5">
              <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#F5F3FF] border-2 border-[#DDD6FE] flex items-center justify-center text-2xl sm:text-3xl font-serif text-[#581C87] font-semibold shadow-xs shrink-0">
                {{ profile.name ? profile.name.charAt(0) : 'P' }}
              </div>
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="font-serif text-2xl sm:text-3xl text-brand-text font-normal">{{ profile.name }}</h1>
                  <span class="text-[11px] font-mono uppercase tracking-wider bg-purple-50 text-[#581C87] border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                    Verified Academic Faculty
                  </span>
                </div>
                <div class="text-sm font-medium text-brand-text">{{ profile.designation }}</div>
                <div class="text-xs text-brand-muted font-mono flex flex-wrap items-center gap-2">
                  <span>{{ profile.department }}</span>
                  <span>•</span>
                  <span>{{ profile.institution }}</span>
                </div>
                <div class="text-xs text-brand-muted font-mono flex items-center gap-4 pt-1">
                  <span class="flex items-center gap-1.5 text-[#581C87]">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    {{ profile.email }}
                  </span>
                  <a v-if="profile.orcid_id" :href="'https://orcid.org/' + profile.orcid_id" target="_blank" class="text-emerald-700 hover:underline flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    ORCID: {{ profile.orcid_id }}
                  </a>
                  <a v-if="profile.google_scholar_url" :href="profile.google_scholar_url" target="_blank" class="text-blue-700 hover:underline">
                    Google Scholar ↗
                  </a>
                </div>
              </div>
            </div>

            <!-- Right: Action Buttons (CV Upload/Download & Edit) -->
            <div class="flex flex-wrap items-center md:flex-col md:items-end gap-2.5 shrink-0">
              <div class="flex items-center gap-2">
                <a 
                  v-if="profile.has_resume && profile.resume_url"
                  :href="profile.resume_url" 
                  target="_blank"
                  class="text-xs px-3.5 py-2 rounded-lg border border-purple-200 bg-purple-50 text-[#581C87] font-mono hover:bg-purple-100/70 transition-colors flex items-center gap-1.5 font-medium cursor-pointer shadow-2xs"
                  title="Download / View Curriculum Vitae"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span>Download CV (PDF)</span>
                </a>
                
                <button 
                  @click="triggerCVUpload"
                  :disabled="isUploadingCV"
                  class="btn-primary text-xs px-3.5 py-2 rounded-lg font-mono flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Upload updated Academic CV PDF"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  <span>{{ isUploadingCV ? 'Uploading...' : (profile.has_resume ? 'Replace CV' : 'Upload CV') }}</span>
                </button>
              </div>

              <button 
                @click="showEditModal = true"
                class="text-xs px-3.5 py-1.5 rounded-lg border border-brand-border bg-white text-brand-text font-mono hover:bg-brand-surface transition-colors cursor-pointer"
              >
                ✎ Edit Profile Details
              </button>
            </div>
          </div>

          <!-- Academic Statement & Research Domains -->
          <div class="pt-5 border-t border-brand-border/60 space-y-3">
            <p class="text-xs text-brand-text leading-relaxed font-sans max-w-4xl">
              {{ profile.bio || 'Pioneering multidisciplinary academic research and training students in state-of-the-art methods.' }}
            </p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <span class="text-[11px] font-mono text-brand-muted uppercase tracking-wider mr-1">Primary Domains:</span>
              <span 
                v-for="d in (profile.domains || [])" 
                :key="d"
                class="text-xs font-mono px-2.5 py-1 rounded-md bg-brand-surface border border-brand-border text-brand-text"
              >
                {{ d }}
              </span>
            </div>
          </div>
        </div>

        <!-- Metric Stat Counters -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border border-brand-border p-4 shadow-2xs space-y-1">
            <div class="text-[11px] font-mono text-brand-muted uppercase">Funded Grants</div>
            <div class="text-2xl font-serif text-[#581C87]">{{ (profile.grants || []).length }}</div>
            <div class="text-[11px] text-emerald-700 font-mono">Active & Completed</div>
          </div>
          <div class="bg-white rounded-xl border border-brand-border p-4 shadow-2xs space-y-1">
            <div class="text-[11px] font-mono text-brand-muted uppercase">Publications</div>
            <div class="text-2xl font-serif text-brand-text">{{ (profile.publications || []).length }}</div>
            <div class="text-[11px] text-brand-muted font-mono">Peer-Reviewed Papers</div>
          </div>
          <div class="bg-white rounded-xl border border-brand-border p-4 shadow-2xs space-y-1">
            <div class="text-[11px] font-mono text-brand-muted uppercase">Lab Projects</div>
            <div class="text-2xl font-serif text-brand-text">{{ (profile.research_projects || []).length }}</div>
            <div class="text-[11px] text-brand-muted font-mono">Active Initiatives</div>
          </div>
          <div class="bg-white rounded-xl border border-brand-border p-4 shadow-2xs space-y-1">
            <div class="text-[11px] font-mono text-brand-muted uppercase">Industry Advisory</div>
            <div class="text-2xl font-serif text-brand-text">{{ (profile.consulting || []).length }}</div>
            <div class="text-[11px] text-brand-muted font-mono">Corporate Consultancies</div>
          </div>
        </div>

        <!-- Section Navigation Tabs -->
        <div class="flex items-center gap-2 border-b border-brand-border pb-1 text-xs font-mono">
          <button 
            @click="activeSection = 'overview'" 
            :class="activeSection === 'overview' ? 'border-[#581C87] text-[#581C87] font-semibold' : 'border-transparent text-brand-muted hover:text-brand-text'"
            class="pb-2 px-3 border-b-2 transition-colors cursor-pointer"
          >
            Research Overview & Projects
          </button>
          <button 
            @click="activeSection = 'grants'" 
            :class="activeSection === 'grants' ? 'border-[#581C87] text-[#581C87] font-semibold' : 'border-transparent text-brand-muted hover:text-brand-text'"
            class="pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Funded Grants</span>
            <span class="bg-purple-100 text-[#581C87] px-1.5 py-0.2 rounded-full text-[10px]">{{ (profile.grants || []).length }}</span>
          </button>
          <button 
            @click="activeSection = 'publications'" 
            :class="activeSection === 'publications' ? 'border-[#581C87] text-[#581C87] font-semibold' : 'border-transparent text-brand-muted hover:text-brand-text'"
            class="pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Publications</span>
            <span class="bg-brand-surface text-brand-muted px-1.5 py-0.2 rounded-full text-[10px]">{{ (profile.publications || []).length }}</span>
          </button>
          <button 
            @click="activeSection = 'experience'" 
            :class="activeSection === 'experience' ? 'border-[#581C87] text-[#581C87] font-semibold' : 'border-transparent text-brand-muted hover:text-brand-text'"
            class="pb-2 px-3 border-b-2 transition-colors cursor-pointer"
          >
            Appointments & Consulting
          </button>
        </div>

        <!-- Section 1: Research Overview & Lab Projects -->
        <div v-if="activeSection === 'overview'" class="space-y-6">
          <div class="bg-white rounded-xl border border-brand-border p-6 shadow-2xs space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-3">
              <div>
                <h3 class="font-serif text-lg text-brand-text">Research Agenda & Laboratory Projects</h3>
                <p class="text-xs text-brand-muted mt-0.5">Active laboratory initiatives, theoretical frameworks, and sponsored scientific research agendas.</p>
              </div>
              <button 
                @click="showAddModal = 'project'" 
                class="btn-primary text-xs px-3.5 py-1.5 rounded-lg font-mono flex items-center gap-1 cursor-pointer shadow-2xs self-start sm:self-auto shrink-0"
              >
                + Add Research Project
              </button>
            </div>

            <div v-if="!profile.research_projects || profile.research_projects.length === 0" class="p-8 text-center border border-dashed border-brand-border rounded-xl text-brand-muted text-xs font-mono space-y-3">
              <p>No active laboratory projects added yet.</p>
              <button 
                @click="showAddModal = 'project'" 
                class="btn-secondary text-xs px-3 py-1.5 rounded-lg font-mono cursor-pointer"
              >
                + Add Your First Research Project
              </button>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                v-for="proj in (profile.research_projects || [])" 
                :key="proj.title"
                class="p-4 rounded-xl border border-brand-border/80 bg-brand-surface/40 space-y-2 flex flex-col justify-between hover:border-[#581C87]/40 transition-colors"
              >
                <div class="space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-brand-border text-[#581C87] font-medium">
                      {{ proj.area || 'Research Initiative' }}
                    </span>
                    <span class="text-xs font-mono text-brand-muted">{{ proj.year }}</span>
                  </div>
                  <h4 class="font-serif text-base text-brand-text font-medium">{{ proj.title }}</h4>
                  <p class="text-xs text-brand-muted leading-relaxed">{{ proj.description }}</p>
                </div>
                <div class="pt-2 border-t border-brand-border/40 flex items-center justify-between text-[11px] font-mono">
                  <span class="text-brand-text font-medium">Role: {{ proj.role }}</span>
                  <a v-if="proj.url" :href="proj.url" target="_blank" class="text-[#581C87] hover:underline flex items-center gap-0.5">Lab Link ↗</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Funded Grants & Research Track Record -->
        <div v-else-if="activeSection === 'grants'" class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-xs text-brand-muted">Demonstrated past research sponsorship record (attached directly to grant applications).</p>
            <button 
              @click="showAddModal = 'grant'" 
              class="btn-primary text-xs px-3 py-1.5 rounded-lg font-mono flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              + Add Research Grant
            </button>
          </div>

          <div class="grid grid-cols-1 gap-3">
            <div 
              v-for="grant in (profile.grants || [])" 
              :key="grant.title"
              class="bg-white rounded-xl border border-brand-border p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div class="space-y-1.5 flex-1">
                <div class="flex items-center gap-2">
                  <span 
                    class="text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-medium"
                    :class="grant.status === 'Active' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-brand-surface text-brand-muted border-brand-border'"
                  >
                    {{ grant.status }}
                  </span>
                  <span class="text-xs font-mono text-brand-muted">{{ grant.year }}</span>
                  <span class="text-xs font-mono text-brand-muted">•</span>
                  <span class="text-xs font-mono text-[#581C87] font-medium">{{ grant.role }}</span>
                </div>
                <h4 class="font-serif text-base text-brand-text">{{ grant.title }}</h4>
                <div class="text-xs text-brand-muted font-medium">Funding Agency: {{ grant.funding_agency }}</div>
              </div>

              <div class="text-left sm:text-right shrink-0">
                <div class="text-xs font-mono text-brand-muted uppercase">Grant Funding</div>
                <div class="text-lg font-serif text-emerald-700 font-semibold">{{ grant.grant_amount }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: Publications & Books -->
        <div v-else-if="activeSection === 'publications'" class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-xs text-brand-muted">Peer-reviewed journal articles, conference proceedings, and foundational books.</p>
            <button 
              @click="showAddModal = 'publication'" 
              class="btn-primary text-xs px-3 py-1.5 rounded-lg font-mono flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              + Add Publication
            </button>
          </div>

          <div class="border border-brand-border rounded-xl bg-white overflow-hidden shadow-2xs">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-brand-border bg-brand-surface/70 text-brand-muted font-mono uppercase tracking-wider text-[11px]">
                  <th class="py-3 px-4 font-medium">Title & Citation</th>
                  <th class="py-3 px-4 font-medium">Venue / Publisher</th>
                  <th class="py-3 px-4 font-medium">Year</th>
                  <th class="py-3 px-4 font-medium">Citations</th>
                  <th class="py-3 px-4 font-medium text-right">Link</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-brand-border">
                <tr v-for="pub in (profile.publications || [])" :key="pub.title" class="hover:bg-brand-surface/30 transition-colors">
                  <td class="py-3.5 px-4 font-medium text-brand-text max-w-md">{{ pub.title }}</td>
                  <td class="py-3.5 px-4 text-brand-muted">{{ pub.journal_or_conference }}</td>
                  <td class="py-3.5 px-4 font-mono text-brand-muted">{{ pub.year }}</td>
                  <td class="py-3.5 px-4 font-mono text-emerald-800 font-medium">{{ pub.citations || '—' }}</td>
                  <td class="py-3.5 px-4 text-right">
                    <a v-if="pub.doi_or_url" :href="pub.doi_or_url" target="_blank" class="text-[#581C87] hover:underline font-mono text-[11px]">
                      View ↗
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 4: Academic Appointments & Consulting -->
        <div v-else-if="activeSection === 'experience'" class="space-y-6">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-serif text-lg text-brand-text">Academic Appointments & Sabbaticals</h3>
              <button 
                @click="showAddModal = 'experience'" 
                class="btn-primary text-xs px-3 py-1.5 rounded-lg font-mono flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                + Add Appointment
              </button>
            </div>

            <div class="space-y-3">
              <div 
                v-for="exp in (profile.experience || [])" 
                :key="exp.title + exp.organization"
                class="bg-white rounded-xl border border-brand-border p-5 shadow-2xs space-y-2"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-mono font-medium text-[#581C87]">{{ exp.organization }}</span>
                  <span class="text-xs font-mono text-brand-muted">{{ exp.start_year }} – {{ exp.end_year }}</span>
                </div>
                <h4 class="font-serif text-base text-brand-text">{{ exp.title }}</h4>
                <p class="text-xs text-brand-muted leading-relaxed">{{ exp.description }}</p>
                <div v-if="exp.role_type" class="text-[11px] font-mono text-brand-muted">Track: {{ exp.role_type }}</div>
              </div>
            </div>
          </div>

          <!-- Industry Advisory / Consulting -->
          <div class="space-y-3 pt-4 border-t border-brand-border">
            <h3 class="font-serif text-lg text-brand-text">Corporate Consulting & Advisory History</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                v-for="c in (profile.consulting || [])" 
                :key="c.client_partner"
                class="bg-white rounded-xl border border-brand-border p-4 shadow-2xs space-y-1.5"
              >
                <div class="text-xs font-mono text-brand-muted flex items-center justify-between">
                  <span class="font-medium text-brand-text">{{ c.client_partner }}</span>
                  <span>{{ c.duration }}</span>
                </div>
                <div class="text-xs text-[#581C87] font-medium">{{ c.area }}</div>
                <p class="text-xs text-brand-muted">{{ c.outcomes }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Profile Modal -->
      <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-white rounded-2xl border border-brand-border max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between border-b border-brand-border pb-3">
            <h3 class="font-serif text-lg text-brand-text">Edit Academic Profile</h3>
            <button @click="showEditModal = false" class="text-brand-muted hover:text-brand-text text-sm cursor-pointer">✕</button>
          </div>

          <div class="space-y-3 text-xs text-left">
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Full Name & Title</label>
              <input v-model="editForm.name" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] text-brand-text" />
            </div>
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Academic Designation</label>
              <input v-model="editForm.designation" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] text-brand-text" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Department</label>
                <input v-model="editForm.department" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] text-brand-text" />
              </div>
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Institution</label>
                <input v-model="editForm.institution" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] text-brand-text" />
              </div>
            </div>
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Research Vision / Academic Bio</label>
              <textarea v-model="editForm.bio" rows="3" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] text-brand-text"></textarea>
            </div>
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Research Domains (comma-separated)</label>
              <input v-model="editForm.domains" placeholder="AI, Compilers, Systems, Robotics" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] text-brand-text" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">ORCID ID</label>
                <input v-model="editForm.orcid_id" placeholder="0000-0002-XXXX-XXXX" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] text-brand-text" />
              </div>
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Google Scholar URL</label>
                <input v-model="editForm.google_scholar_url" placeholder="https://scholar.google.com/..." class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] text-brand-text" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-brand-border">
            <button @click="showEditModal = false" class="px-4 py-2 text-xs font-mono rounded-lg border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer">
              Cancel
            </button>
            <button @click="saveProfileEdits" class="btn-primary text-xs px-4 py-2 rounded-lg font-mono cursor-pointer">
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <!-- Add Research Project Modal -->
      <div v-if="showAddModal === 'project'" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-white rounded-2xl border border-brand-border max-w-lg w-full p-6 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-brand-border pb-3">
            <div>
              <h3 class="font-serif text-lg text-brand-text">Add Research Agenda & Lab Project</h3>
              <p class="text-xs text-brand-muted mt-0.5">Document laboratory research projects and foundational scientific agendas.</p>
            </div>
            <button @click="showAddModal = null" class="text-brand-muted hover:text-brand-text text-sm cursor-pointer">✕</button>
          </div>
          <form @submit.prevent="addProject" class="space-y-3 text-xs text-left">
            <div>
              <label class="block font-medium text-brand-text mb-1 font-mono">Project Title *</label>
              <input v-model="projectForm.title" required placeholder="e.g. Automated Scientific Reasoning Engine (Project Propagator)" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-medium text-brand-text mb-1 font-mono">Research Domain / Area *</label>
                <input v-model="projectForm.area" required placeholder="e.g. Symbolic AI & Constraint Systems" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text" />
              </div>
              <div>
                <label class="block font-medium text-brand-text mb-1 font-mono">Year / Timeline</label>
                <input v-model="projectForm.year" placeholder="e.g. 2024 - 2026 or 2025" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-medium text-brand-text mb-1 font-mono">Principal Role</label>
                <select v-model="projectForm.role" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text cursor-pointer">
                  <option value="Lead Principal Investigator">Lead Principal Investigator</option>
                  <option value="Co-Principal Investigator">Co-Principal Investigator</option>
                  <option value="Research Laboratory Director">Research Laboratory Director</option>
                  <option value="Senior Research Scientist">Senior Research Scientist</option>
                  <option value="Faculty Supervisor">Faculty Supervisor</option>
                </select>
              </div>
              <div>
                <label class="block font-medium text-brand-text mb-1 font-mono">Project / Lab URL (Optional)</label>
                <input v-model="projectForm.url" placeholder="https://csail.mit.edu/project/..." class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text" />
              </div>
            </div>
            <div>
              <label class="block font-medium text-brand-text mb-1 font-mono">Scientific Agenda & Description</label>
              <textarea v-model="projectForm.description" rows="3" placeholder="Outline the core hypothesis, theoretical framework, architecture, or experimental setup..." class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white text-brand-text resize-none"></textarea>
            </div>
            <div class="flex items-center justify-end gap-2 pt-3 border-t border-brand-border">
              <button type="button" @click="showAddModal = null" class="px-4 py-2 text-xs font-mono rounded-lg border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer">Cancel</button>
              <button type="submit" class="btn-primary text-xs px-4 py-2 rounded-lg font-mono cursor-pointer">Save Research Project</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Add Grant Modal -->
      <div v-if="showAddModal === 'grant'" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-white rounded-2xl border border-brand-border max-w-md w-full p-6 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-brand-border pb-3">
            <h3 class="font-serif text-lg text-brand-text">Add Research Grant Record</h3>
            <button @click="showAddModal = null" class="text-brand-muted hover:text-brand-text text-sm cursor-pointer">✕</button>
          </div>
          <div class="space-y-3 text-xs text-left">
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Grant Project Title</label>
              <input v-model="grantForm.title" placeholder="Zero-Trust Architecture in Grid Systems" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
            </div>
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Funding Agency</label>
              <input v-model="grantForm.funding_agency" placeholder="DST, ICMR, NSF, Shell Energy" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Grant Amount</label>
                <input v-model="grantForm.grant_amount" placeholder="₹25,00,000 / $500,000" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
              </div>
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Tenure / Year</label>
                <input v-model="grantForm.year" placeholder="2024 - 2027" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Investigator Role</label>
                <input v-model="grantForm.role" placeholder="Principal Investigator (PI)" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
              </div>
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Status</label>
                <select v-model="grantForm.status" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87] bg-white">
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Under Review">Under Review</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-3 border-t border-brand-border">
            <button @click="showAddModal = null" class="px-4 py-2 text-xs font-mono rounded-lg border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer">Cancel</button>
            <button @click="addGrant" class="btn-primary text-xs px-4 py-2 rounded-lg font-mono cursor-pointer">Save Grant</button>
          </div>
        </div>
      </div>

      <!-- Add Publication Modal -->
      <div v-if="showAddModal === 'publication'" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-white rounded-2xl border border-brand-border max-w-md w-full p-6 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-brand-border pb-3">
            <h3 class="font-serif text-lg text-brand-text">Add Research Publication</h3>
            <button @click="showAddModal = null" class="text-brand-muted hover:text-brand-text text-sm cursor-pointer">✕</button>
          </div>
          <div class="space-y-3 text-xs text-left">
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Paper / Article Title</label>
              <input v-model="pubForm.title" placeholder="Analysis of Distributed Ledger Scaling..." class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
            </div>
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Journal or Conference</label>
              <input v-model="pubForm.journal_or_conference" placeholder="IEEE S&P, ACM SIGCOMM, Nature Communications" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Year</label>
                <input v-model="pubForm.year" placeholder="2025" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
              </div>
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Citations (Optional)</label>
                <input v-model="pubForm.citations" placeholder="45+" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
              </div>
            </div>
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">DOI or URL</label>
              <input v-model="pubForm.doi_or_url" placeholder="https://doi.org/10.1145/..." class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-3 border-t border-brand-border">
            <button @click="showAddModal = null" class="px-4 py-2 text-xs font-mono rounded-lg border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer">Cancel</button>
            <button @click="addPublication" class="btn-primary text-xs px-4 py-2 rounded-lg font-mono cursor-pointer">Save Publication</button>
          </div>
        </div>
      </div>

      <!-- Add Experience Modal -->
      <div v-if="showAddModal === 'experience'" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div class="bg-white rounded-2xl border border-brand-border max-w-md w-full p-6 space-y-4 shadow-xl">
          <div class="flex items-center justify-between border-b border-brand-border pb-3">
            <h3 class="font-serif text-lg text-brand-text">Add Academic Appointment</h3>
            <button @click="showAddModal = null" class="text-brand-muted hover:text-brand-text text-sm cursor-pointer">✕</button>
          </div>
          <div class="space-y-3 text-xs text-left">
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Academic Title</label>
              <input v-model="expForm.title" placeholder="Visiting Chair / Associate Professor" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
            </div>
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Institution / Organization</label>
              <input v-model="expForm.organization" placeholder="Oxford University / Xerox PARC" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">Start Year</label>
                <input v-model="expForm.start_year" placeholder="2018" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
              </div>
              <div>
                <label class="block font-medium text-brand-muted mb-1 font-mono">End Year</label>
                <input v-model="expForm.end_year" placeholder="2022 or Present" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]" />
              </div>
            </div>
            <div>
              <label class="block font-medium text-brand-muted mb-1 font-mono">Description of Role & Research</label>
              <textarea v-model="expForm.description" rows="2" class="w-full border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-[#581C87]"></textarea>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-3 border-t border-brand-border">
            <button @click="showAddModal = null" class="px-4 py-2 text-xs font-mono rounded-lg border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer">Cancel</button>
            <button @click="addExperience" class="btn-primary text-xs px-4 py-2 rounded-lg font-mono cursor-pointer">Save Appointment</button>
          </div>
        </div>
      </div>
    </div>
  `
});
