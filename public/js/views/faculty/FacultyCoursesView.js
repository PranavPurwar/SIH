import { ref, reactive } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';

export default {
  name: 'FacultyCoursesView',
  props: {
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
    }
  },
  emits: ['create-course', 'refresh-courses', 'search', 'change-page', 'filter-difficulty'],
  setup(props, { emit }) {
    const showModal = ref(false);
    const searchQuery = ref('');
    const difficultyOptions = [
      { id: 'all', label: 'All Levels' },
      { id: 'Beginner', label: 'Beginner' },
      { id: 'Intermediate', label: 'Intermediate' },
      { id: 'Advanced', label: 'Advanced' }
    ];

    const form = reactive({
      title: '',
      provider: 'MIT Department of Electrical Engineering & Computer Science',
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
      emit('change-page', p);
    }

    function onSelectDifficulty(diff) {
      emit('filter-difficulty', diff);
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
      showModal.value = false;
    }

    function getDifficultyBadgeClass(difficulty) {
      const d = (difficulty || '').toLowerCase();
      if (d === 'beginner' || d === 'novice') {
        return 'bg-emerald-50/10 text-emerald-700 border-emerald-200/30';
      }
      if (d === 'advanced') {
        return 'bg-purple-950/10 text-purple-700 border-purple-300';
      }
      return 'bg-anthropic-peach/10 text-[#581C87] border-anthropic-peach/30';
    }

    return {
      showModal,
      form,
      searchQuery,
      difficultyOptions,
      openModal,
      closeModal,
      onSubmit,
      onSearch,
      onPage,
      onSelectDifficulty,
      getDifficultyBadgeClass,
      decodeHtml
    };
  },
  template: `
    <div class="space-y-6">
      <header class="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 class="font-serif text-3xl text-brand-text mb-2">MIT Courseware Modules</h1>
          <p class="text-brand-muted text-sm">Manage, search, and propose academic syllabus modules indexed for multi-signal talent calibration.</p>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="totalCourses > 0" class="text-xs font-mono text-brand-muted bg-brand-surface px-3 py-1.5 rounded-lg border border-brand-border">
            {{ totalCourses.toLocaleString() }} Modules Total
          </div>
          <button @click="openModal" class="btn-primary text-sm px-4 py-2 rounded-lg font-medium shadow-sm">
            + Propose Module
          </button>
        </div>
      </header>

      <!-- Search and Filter Controls -->
      <div class="space-y-4 mb-6">
        <div class="flex gap-3">
          <input 
            type="text" 
            v-model="searchQuery" 
            @keyup.enter="onSearch"
            placeholder="Search topics, skills, or MIT course titles..." 
            class="w-full max-w-md bg-white border border-brand-border text-brand-text px-4 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach"
          />
          <button @click="onSearch" class="btn-primary px-5 py-2 text-sm rounded-lg font-medium shadow-sm">
            Search
          </button>
          <button 
            v-if="searchQuery" 
            @click="searchQuery = ''; onSearch()" 
            class="btn-secondary px-3 py-2 text-sm rounded-lg"
          >
            Clear
          </button>
        </div>

        <!-- Difficulty Tier Filter Pills -->
        <div class="flex items-center gap-2 pt-1">
          <span class="text-xs text-brand-muted font-medium mr-1">Difficulty:</span>
          <button 
            v-for="opt in difficultyOptions"
            :key="opt.id"
            @click="onSelectDifficulty(opt.id)"
            :class="selectedDifficulty.toLowerCase() === opt.id.toLowerCase() ? 'bg-anthropic-text text-white border-anthropic-text' : 'bg-white text-brand-muted hover:text-brand-text border-brand-border'"
            class="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors shadow-2xs"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
        <span class="spinner mr-2"></span> Loading academic courseware modules...
      </div>

      <div v-else-if="courses.length === 0" class="card p-12 text-center text-brand-muted text-sm">
        <div class="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-4 border border-brand-border text-[#581C87]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        </div>
        <div class="font-serif text-lg text-brand-text mb-2">No modules found</div>
        <p class="max-w-sm mx-auto leading-relaxed">No course modules matched your search criteria. Try clearing filters or propose a new syllabus module.</p>
      </div>

      <div v-else class="space-y-4">
        <div v-for="c in courses" :key="c.course_id" class="card p-6 transition-colors hover:bg-white">
          <div class="flex flex-wrap justify-between items-start mb-2 gap-2">
            <div>
              <h3 class="font-serif text-lg text-brand-text leading-tight mb-1">{{ decodeHtml(c.title) }}</h3>
              <div class="text-xs text-brand-muted flex items-center gap-2">
                <span class="font-medium text-brand-text">{{ c.provider || 'MIT OpenCourseWare' }}</span>
                <span>• {{ c.duration_hours || 40 }} Hours</span>
                <span v-if="c.target_domain">• {{ c.target_domain }}</span>
              </div>
            </div>
            <span 
              :class="getDifficultyBadgeClass(c.difficulty)"
              class="text-xs px-2.5 py-0.5 rounded font-mono font-medium border"
            >
              {{ c.difficulty || 'Intermediate' }}
            </span>
          </div>

          <p class="text-sm text-brand-muted mb-4 leading-relaxed max-w-3xl">{{ decodeHtml(c.description) }}</p>

          <div class="flex justify-between items-center pt-4 border-t border-brand-border text-xs">
            <div class="flex flex-wrap gap-1.5">
              <span class="text-brand-muted font-medium mr-1 self-center">Target Skills:</span>
              <span v-for="s in (c.target_skills || []).slice(0, 5)" :key="s" class="bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-brand-text font-mono text-[11px]">
                {{ s }}
              </span>
            </div>
            <a :href="c.url || '#'" target="_blank" class="text-[#581C87] hover:underline font-medium flex items-center gap-1 font-mono">
              <span>View Syllabus</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-between items-center mt-6 text-sm">
        <span class="text-brand-muted font-mono text-xs">Page {{ currentPage }} of {{ totalPages }} ({{ totalCourses > 0 ? totalCourses.toLocaleString() : '2,153' }} Total)</span>
        <div class="flex gap-2">
          <button @click="onPage(currentPage - 1)" :disabled="currentPage <= 1" class="btn-secondary px-3 py-1.5 rounded-lg disabled:opacity-50 text-xs font-medium">Previous</button>
          <button @click="onPage(currentPage + 1)" :disabled="currentPage >= totalPages" class="btn-secondary px-3 py-1.5 rounded-lg disabled:opacity-50 text-xs font-medium">Next</button>
        </div>
      </div>

      <!-- Add Course Modal -->
      <div v-if="showModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 1rem;">
        <div class="card w-full max-w-lg p-6 space-y-6 shadow-2xl">
          <div class="flex justify-between items-center">
            <h2 class="font-serif text-2xl text-brand-text">Propose Academic Module</h2>
            <button @click="closeModal" class="text-brand-muted hover:text-brand-text text-xl">✕</button>
          </div>
          <form @submit.prevent="onSubmit" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Course Title</label>
              <input v-model="form.title" required placeholder="e.g. 6.033: Computer System Engineering" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Institution / Department</label>
                <input v-model="form.provider" required class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
              </div>
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Difficulty Tier</label>
                <select v-model="form.difficulty" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach">
                  <option value="Beginner">Beginner / Novice</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Target Domain</label>
                <input v-model="form.target_domain" placeholder="e.g. Distributed Systems" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
              </div>
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Estimated Hours</label>
                <input v-model.number="form.duration_hours" type="number" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Target Skills (comma separated)</label>
              <input v-model="form.target_skills" required placeholder="e.g. Distributed Systems, Concurrency, RPC, Fault Tolerance" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
            </div>
            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Description and Learning Outcomes</label>
              <textarea v-model="form.description" rows="3" required placeholder="Describe modular objectives, lab assignments, and theoretical foundations..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach"></textarea>
            </div>
            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Syllabus URL</label>
              <input v-model="form.url" placeholder="https://ocw.mit.edu/courses/..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
            </div>
            <div class="flex justify-end gap-3 pt-4 border-t border-brand-border">
              <button type="button" @click="closeModal" class="btn-secondary px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button type="submit" class="btn-primary px-4 py-2 rounded-lg text-sm font-medium">Publish Module</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
};
