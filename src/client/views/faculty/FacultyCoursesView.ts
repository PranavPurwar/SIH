import { ref, reactive, computed, watch, defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';
import type { AuthUser, CourseItem, OptionItem } from '../../types/index.js';

export interface FacultyCoursesViewProps {
  facultyUser?: AuthUser | null;
  courses: CourseItem[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalCourses: number;
  selectedDifficulty: string;
  selectedSource: string;
  courseQuery?: string;
}

export interface NewCoursePayload {
  title: string;
  provider: string;
  target_skills: string[] | string;
  target_domain: string;
  difficulty: string;
  duration_hours: number;
  description: string;
  url: string;
}

export default defineComponent({
  name: 'FacultyCoursesView',
  props: {
    facultyUser: {
      type: Object as PropType<AuthUser | null>,
      default: null
    },
    courses: {
      type: Array as PropType<CourseItem[]>,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    currentPage: {
      type: Number,
      default: 1
    },
    totalPages: {
      type: Number,
      default: 1
    },
    totalCourses: {
      type: Number,
      default: 0
    },
    selectedDifficulty: {
      type: String,
      default: 'all'
    },
    selectedSource: {
      type: String,
      default: 'all'
    },
    selectedProvider: {
      type: String,
      default: ''
    },
    courseQuery: {
      type: String,
      default: ''
    }
  },
  emits: ['create-course', 'update-course', 'refresh-courses', 'search', 'change-page', 'filter-difficulty', 'filter-source', 'filter-provider', 'reset-filters'],
  setup(props, { emit }) {
    const showModal = ref<boolean>(false);
    const isEditing = ref<boolean>(false);
    const editingCourseId = ref<string | null>(null);
    const searchQuery = ref<string>(props.courseQuery || '');
    watch(() => props.courseQuery, (newVal) => {
      if (newVal !== undefined && newVal !== searchQuery.value) {
        searchQuery.value = newVal;
      }
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    function onInput() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        emit('search', searchQuery.value.trim());
      }, 350);
    }
    const jumpPageInput = ref<string>('');
    const sourceOptions: OptionItem[] = [
      { id: 'all', label: 'All Sources' },
      { id: 'swayam', label: 'SWAYAM / NPTEL' },
      { id: 'skill_india', label: 'Skill India Digital' },
      { id: 'mit', label: 'MIT OpenCourseWare' }
    ];
    const difficultyOptions: OptionItem[] = [
      { id: 'all', label: 'All Levels' },
      { id: 'Beginner', label: 'Beginner' },
      { id: 'Intermediate', label: 'Intermediate' },
      { id: 'Advanced', label: 'Advanced' }
    ];

    function normalizeInstitution(name?: string): string {
      return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function canEditCourse(course: CourseItem): boolean {
      const userInst = props.facultyUser?.institution_or_company;
      if (!userInst || !course.provider) return false;
      const u = normalizeInstitution(userInst);
      const p = normalizeInstitution(course.provider);
      return u === p || u.includes(p) || p.includes(u);
    }

    const isInstitutionalScope = computed(() => {
      return props.selectedProvider !== 'all_consortium' && props.selectedProvider !== 'all';
    });

    function selectScope(scope: 'institution' | 'all') {
      if (scope === 'institution') {
        emit('filter-provider', props.facultyUser?.institution_or_company || '');
      } else {
        emit('filter-provider', 'all_consortium');
      }
    }

    // Google-style 10-page sliding window
    const visiblePages = computed(() => {
      const current = props.currentPage || 1;
      const total = props.totalPages || 1;
      if (total <= 10) {
        return Array.from({ length: total }, (_, i) => i + 1);
      }
      
      let start = Math.max(1, current - 4);
      let end = Math.min(total, current + 4);
      
      if (current <= 5) {
        start = 1;
        end = Math.min(total, 10);
      } else if (current + 4 >= total) {
        start = Math.max(1, total - 9);
        end = total;
      }
      
      const pages: (number | string)[] = [];
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

    const startItem = computed(() => {
      if (!props.courses?.length) return 0;
      return (props.currentPage - 1) * 12 + 1;
    });

    const endItem = computed(() => {
      if (!props.courses?.length) return 0;
      if (props.totalCourses > 0) {
        return Math.min(props.currentPage * 12, props.totalCourses);
      }
      return (props.currentPage - 1) * 12 + props.courses.length;
    });

    const form = reactive({
      title: '',
      provider: props.facultyUser?.institution_or_company || '',
      target_skills: '',
      target_domain: 'Computer Science',
      difficulty: 'Intermediate',
      duration_hours: 45,
      description: '',
      url: ''
    });

    function onPage(p: number) {
      if (p < 1 || p > props.totalPages || p === props.currentPage) return;
      emit('change-page', p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function jumpToPage() {
      const p = parseInt(jumpPageInput.value, 10);
      if (!isNaN(p) && p >= 1 && p <= props.totalPages && p !== props.currentPage) {
        onPage(p);
        jumpPageInput.value = '';
      }
    }

    function onSelectDifficulty(diff: string) {
      emit('filter-difficulty', diff);
    }

    function onSelectSource(src: string) {
      emit('filter-source', src);
    }

    function onSearch() {
      if (debounceTimer) clearTimeout(debounceTimer);
      emit('search', searchQuery.value.trim());
    }

    function clearSearch() {
      if (debounceTimer) clearTimeout(debounceTimer);
      searchQuery.value = '';
      emit('search', '');
    }

    function onResetFilters() {
      if (debounceTimer) clearTimeout(debounceTimer);
      searchQuery.value = '';
      emit('reset-filters');
    }

    function openCreateModal() {
      isEditing.value = false;
      editingCourseId.value = null;
      const userInst = props.facultyUser?.institution_or_company || '';
      form.title = '';
      form.provider = userInst;
      form.target_domain = 'Computer Science & Engineering';
      form.difficulty = 'Intermediate';
      form.duration_hours = 45;
      form.target_skills = '';
      form.description = '';
      form.url = '';
      showModal.value = true;
    }

    function openEditModal(course: CourseItem) {
      if (!canEditCourse(course)) return;
      isEditing.value = true;
      editingCourseId.value = course.course_id;
      form.title = course.title || '';
      form.provider = course.provider || props.facultyUser?.institution_or_company || '';
      form.target_domain = course.target_domain || 'General';
      form.difficulty = course.difficulty || 'Intermediate';
      form.duration_hours = course.duration_hours || 40;
      form.target_skills = Array.isArray(course.target_skills)
        ? course.target_skills.join(', ')
        : (course.target_skills || '');
      form.description = course.description || '';
      form.url = course.url || '';
      showModal.value = true;
    }

    function closeModal() {
      showModal.value = false;
      isEditing.value = false;
      editingCourseId.value = null;
    }

    function onSubmit() {
      const payload = {
        title: form.title.trim(),
        provider: form.provider.trim(),
        target_skills: form.target_skills.split(',').map(s => s.trim()).filter(Boolean),
        target_domain: form.target_domain.trim(),
        difficulty: form.difficulty,
        duration_hours: Number(form.duration_hours) || 40,
        description: form.description.trim(),
        url: form.url.trim() || '#'
      };

      if (isEditing.value && editingCourseId.value) {
        emit('update-course', {
          id: editingCourseId.value,
          courseData: payload
        });
      } else {
        emit('create-course', payload);
      }
      closeModal();
    }

    return {
      showModal,
      isEditing,
      editingCourseId,
      searchQuery,
      jumpPageInput,
      sourceOptions,
      difficultyOptions,
      visiblePages,
      startItem,
      endItem,
      form,
      isInstitutionalScope,
      selectScope,
      canEditCourse,
      decodeHtml,
      onInput,
      onSearch,
      clearSearch,
      onPage,
      jumpToPage,
      onSelectSource,
      onSelectDifficulty,
      onResetFilters,
      openCreateModal,
      openEditModal,
      closeModal,
      onSubmit
    };
  },
  template: `
    <div class="space-y-6">
      <header class="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 class="font-serif text-3xl text-brand-text mb-2">
            {{ isInstitutionalScope ? (facultyUser?.institution_or_company || 'Institutional') + ' Courseware Modules' : 'Consortium Courseware & Curriculum Modules' }}
          </h1>
          <p class="text-brand-muted text-sm">
            {{ isInstitutionalScope ? 'Manage, calibrate, and author accredited syllabus modules and clinical curricula offered by your institution.' : 'Explore cross-institutional syllabus benchmarks and reference curriculum modules across the consortium catalog.' }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="totalCourses > 0" class="text-xs font-mono text-brand-muted bg-brand-surface px-3 py-1.5 rounded-lg border border-brand-border">
            {{ totalCourses.toLocaleString() }} Modules Total
          </div>
          <button @click="openCreateModal" class="btn-primary text-sm px-4 py-2 rounded-lg font-medium shadow-sm cursor-pointer">
            + Propose Courseware Module
          </button>
        </div>
      </header>

      <!-- Scope Selector Tabs: My Institution vs All Consortium -->
      <div class="flex items-center gap-2 border-b border-brand-border pb-3 mb-6 flex-wrap">
        <button
          @click="selectScope('institution')"
          class="px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
          :class="isInstitutionalScope ? 'bg-[#581C87] text-white shadow-sm font-semibold' : 'bg-brand-surface text-brand-text hover:bg-gray-100 border border-brand-border'"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          <span>{{ facultyUser?.institution_or_company || 'My Institution' }} Modules</span>
          <span v-if="isInstitutionalScope" class="px-1.5 py-0.5 bg-white/20 rounded-full text-[10px] font-mono">{{ totalCourses }}</span>
        </button>

        <button
          @click="selectScope('all')"
          class="px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
          :class="!isInstitutionalScope ? 'bg-[#581C87] text-white shadow-sm font-semibold' : 'bg-brand-surface text-brand-text hover:bg-gray-100 border border-brand-border'"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
          <span>All Consortium Catalog</span>
          <span v-if="!isInstitutionalScope" class="px-1.5 py-0.5 bg-white/20 rounded-full text-[10px] font-mono">{{ totalCourses }}</span>
        </button>
      </div>

      <!-- Search & Filter Controls Toolbar -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-brand-border bg-white shadow-2xs mb-6">
        <!-- Live Keyword Search Input -->
        <div class="relative flex-1 max-w-md">
          <svg class="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input 
            type="text" 
            v-model="searchQuery" 
            @input="onInput"
            @keyup.enter="onSearch"
            placeholder="Search topics, skills, course titles..." 
            class="w-full text-xs pl-9 pr-8 py-2 border border-brand-border rounded-lg outline-none focus:border-[#581C87] bg-white font-sans text-brand-text placeholder:text-brand-muted transition-colors"
          />
          <button 
            v-if="searchQuery" 
            @click="clearSearch" 
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text p-0.5 cursor-pointer text-xs"
            title="Clear search"
          >
            ✕
          </button>
        </div>

        <!-- Inline Dropdown Filters & Actions -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- Source Filter Dropdown -->
          <div v-if="!isInstitutionalScope" class="flex items-center gap-1.5">
            <span class="text-xs font-medium text-brand-muted uppercase tracking-wider font-mono">Source:</span>
            <select 
              :value="selectedSource" 
              @change="onSelectSource($event.target.value)"
              class="text-xs border border-brand-border rounded-lg px-2.5 py-1.5 outline-none focus:border-[#581C87] bg-white font-mono text-brand-text cursor-pointer transition-colors"
            >
              <option v-for="s in sourceOptions" :key="s.id" :value="s.id">{{ s.label }}</option>
            </select>
          </div>

          <!-- Difficulty Filter Dropdown -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-medium text-brand-muted uppercase tracking-wider font-mono">Level:</span>
            <select 
              :value="selectedDifficulty" 
              @change="onSelectDifficulty($event.target.value)"
              class="text-xs border border-brand-border rounded-lg px-2.5 py-1.5 outline-none focus:border-[#581C87] bg-white font-mono text-brand-text cursor-pointer transition-colors"
            >
              <option v-for="d in difficultyOptions" :key="d.id" :value="d.id">{{ d.label }}</option>
            </select>
          </div>

          <button @click="onSearch" class="btn-primary px-4 py-1.5 text-xs rounded-lg font-medium shadow-sm cursor-pointer">
            Search
          </button>

          <button 
            v-if="selectedSource !== 'all' || selectedDifficulty !== 'all' || searchQuery"
            @click="onResetFilters"
            class="text-xs font-mono text-[#581C87] hover:underline whitespace-nowrap px-1 py-1 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>
      
      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
        <span class="spinner mr-2"></span> Loading institutional curriculum modules...
      </div>

      <div v-else-if="courses.length === 0" class="card p-12 text-center text-brand-muted text-sm">
        <div class="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-4 border border-brand-border text-[#581C87]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="font-serif text-lg text-brand-text mb-2">No institutional modules found</div>
        <p class="max-w-sm mx-auto leading-relaxed">
          {{ isInstitutionalScope ? 'No curriculum modules currently recorded for your institution. Click "+ Propose Courseware Module" to publish your first accredited syllabus.' : 'No modules match your current query.' }}
        </p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="c in courses" :key="c.course_id" class="card p-5 flex flex-col justify-between hover:border-[#DDD6FE] transition-colors shadow-sm space-y-4">
          <div>
            <div class="flex justify-between items-start mb-2 gap-2">
              <h3 class="font-serif text-base text-brand-text leading-snug font-semibold">{{ decodeHtml(c.title) }}</h3>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded border border-brand-border text-brand-muted shrink-0">{{ c.difficulty || 'Advanced' }}</span>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="text-xs text-[#581C87] font-mono font-medium">{{ c.provider || 'Institution' }}</span>
              <span v-if="canEditCourse(c)" class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                Your Institution
              </span>
              <span v-else class="text-[10px] bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded font-mono">
                Consortium Reference
              </span>
            </div>
            <p class="text-xs text-brand-muted mb-2 line-clamp-3 leading-relaxed">{{ decodeHtml(c.description) }}</p>
          </div>

          <div class="pt-3 border-t border-brand-border flex items-center justify-between gap-2 flex-wrap">
            <div class="flex flex-wrap gap-1">
              <span v-for="s in (c.target_skills || []).slice(0, 3)" :key="s" class="text-[10px] bg-brand-surface px-1.5 py-0.5 rounded border border-brand-border font-mono text-brand-text">{{ s }}</span>
            </div>

            <div class="flex items-center gap-2">
              <button 
                v-if="canEditCourse(c)"
                @click="openEditModal(c)"
                class="text-xs px-2.5 py-1 rounded-lg border border-[#581C87] text-[#581C87] hover:bg-[#F5F3FF] transition-colors font-medium flex items-center gap-1 cursor-pointer"
                title="Edit Courseware Module"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                </svg>
                <span>Edit Module</span>
              </button>

              <a :href="c.url || '#'" target="_blank" class="text-xs font-mono text-[#581C87] hover:underline flex items-center gap-1 font-medium">
                Syllabus ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Google-Style Pagination Bar (Always visible when courses exist) -->
      <div v-if="courses.length > 0" class="mt-10 pt-6 border-t border-brand-border flex flex-col items-center gap-4">
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
              @click="onPage(Number(p))"
              class="w-8 h-8 rounded-lg text-xs font-mono transition-colors cursor-pointer"
              :class="currentPage === p ? 'bg-[#581C87] text-white font-bold shadow-xs' : 'border border-brand-border bg-white text-brand-text hover:border-[#581C87]'"
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

        <!-- Meta Summary Information & Quick Jump -->
        <div class="flex flex-wrap items-center justify-center gap-4 text-xs text-brand-muted font-mono">
          <div>
            Showing <span class="text-brand-text font-medium">{{ startItem }}</span> to 
            <span class="text-brand-text font-medium">{{ endItem }}</span> of 
            <span class="text-brand-text font-medium">{{ totalCourses.toLocaleString() }}</span> modules
          </div>

          <div v-if="totalPages > 5" class="flex items-center gap-2">
            <span>Jump to page:</span>
            <input 
              type="number" 
              v-model="jumpPageInput" 
              @keyup.enter="jumpToPage" 
              :min="1" 
              :max="totalPages" 
              placeholder="No." 
              class="w-16 px-2 py-1 bg-white border border-brand-border rounded text-center text-xs text-brand-text outline-none focus:border-[#581C87]"
            />
            <button @click="jumpToPage" class="btn-secondary px-2.5 py-1 rounded text-xs font-medium">Go</button>
          </div>
        </div>
      </div>

      <!-- Propose / Edit Courseware Modal -->
      <div v-if="showModal" class="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-xl border border-brand-border max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
          <div class="flex justify-between items-center pb-3 border-b border-brand-border">
            <div>
              <h2 class="font-serif text-xl text-brand-text">{{ isEditing ? 'Edit Institutional Courseware Module' : 'Propose Courseware Module' }}</h2>
              <p class="text-xs text-brand-muted">{{ isEditing ? 'Update syllabus description, target skills, domain, and canonical URL.' : 'Submit a new accredited curriculum module from your institution to the catalog.' }}</p>
            </div>
            <button @click="closeModal" class="text-brand-muted hover:text-brand-text text-sm">✕</button>
          </div>

          <form @submit.prevent="onSubmit" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Module Title</label>
              <input v-model="form.title" type="text" required placeholder="e.g. Standardized Protocols in Ayurvedic Drug Standardization" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Academic Provider</label>
                <input v-model="form.provider" type="text" :disabled="isEditing" required class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] disabled:bg-gray-100 disabled:text-brand-muted" />
              </div>
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Academic Domain</label>
                <select v-model="form.target_domain" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]">
                  <option>Computer Science & Engineering</option>
                  <option>Data Science & Artificial Intelligence</option>
                  <option>Biological Sciences & Genomics</option>
                  <option>Chemical Sciences & Molecular Engineering</option>
                  <option>Health Sciences & Pharmacology</option>
                  <option>Educational Technology & Pedagogy</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Difficulty Level</label>
                <select v-model="form.difficulty" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]">
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Estimated Hours</label>
                <input v-model.number="form.duration_hours" type="number" min="1" max="300" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Target Skills (comma-separated)</label>
              <input v-model="form.target_skills" type="text" placeholder="Dravyaguna, HPTLC, Phytochemistry" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
            </div>

            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Syllabus Overview & Description</label>
              <textarea v-model="form.description" rows="3" required placeholder="Outline core learning objectives, lab requirements, and certification standards..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]"></textarea>
            </div>

            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Syllabus / Canonical URL</label>
              <input v-model="form.url" type="url" placeholder="https://aiia.gov.in/curriculum/..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-brand-border">
              <button type="button" @click="closeModal" class="btn-secondary px-4 py-2 text-sm rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" class="btn-primary px-4 py-2 text-sm rounded-lg font-medium cursor-pointer">
                {{ isEditing ? 'Save Changes' : 'Propose Module' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
});
