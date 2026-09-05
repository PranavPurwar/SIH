import { reactive, ref, computed, defineComponent, onMounted } from '../vue.js';
import type { LoginCredentials, RegisterPayload, DemoAccount } from '../types/index.js';
import { api } from '../services/api.js';

export default defineComponent({
  name: 'LoginView',
  emits: ['login', 'register'],
  setup(
    _props,
    { emit }: {
      emit: ((event: 'login', payload: LoginCredentials & { onComplete?: () => void }) => void) &
            ((event: 'register', payload: RegisterPayload & { onComplete?: () => void }) => void);
    }
  ) {
    const isRegistering = ref<boolean>(false);
    const isLoading = ref<boolean>(false);
    const isDemoLoading = ref<boolean>(false);
    const activeFilter = ref<'student' | 'faculty' | 'recruiter'>('student');
    const activeDemoEmail = ref<string | null>(null);
    const demoAccounts = ref<DemoAccount[]>([]);

    const loginForm = reactive<LoginCredentials>({
      email: '',
      password: ''
    });

    const registerForm = reactive<RegisterPayload>({
      name: '',
      email: '',
      password: '',
      role: 'student',
      institution_or_company: '',
      degree: ''
    });

    const filteredAccounts = computed(() => {
      return demoAccounts.value.filter(a => a.role === activeFilter.value);
    });

    const studentCount = computed(() => demoAccounts.value.filter(a => a.role === 'student').length);
    const facultyCount = computed(() => demoAccounts.value.filter(a => a.role === 'faculty').length);
    const recruiterCount = computed(() => demoAccounts.value.filter(a => a.role === 'recruiter').length);

    async function loadDemoAccounts() {
      isDemoLoading.value = true;
      try {
        const res = await api.getDemoAccounts();
        demoAccounts.value = res.accounts || [];
      } catch (err) {
        console.error('Failed to load demo accounts:', err);
      } finally {
        isDemoLoading.value = false;
      }
    }

    onMounted(() => {
      loadDemoAccounts();
    });

    function onLogin() {
      isLoading.value = true;
      emit('login', {
        ...loginForm,
        onComplete: () => {
          isLoading.value = false;
        }
      });
    }

    function onRegister() {
      isLoading.value = true;
      emit('register', {
        ...registerForm,
        onComplete: () => {
          isLoading.value = false;
        }
      });
    }

    function useDemo(email: string) {
      loginForm.email = email;
      loginForm.password = 'password';
      isLoading.value = true;
      activeDemoEmail.value = email;
      emit('login', {
        email,
        password: 'password',
        onComplete: () => {
          isLoading.value = false;
          activeDemoEmail.value = null;
        }
      });
    }

    return {
      isRegistering,
      isLoading,
      isDemoLoading,
      activeFilter,
      activeDemoEmail,
      filteredAccounts,
      studentCount,
      facultyCount,
      recruiterCount,
      loginForm,
      registerForm,
      onLogin,
      onRegister,
      useDemo
    };
  },
  template: `
    <div class="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-2rem)]">
      <div class="max-w-4xl w-full card p-0 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-brand-border shadow-sm">
        
        <!-- Left Panel: Authentication Form -->
        <div class="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div class="mb-6">
              <div class="font-serif text-2xl text-brand-text font-semibold tracking-tight">SkillBridge</div>
              <p class="text-xs text-brand-muted mt-0.5">Academia-Industry Skill & Placement Platform</p>
            </div>

            <!-- Mode Selector -->
            <div class="flex rounded-lg bg-[#F1F5F9] p-1 border border-brand-border mb-6">
              <button 
                type="button" 
                @click="isRegistering = false"
                class="flex-1 py-1.5 text-xs font-mono rounded-md transition-all cursor-pointer"
                :class="!isRegistering ? 'bg-white text-brand-text font-medium shadow-sm' : 'text-brand-muted hover:text-brand-text'"
              >
                Sign In
              </button>
              <button 
                type="button" 
                @click="isRegistering = true"
                class="flex-1 py-1.5 text-xs font-mono rounded-md transition-all cursor-pointer"
                :class="isRegistering ? 'bg-white text-brand-text font-medium shadow-sm' : 'text-brand-muted hover:text-brand-text'"
              >
                Create Account
              </button>
            </div>

            <!-- Sign In Form -->
            <form v-if="!isRegistering" @submit.prevent="onLogin" class="space-y-4 text-left">
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Email address</label>
                <input 
                  v-model="loginForm.email" 
                  type="email" 
                  required 
                  placeholder="user@example.com"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] transition-colors"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Password</label>
                <input 
                  v-model="loginForm.password" 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] transition-colors"
                />
              </div>
              <button 
                type="submit" 
                :disabled="isLoading"
                class="w-full btn-primary py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span v-if="isLoading" class="spinner"></span>
                <span>{{ isLoading ? 'Signing in...' : 'Sign In →' }}</span>
              </button>
            </form>

            <!-- Registration Form -->
            <form v-else @submit.prevent="onRegister" class="space-y-3.5 text-left">
              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1.5">Account Role</label>
                <div class="grid grid-cols-3 gap-2">
                  <button 
                    type="button"
                    @click="registerForm.role = 'student'"
                    class="py-1.5 px-2 text-center rounded-lg border text-xs font-mono transition-all cursor-pointer"
                    :class="registerForm.role === 'student' ? 'border-[#581C87] bg-[#581C87] text-white font-medium shadow-xs' : 'border-brand-border bg-white text-brand-muted hover:border-gray-300'"
                  >
                    Student
                  </button>
                  <button 
                    type="button"
                    @click="registerForm.role = 'recruiter'"
                    class="py-1.5 px-2 text-center rounded-lg border text-xs font-mono transition-all cursor-pointer"
                    :class="registerForm.role === 'recruiter' ? 'border-[#581C87] bg-[#581C87] text-white font-medium shadow-xs' : 'border-brand-border bg-white text-brand-muted hover:border-gray-300'"
                  >
                    Recruiter
                  </button>
                  <button 
                    type="button"
                    @click="registerForm.role = 'faculty'"
                    class="py-1.5 px-2 text-center rounded-lg border text-xs font-mono transition-all cursor-pointer"
                    :class="registerForm.role === 'faculty' ? 'border-[#581C87] bg-[#581C87] text-white font-medium shadow-xs' : 'border-brand-border bg-white text-brand-muted hover:border-gray-300'"
                  >
                    Faculty
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Full Name</label>
                <input 
                  v-model="registerForm.name" 
                  type="text" 
                  required 
                  :placeholder="registerForm.role === 'student' ? 'Arjun Subramanian' : registerForm.role === 'recruiter' ? 'Kavita Nair' : 'Prof. S. Sudarshan'"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] transition-colors"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Email address</label>
                <input 
                  v-model="registerForm.email" 
                  type="email" 
                  required 
                  placeholder="user@example.com"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] transition-colors"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Password (min 6 characters)</label>
                <input 
                  v-model="registerForm.password" 
                  type="password" 
                  required 
                  minlength="6"
                  placeholder="••••••••"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] transition-colors"
                />
              </div>

              <div v-if="registerForm.role === 'student'">
                <label class="block text-xs font-medium text-brand-muted mb-1">Degree & Major</label>
                <input 
                  v-model="registerForm.degree" 
                  type="text" 
                  placeholder="B.Tech Computer Science, IIT Madras"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] transition-colors"
                />
              </div>

              <div v-else>
                <label class="block text-xs font-medium text-brand-muted mb-1">
                  {{ registerForm.role === 'recruiter' ? 'Company Name' : 'University / Department' }}
                </label>
                <input 
                  v-model="registerForm.institution_or_company" 
                  type="text" 
                  required
                  :placeholder="registerForm.role === 'recruiter' ? 'Tata Digital, Infosys, Flipkart' : 'IIT Bombay, IISc Bangalore'"
                  class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] transition-colors"
                />
              </div>

              <button 
                type="submit" 
                :disabled="isLoading"
                class="w-full btn-primary font-medium py-2.5 rounded-lg text-sm shadow-sm mt-3 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span v-if="isLoading" class="spinner"></span>
                <span>{{ isLoading ? 'Creating account...' : 'Create Account →' }}</span>
              </button>
            </form>
          </div>
        </div>

        <!-- Right Panel: Demo Accounts -->
        <div class="md:col-span-6 p-6 sm:p-8 bg-[#FAF8FC]/60 flex flex-col justify-between">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <!-- Role filter chips -->
              <div class="flex rounded-md bg-[#F1F5F9] p-0.5 border border-brand-border text-[11px] font-mono">
                <button 
                  type="button" 
                  @click="activeFilter = 'student'" 
                  class="px-2 py-0.5 rounded transition-all cursor-pointer"
                  :class="activeFilter === 'student' ? 'bg-white text-brand-text font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
                >Students ({{ studentCount }})</button>
                <button 
                  type="button" 
                  @click="activeFilter = 'faculty'" 
                  class="px-2 py-0.5 rounded transition-all cursor-pointer"
                  :class="activeFilter === 'faculty' ? 'bg-white text-brand-text font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
                >Faculty ({{ facultyCount }})</button>
                <button 
                  type="button" 
                  @click="activeFilter = 'recruiter'" 
                  class="px-2 py-0.5 rounded transition-all cursor-pointer"
                  :class="activeFilter === 'recruiter' ? 'bg-white text-brand-text font-medium shadow-2xs' : 'text-brand-muted hover:text-brand-text'"
                >Recruiters ({{ recruiterCount }})</button>
              </div>
            </div>

            <!-- Demo Accounts list -->
            <div v-if="isDemoLoading" class="py-12 flex flex-col items-center justify-center text-brand-muted gap-2 text-xs font-mono">
              <span class="spinner"></span>
              <span>Loading demo personas...</span>
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="acc in filteredAccounts"
                :key="acc.email"
                type="button"
                @click="useDemo(acc.email)"
                :disabled="isLoading"
                class="w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between gap-3 group cursor-pointer disabled:opacity-50"
                :class="acc.email === activeDemoEmail ? 'border-[#581C87] bg-purple-50' : 'border-brand-border bg-white hover:bg-brand-surface hover:border-[#DDD6FE]'"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-brand-text truncate">{{ acc.name }}</span>
                    <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-brand-surface text-brand-muted border border-brand-border/60 shrink-0">{{ acc.roleLabel }}</span>
                  </div>
                  <div class="text-[11px] font-mono text-brand-muted truncate mt-0.5">{{ acc.tag }} · {{ acc.email }}</div>
                </div>
                <div class="shrink-0 flex items-center font-mono text-xs text-brand-muted group-hover:text-[#581C87]">
                  <span v-if="activeDemoEmail === acc.email" class="spinner"></span>
                  <span v-else>→</span>
                </div>
              </button>
            </div>
          </div>

          <div class="pt-4 mt-4 border-t border-brand-border/70 flex items-center justify-between text-[11px] font-mono text-brand-muted">
            <span>SIH 26044 Platform</span>
            <span>Click any account to sign in</span>
          </div>
        </div>

      </div>
    </div>
  `
});
