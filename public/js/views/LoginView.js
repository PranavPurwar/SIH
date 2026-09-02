import { reactive, ref } from '../vue.js';

export default {
  name: 'LoginView',
  emits: ['login', 'register'],
  setup(_props, { emit }) {
    const isRegistering = ref(false);
    const isLoading = ref(false);

    const loginForm = reactive({
      email: '',
      password: ''
    });

    const registerForm = reactive({
      name: '',
      email: '',
      password: '',
      role: 'student',
      institution_or_company: '',
      degree: ''
    });

    function onLogin() {
      isLoading.value = true;
      emit('login', { ...loginForm, onComplete: () => { isLoading.value = false; } });
    }

    function onRegister() {
      isLoading.value = true;
      emit('register', { ...registerForm, onComplete: () => { isLoading.value = false; } });
    }

    function useDemo(email) {
      loginForm.email = email;
      loginForm.password = 'password';
      isLoading.value = true;
      emit('login', { email, password: 'password', onComplete: () => { isLoading.value = false; } });
    }

    return {
      isRegistering,
      isLoading,
      loginForm,
      registerForm,
      onLogin,
      onRegister,
      useDemo
    };
  },
  template: `
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="max-w-md w-full card p-8 text-center space-y-6 shadow-sm">
        <div>
          <div class="font-serif text-3xl text-brand-text mb-1 tracking-tight">SkillBridge</div>
          <p class="text-sm text-brand-muted">Academia-Industry Skill & Placement Platform</p>
        </div>

        <!-- Mode Selector -->
        <div class="flex rounded-lg bg-[#F1F5F9] p-1 border border-brand-border">
          <button 
            type="button" 
            @click="isRegistering = false"
            class="flex-1 py-1.5 text-xs font-mono rounded-md transition-all"
            :class="!isRegistering ? 'bg-white text-brand-text font-medium shadow-sm' : 'text-brand-muted hover:text-brand-text'"
          >
            Sign In
          </button>
          <button 
            type="button" 
            @click="isRegistering = true"
            class="flex-1 py-1.5 text-xs font-mono rounded-md transition-all"
            :class="isRegistering ? 'bg-white text-brand-text font-medium shadow-sm' : 'text-brand-muted hover:text-brand-text'"
          >
            Create Account
          </button>
        </div>

        <!-- Login Form -->
        <form v-if="!isRegistering" @submit.prevent="onLogin" class="space-y-4 text-left">
          <div>
            <label class="block text-xs font-medium text-brand-muted mb-1">Email address</label>
            <input 
              v-model="loginForm.email" 
              type="email" 
              required 
              placeholder="student@example.com"
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
          <button type="submit" class="w-full btn-primary py-2.5 rounded-lg text-sm font-medium">
            Sign In →
          </button>
        </form>

        <!-- Registration Form -->
        <form v-else @submit.prevent="onRegister" class="space-y-4 text-left">
          <!-- Role Selector -->
          <div>
            <label class="block text-xs font-medium text-brand-muted mb-1.5">Account Role</label>
            <div class="grid grid-cols-3 gap-2">
              <button 
                type="button"
                @click="registerForm.role = 'student'"
                class="py-2 px-2 text-center rounded-lg border text-xs font-mono transition-all"
                :class="registerForm.role === 'student' ? 'border-[#581C87] bg-[#581C87] text-white font-medium shadow-xs' : 'border-brand-border bg-white text-brand-muted hover:border-gray-300'"
              >
                Student
              </button>
              <button 
                type="button"
                @click="registerForm.role = 'recruiter'"
                class="py-2 px-2 text-center rounded-lg border text-xs font-mono transition-all"
                :class="registerForm.role === 'recruiter' ? 'border-[#581C87] bg-[#581C87] text-white font-medium shadow-xs' : 'border-brand-border bg-white text-brand-muted hover:border-gray-300'"
              >
                Recruiter
              </button>
              <button 
                type="button"
                @click="registerForm.role = 'faculty'"
                class="py-2 px-2 text-center rounded-lg border text-xs font-mono transition-all"
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
              :placeholder="registerForm.role === 'student' ? 'Pranav Purwar' : registerForm.role === 'recruiter' ? 'Tech Talent Lead' : 'Prof. Gerald Sussman'"
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
              placeholder="B.Tech in Computer Science, IIT Delhi"
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
              :placeholder="registerForm.role === 'recruiter' ? 'Stripe, DeepMind, Linear' : 'MIT EECS Department, Stanford University'"
              class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87] transition-colors"
            />
          </div>

          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full btn-primary font-medium py-2.5 rounded-lg text-sm shadow-sm mt-3 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span v-if="isLoading" class="spinner"></span>
            <span>{{ isLoading ? 'Creating account...' : 'Create Account' }}</span>
          </button>
        </form>

        <!-- Quick Demo Switcher -->
        <div class="mt-6 pt-6 border-t border-brand-border text-left">
          <p class="text-xs font-medium text-brand-muted mb-3">Quick Demo Accounts (Password: 'password'):</p>
          <div class="space-y-2">
            <button type="button" @click="useDemo('torvalds@linux-foundation.org')" class="w-full text-left text-xs px-3 py-2 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] hover:bg-[#EDE9FE] transition-colors flex justify-between items-center">
              <span class="font-medium text-[#581C87]">★ Linus Torvalds (Linux & Git Author)</span>
              <span class="text-brand-muted font-mono">torvalds@linux-foundation.org</span>
            </button>
            <button type="button" @click="useDemo('showcase@example.com')" class="w-full text-left text-xs px-3 py-2 rounded-lg border border-brand-border hover:bg-brand-surface transition-colors flex justify-between items-center">
              <span class="font-medium text-brand-text">Devina Sengupta (Showcase IIT-B CS/AI)</span>
              <span class="text-brand-muted font-mono">showcase@example.com</span>
            </button>
            <button type="button" @click="useDemo('student@example.com')" class="w-full text-left text-xs px-3 py-2 rounded-lg border border-brand-border hover:bg-brand-surface transition-colors flex justify-between items-center">
              <span class="font-medium text-brand-text">Candidate (Pranav Purwar)</span>
              <span class="text-brand-muted font-mono">student@example.com</span>
            </button>
            <button type="button" @click="useDemo('recruiter@example.com')" class="w-full text-left text-xs px-3 py-2 rounded-lg border border-brand-border hover:bg-brand-surface transition-colors flex justify-between items-center">
              <span class="font-medium text-brand-text">Recruiter (Enterprise Lead)</span>
              <span class="text-brand-muted font-mono">recruiter@example.com</span>
            </button>
            <button type="button" @click="useDemo('mit@skills.com')" class="w-full text-left text-xs px-3 py-2 rounded-lg border border-brand-border hover:bg-brand-surface transition-colors flex justify-between items-center">
              <span class="font-medium text-brand-text">MIT Courseware Admin</span>
              <span class="text-brand-muted font-mono">mit@skills.com</span>
            </button>
            <button type="button" @click="useDemo('faculty@mit.edu')" class="w-full text-left text-xs px-3 py-2 rounded-lg border border-brand-border hover:bg-brand-surface transition-colors flex justify-between items-center">
              <span class="font-medium text-brand-text">MIT Faculty (Prof. Sussman)</span>
              <span class="text-brand-muted font-mono">faculty@mit.edu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
};
