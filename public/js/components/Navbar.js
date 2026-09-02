import { computed } from '../vue.js';

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
    const navItems = computed(() => {
      if (props.primaryNavTabs && props.primaryNavTabs.length > 0) return props.primaryNavTabs;
      if (props.tabs && props.tabs.length > 0) return props.tabs;
      return [];
    });

    function navigate(id) {
      emit('set-tab', id);
      emit('change-tab', id);
    }

    return {
      navItems,
      navigate
    };
  },
  template: `
    <header class="bg-[#FAF8FC]/95 backdrop-blur-md sticky top-0 z-50 border-b border-brand-border">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <!-- Minimal Logo -->
          <div 
            class="font-serif text-xl tracking-tight text-brand-text font-semibold cursor-pointer select-none flex items-center gap-2" 
            @click="navigate('jobs')"
          >
            <span class="w-2.5 h-2.5 rounded-full bg-[#581C87]"></span>
            <span>SkillBridge</span>
          </div>

          <!-- Navigation Links -->
          <nav class="hidden md:flex items-center gap-6">
            <button 
              v-for="t in navItems" 
              :key="t.id"
              @click="navigate(t.id)"
              :class="activeTab === t.id ? 'text-[#581C87] font-medium border-b-2 border-[#581C87]' : 'text-brand-muted hover:text-brand-text font-normal'"
              class="pb-1 text-sm transition-colors"
            >
              {{ t.name }}
            </button>
          </nav>
        </div>

        <!-- User Controls -->
        <div class="flex items-center gap-3">
          <div 
            class="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-brand-surface transition-colors" 
            @click="$emit('set-tab', 'profile')"
            title="View Profile"
          >
            <div class="w-6 h-6 rounded-full border border-[#DDD6FE] bg-[#F5F3FF] flex items-center justify-center text-[11px] font-semibold text-[#581C87] uppercase">
              {{ authUser?.name ? authUser.name.charAt(0) : 'U' }}
            </div>
            <span class="text-xs text-brand-text font-medium hidden sm:inline">{{ authUser?.name }}</span>
            <span class="text-[10px] bg-brand-surface text-brand-muted px-1.5 py-0.5 rounded border border-brand-border capitalize font-mono">{{ authUser?.role }}</span>
          </div>

          <button 
            @click="$emit('logout')" 
            class="text-xs text-brand-muted hover:text-brand-text border border-brand-border bg-white px-2.5 py-1.5 rounded-lg hover:bg-brand-surface transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </div>

      <!-- Mobile Navigation -->
      <div class="md:hidden flex gap-4 px-4 sm:px-6 py-2.5 border-t border-brand-border/60 overflow-x-auto">
        <button 
          v-for="t in primaryNavTabs" 
          :key="t.id"
          @click="$emit('set-tab', t.id)"
          :class="activeTab === t.id ? 'text-[#581C87] font-semibold border-b-2 border-[#581C87]' : 'text-brand-muted'"
          class="pb-1 text-xs whitespace-nowrap"
        >
          {{ t.name }}
        </button>
      </div>
    </header>
  `
};

