import { ref, computed, onMounted, onUnmounted } from '../vue.js';

export default {
  name: 'Navbar',
  props: {
    authUser: {
      type: Object,
      default: null
    },
    activeTab: {
      type: String,
      default: 'jobs'
    },
    primaryNavTabs: {
      type: Array,
      default: () => []
    },
    tabs: {
      type: Array,
      default: () => []
    }
  },
  emits: ['set-tab', 'change-tab', 'logout'],
  setup(props, { emit }) {
    const showDropdown = ref(false);

    const isFaculty = computed(() => props.authUser?.role === 'faculty');

    const navItems = computed(() => {
      if (props.primaryNavTabs && props.primaryNavTabs.length > 0) return props.primaryNavTabs;
      if (props.tabs && props.tabs.length > 0) return props.tabs;
      return [];
    });

    function navigate(id) {
      emit('set-tab', id);
      emit('change-tab', id);
      showDropdown.value = false;
    }

    function toggleUserDropdown() {
      showDropdown.value = !showDropdown.value;
    }

    function onDocumentClick(e) {
      const el = document.getElementById('user-menu-container');
      if (el && !el.contains(e.target)) {
        showDropdown.value = false;
      }
    }

    onMounted(() => {
      document.addEventListener('click', onDocumentClick);
    });

    onUnmounted(() => {
      document.removeEventListener('click', onDocumentClick);
    });

    return {
      navItems,
      isFaculty,
      showDropdown,
      navigate,
      toggleUserDropdown
    };
  },
  template: `
    <header class="bg-[#FAF8FC]/95 backdrop-blur-md sticky top-0 z-50 border-b border-brand-border">
      <div class="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <!-- Minimal Logo -->
          <div 
            class="font-serif text-xl tracking-tight text-brand-text font-semibold cursor-pointer select-none flex items-center gap-2" 
            @click="navigate(isFaculty ? 'faculty-programs' : 'jobs')"
          >
            <span class="w-2.5 h-2.5 rounded-full bg-[#581C87]"></span>
            <span>SkillBridge</span>
          </div>

          <!-- Primary Horizontal Navigation Links -->
          <nav class="hidden md:flex items-center gap-6">
            <button 
              v-for="t in navItems" 
              :key="t.id"
              @click="navigate(t.id)"
              :class="activeTab === t.id ? 'text-[#581C87] font-medium border-b-2 border-[#581C87]' : 'text-brand-muted hover:text-brand-text font-normal'"
              class="pb-1 text-sm transition-colors cursor-pointer"
            >
              {{ t.name }}
            </button>
          </nav>
        </div>

        <!-- User Controls & Dropdown Popup -->
        <div class="relative" id="user-menu-container">
          <div 
            class="flex items-center gap-2.5 cursor-pointer p-1.5 px-2.5 rounded-lg border border-brand-border/70 hover:bg-brand-surface bg-white transition-colors shadow-2xs select-none" 
            @click.stop="toggleUserDropdown"
            title="Account & Academic Options"
          >
            <div class="w-6 h-6 rounded-full border border-[#DDD6FE] bg-[#F5F3FF] flex items-center justify-center text-[11px] font-semibold text-[#581C87] uppercase">
              {{ authUser?.name ? authUser.name.charAt(0) : 'U' }}
            </div>
            <div class="flex flex-col text-left hidden sm:flex">
              <span class="text-xs text-brand-text font-medium leading-none">{{ authUser?.name }}</span>
              <span v-if="authUser?.institution_or_company" class="text-[10px] text-brand-muted font-mono mt-0.5 max-w-[130px] truncate">
                {{ authUser.institution_or_company }}
              </span>
            </div>
            <span class="text-[10px] bg-brand-surface text-brand-muted px-1.5 py-0.5 rounded border border-brand-border capitalize font-mono">{{ authUser?.role }}</span>
            <svg class="w-3.5 h-3.5 text-brand-muted transition-transform duration-150" :class="showDropdown ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>

          <!-- Popup Dropdown Menu -->
          <div 
            v-if="showDropdown"
            class="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-brand-border shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
            @click.stop
          >
            <!-- User / Institution Header -->
            <div class="px-4 py-2.5 border-b border-brand-border/70 bg-brand-surface/40">
              <div class="text-xs font-semibold text-brand-text">{{ authUser?.name }}</div>
              <div class="text-[11px] text-brand-muted truncate">{{ authUser?.email }}</div>
              <div v-if="authUser?.institution_or_company" class="mt-1.5 inline-flex items-center gap-1.5 bg-[#F5F3FF] text-[#581C87] border border-[#DDD6FE] px-2 py-0.5 rounded text-[10px] font-mono">
                <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                <span class="truncate">{{ authUser.institution_or_company }}</span>
              </div>
            </div>

            <!-- Faculty Academic & Admin Tools: Courseware, Assessments, Institutional Profile -->
            <div v-if="isFaculty" class="py-1.5">
              <div class="px-4 py-1 text-[10px] font-mono text-brand-muted uppercase tracking-wider font-semibold">
                Institutional Tools
              </div>

              <!-- Courseware Modules -->
              <button 
                @click="navigate('courses')"
                :class="activeTab === 'courses' ? 'bg-[#F5F3FF] text-[#581C87] font-medium' : 'text-brand-text hover:bg-brand-surface'"
                class="w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4 text-purple-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="font-medium">Courseware Modules</div>
                  <div class="text-[10px] text-brand-muted">Syllabus & remedial OCW catalog</div>
                </div>
              </button>

              <!-- Assessment Suites -->
              <button 
                @click="navigate('quiz')"
                :class="activeTab === 'quiz' ? 'bg-[#F5F3FF] text-[#581C87] font-medium' : 'text-brand-text hover:bg-brand-surface'"
                class="w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4 text-indigo-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="font-medium">Assessment Suites</div>
                  <div class="text-[10px] text-brand-muted">Standardized benchmark suites</div>
                </div>
              </button>

              <!-- Institutional Profile -->
              <button 
                @click="navigate('profile')"
                :class="activeTab === 'profile' ? 'bg-[#F5F3FF] text-[#581C87] font-medium' : 'text-brand-text hover:bg-brand-surface'"
                class="w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4 text-emerald-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/>
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="font-medium">Institutional Profile</div>
                  <div class="text-[10px] text-brand-muted">Accreditation & faculty board</div>
                </div>
              </button>
            </div>

            <!-- Profile link for student/recruiter -->
            <div v-else class="py-1.5">
              <button 
                @click="navigate('profile')"
                :class="activeTab === 'profile' ? 'bg-[#F5F3FF] text-[#581C87] font-medium' : 'text-brand-text hover:bg-brand-surface'"
                class="w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4 text-purple-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <span>View Profile</span>
              </button>
            </div>

            <!-- Divider -->
            <div class="border-t border-brand-border/70 my-1"></div>

            <!-- Sign Out -->
            <button 
              @click="$emit('logout'); showDropdown = false;"
              class="w-full text-left px-4 py-2 text-xs text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Navigation -->
      <div class="md:hidden flex gap-4 px-4 sm:px-6 py-2.5 border-t border-brand-border/60 overflow-x-auto">
        <button 
          v-for="t in navItems" 
          :key="t.id"
          @click="navigate(t.id)"
          :class="activeTab === t.id ? 'text-[#581C87] font-semibold border-b-2 border-[#581C87]' : 'text-brand-muted'"
          class="pb-1 text-xs whitespace-nowrap cursor-pointer"
        >
          {{ t.name }}
        </button>
      </div>
    </header>
  `
};
