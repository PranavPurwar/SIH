import { ref } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';

export default {
  name: 'CoursesView',
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
    selectedDifficulty: {
      type: String,
      default: 'all'
    }
  },
  emits: ['search', 'change-page', 'filter-difficulty'],
  setup(props, { emit }) {
    const searchQuery = ref('');
    const difficultyOptions = [
      { id: 'all', label: 'All Levels' },
      { id: 'Beginner', label: 'Beginner' },
      { id: 'Intermediate', label: 'Intermediate' },
      { id: 'Advanced', label: 'Advanced' }
    ];

    function onSearch() {
      emit('search', searchQuery.value);
    }

    function onPage(p) {
      emit('change-page', p);
    }

    function onSelectDifficulty(diff) {
      emit('filter-difficulty', diff);
    }

    function getDifficultyBadgeClass(difficulty) {
      const d = (difficulty || '').toLowerCase();
      if (d === 'beginner' || d === 'novice') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      }
      if (d === 'advanced') {
        return 'bg-purple-50 text-purple-700 border-purple-200';
      }
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }

    return {
      searchQuery,
      difficultyOptions,
      decodeHtml,
      onSearch,
      onPage,
      onSelectDifficulty,
      getDifficultyBadgeClass
    };
  },
  template: `
    <div class="space-y-6">
      <header class="mb-6">
        <h1 class="font-serif text-3xl text-brand-text mb-2">MIT Courseware</h1>
        <p class="text-brand-muted text-sm">Targeted academic curriculum matched to industry skill benchmarks and difficulty tiers.</p>
      </header>
      
      <!-- Search and Filter Controls -->
      <div class="space-y-4 mb-6">
        <div class="flex gap-3">
          <input 
            type="text" 
            v-model="searchQuery" 
            @keyup.enter="onSearch"
            placeholder="Search topics, skills, or MIT course titles..." 
            class="w-full max-w-md bg-white border border-brand-border text-brand-text px-4 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]"
          />
          <button @click="onSearch" class="btn-primary px-5 py-2 text-sm rounded-lg font-medium shadow-sm">
            Search
          </button>
        </div>

        <!-- Difficulty Tier Filter Pills -->
        <div class="flex items-center gap-2 pt-1">
          <span class="text-xs text-brand-muted font-medium mr-1">Difficulty:</span>
          <button 
            v-for="opt in difficultyOptions" 
            :key="opt.id" 
            @click="onSelectDifficulty(opt.id)"
            :class="selectedDifficulty.toLowerCase() === opt.id.toLowerCase() ? 'bg-white text-[#581C87] border-[#DDD6FE] bg-[#F5F3FF] font-medium shadow-2xs' : 'bg-white text-brand-muted hover:text-brand-text border-brand-border'"
            class="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors shadow-2xs"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
        <span class="spinner mr-2"></span> Loading curriculum...
      </div>

      <div v-else-if="courses.length === 0" class="card p-12 text-center text-brand-muted text-sm">
        <div class="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-4 border border-brand-border text-[#581C87]">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="font-serif text-lg text-brand-text mb-2">No courses found</div>
        <p class="max-w-sm mx-auto leading-relaxed">No modules match your search and difficulty criteria. Try selecting "All Levels" or clearing keywords.</p>
      </div>

      <div v-else class="space-y-4">
        <div v-for="c in courses" :key="c.course_id" class="card p-5 hover:border-[#DDD6FE] transition-colors shadow-sm">
          <div class="flex flex-wrap justify-between items-start mb-2 gap-2">
            <h3 class="font-serif text-lg text-brand-text leading-tight">{{ decodeHtml(c.title) }}</h3>
            <span 
              :class="getDifficultyBadgeClass(c.difficulty)"
              class="text-xs px-2.5 py-0.5 rounded-md border font-medium font-mono"
            >
              {{ c.difficulty || 'Intermediate' }}
            </span>
          </div>
          
          <div class="flex items-center gap-2 mb-3 text-xs text-brand-muted">
            <span v-if="c.provider" class="bg-brand-surface px-2 py-0.5 rounded border border-brand-border">{{ c.provider }}</span>
            <span v-if="c.duration_hours" class="font-mono">{{ c.duration_hours }} hrs</span>
          </div>

          <p class="text-sm text-brand-muted mb-4 max-w-3xl leading-relaxed">{{ decodeHtml(c.description) || 'MIT OpenCourseWare course curriculum.' }}</p>
          
          <div class="flex justify-between items-center pt-4 border-t border-brand-border">
            <div class="flex flex-wrap gap-1.5">
              <span v-for="s in (c.target_skills || []).slice(0, 4)" :key="s" class="text-xs text-brand-text bg-brand-surface px-2 py-0.5 border border-brand-border rounded font-mono">{{ s }}</span>
            </div>
            <a :href="c.url || '#'" target="_blank" class="text-xs font-mono text-[#581C87] hover:underline flex items-center gap-1 font-medium">
              View Syllabus →
            </a>
          </div>
        </div>
      </div>
      
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-between items-center mt-6 text-sm">
        <span class="text-brand-muted text-xs font-mono">Page {{ currentPage }} of {{ totalPages }}</span>
        <div class="flex gap-2">
          <button @click="onPage(currentPage - 1)" :disabled="currentPage <= 1" class="btn-secondary px-3 py-1.5 rounded-lg disabled:opacity-50 text-xs font-medium">Previous</button>
          <button @click="onPage(currentPage + 1)" :disabled="currentPage >= totalPages" class="btn-secondary px-3 py-1.5 rounded-lg disabled:opacity-50 text-xs font-medium">Next</button>
        </div>
      </div>
    </div>
  `
};
