import { ref, reactive, computed } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';

export default {
  name: 'FacultyCoursesView',
  props: {
    facultyUser: {
      type: Object,
      default: () => ({})
    },
    courses: {
      type: Array,
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
    }
  },
  emits: ['create-course', 'refresh-courses', 'search', 'change-page', 'filter-difficulty', 'filter-source', 'reset-filters'],
  setup(props, { emit }) {
    const showModal = ref(false);
    const searchQuery = ref('');
    const jumpPageInput = ref('');
    const sourceOptions = [
      { id: 'all', label: 'All Sources' },
      { id: 'swayam', label: 'SWAYAM / NPTEL' },
      { id: 'skill_india', label: 'Skill India Digital' },
      { id: 'mit', label: 'MIT OpenCourseWare' }
    ];
    const difficultyOptions = [
      { id: 'all', label: 'All Levels' },
      { id: 'Beginner', label: 'Beginner' },
      { id: 'Intermediate', label: 'Intermediate' },
      { id: 'Advanced', label: 'Advanced' }
    ];

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
      
      const pages = [];
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
      provider: props.facultyUser?.institution_or_company || 'All India Institute of Ayurveda (AIIA) / SWAYAM',
      target_skills: '',
      target_domain: 'Computer Science',
      difficulty: 'Intermediate',
      duration_hours: 45,
      description: '',
      url: ''
    });

    function onSearch() {
      emit('search', searchQuery.value);
    }

    function onPage(p) {
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

    function onSelectDifficulty(diff) {
      emit('filter-difficulty', diff);
    }

    function onSelectSource(src) {
      emit('filter-source', src);
    }

    function clearSearch() {
      searchQuery.value = '';
      emit('search', '');
    }

    function onResetFilters() {
      searchQuery.value = '';
      emit('reset-filters');
    }

    function openModal() {
      showModal.value = true;
    }

    function closeModal() {
      showModal.value = false;
    }

    function onSubmit() {
      emit('create-course', {
        title: form.title,
        provider: form.provider,
        target_skills: form.target_skills.split(',').map(s => s.trim()).filter(Boolean),
        target_domain: form.target_domain,
        difficulty: form.difficulty,
        duration_hours: Number(form.duration_hours) || 40,
        description: form.description,
        url: form.url || '#'
      });
      form.title = '';
      form.target_skills = '';
      form.description = '';
      form.url = '';
      closeModal();
    }

    return {
      showModal,
      searchQuery,
      jumpPageInput,
      sourceOptions,
      difficultyOptions,
      visiblePages,
      startItem,
      endItem,
      form,
      decodeHtml,
      onSearch,
      clearSearch,
      onPage,
      jumpToPage,
      onSelectSource,
      onSelectDifficulty,
      onResetFilters,
      openModal,
      closeModal,
      onSubmit
    };
  },
  template: `
    <div class="space-y-6">
      <header class="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 class="font-serif text-3xl text-brand-text mb-2">Academic Courseware & Curriculum Modules</h1>
          <p class="text-brand-muted text-sm">Manage, search, and propose academic syllabus modules from participating institutions (SWAYAM, Skill India Digital, MIT) indexed for multi-signal talent calibration.</p>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="totalCourses > 0" class="text-xs font-mono text-brand-muted bg-brand-surface px-3 py-1.5 rounded-lg border border-brand-border">
            {{ totalCourses.toLocaleString() }} Modules Total
          </div>
          <button @click="openModal" class="btn-primary text-sm px-4 py-2 rounded-lg font-medium shadow-sm cursor-pointer">
            + Propose Courseware Module
          </button>
        </div>
      </header>

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
          <div class="flex items-center gap-1.5">
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
        <div class="font-serif text-lg text-brand-text mb-2">No courseware found</div>
        <p class="max-w-sm mx-auto leading-relaxed">No modules match your current query. Try selecting "All Levels" or propose a new curriculum module.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="c in courses" :key="c.course_id" class="card p-5 flex flex-col justify-between hover:border-[#DDD6FE] transition-colors shadow-sm">
          <div>
            <div class="flex justify-between items-start mb-2 gap-2">
              <h3 class="font-serif text-base text-brand-text leading-snug">{{ decodeHtml(c.title) }}</h3>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded border border-brand-border text-brand-muted shrink-0">{{ c.difficulty || 'Advanced' }}</span>
            </div>
            <div class="text-xs text-[#581C87] font-mono mb-2 font-medium">{{ c.provider || 'Institution' }}</div>
            <p class="text-xs text-brand-muted mb-4 line-clamp-3 leading-relaxed">{{ decodeHtml(c.description) }}</p>
          </div>

          <div class="pt-3 border-t border-brand-border flex items-center justify-between">
            <div class="flex flex-wrap gap-1">
              <span v-for="s in (c.target_skills || []).slice(0, 3)" :key="s" class="text-[10px] bg-brand-surface px-1.5 py-0.5 rounded border border-brand-border font-mono text-brand-text">{{ s }}</span>
            </div>
            <a :href="c.url || '#'" target="_blank" class="text-xs font-mono text-[#581C87] hover:underline flex items-center gap-1 font-medium">
              Syllabus ↗
            </a>
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

        <!-- Summary & Direct Page Jump -->
        <div class="flex flex-wrap items-center justify-center gap-4 text-xs text-brand-muted font-mono">
          <div>
            Showing <span class="font-semibold text-brand-text">{{ startItem }}–{{ endItem }}</span>
            <span v-if="totalCourses > 0"> of <span class="font-semibold text-brand-text">{{ totalCourses.toLocaleString() }}</span> modules</span>
            <span class="ml-1.5">(Page {{ currentPage }} of {{ totalPages }})</span>
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

      <!-- Propose Courseware Modal -->
      <div v-if="showModal" class="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-xl border border-brand-border max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
          <div class="flex justify-between items-center pb-3 border-b border-brand-border">
            <h2 class="font-serif text-xl text-brand-text">Propose Courseware Module</h2>
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
                <input v-model="form.provider" type="text" required class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
              </div>
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Academic Domain</label>
                <select v-model="form.target_domain" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]">
                  <option>Computer Science</option>
                  <option>Ayurvedic Pharmaceutical Sciences & Quality Control</option>
                  <option>Data Science & Machine Learning</option>
                  <option>Systems Architecture</option>
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
                <input v-model="form.duration_hours" type="number" min="1" max="300" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Target Skills (comma-separated)</label>
              <input v-model="form.target_skills" type="text" placeholder="Spectroscopy, WHO-GMP, Bio-Assay" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
            </div>

            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Syllabus Overview & Description</label>
              <textarea v-model="form.description" rows="3" required placeholder="Outline core learning objectives, lab requirements, and certification standards..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]"></textarea>
            </div>

            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Syllabus / Canonical URL</label>
              <input v-model="form.url" type="url" placeholder="https://swayam.gov.in/..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-brand-border">
              <button type="button" @click="closeModal" class="btn-secondary px-4 py-2 text-sm rounded-lg">Cancel</button>
              <button type="submit" class="btn-primary px-4 py-2 text-sm rounded-lg font-medium">Propose Module</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
};
