import { ref, computed } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';

export default {
  name: 'AssessmentView',
  props: {
    assessments: {
      type: Array,
      default: () => []
    },
    student: {
      type: Object,
      default: () => ({})
    },
    studentAssessments: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['submit-suite-assessment'],
  setup(props, { emit }) {
    const searchQuery = ref('');
    const selectedRoleFilter = ref('all');
    const selectedDifficultyFilter = ref('all');

    // Active Test Runner State
    const activeSuite = ref(null);
    const currentQuestionIndex = ref(0);
    const userAnswers = ref({}); // { question_id: selected_option_index }
    const suiteResult = ref(null);
    const isSubmitting = ref(false);

    function getAttempt(suite) {
      if (!suite) return null;
      const list = (props.student && Array.isArray(props.student.assessments) && props.student.assessments.length > 0)
        ? props.student.assessments
        : (Array.isArray(props.studentAssessments) ? props.studentAssessments : []);
      
      const targetId = String(suite.assessment_id || '').toLowerCase();
      const targetCode = String(suite.code || '').toLowerCase();
      const targetTitle = String(suite.title || '').toLowerCase();

      return list.find(a => {
        const aId = String(a.assessment_id || '').toLowerCase();
        const aCode = String(a.code || '').toLowerCase();
        const aTitle = String(a.title || '').toLowerCase();

        return (aId && targetId && aId === targetId) ||
               (aCode && targetCode && aCode === targetCode) ||
               (aTitle && targetTitle && aTitle === targetTitle);
      }) || null;
    }

    const availableRoles = computed(() => {
      const roles = new Set();
      props.assessments.forEach(s => {
        if (s.target_role) roles.add(s.target_role);
      });
      return ['all', ...Array.from(roles)];
    });

    const filteredSuites = computed(() => {
      const q = searchQuery.value.trim().toLowerCase();
      const role = selectedRoleFilter.value.toLowerCase();
      const diff = selectedDifficultyFilter.value.toLowerCase();

      const matching = props.assessments.filter(s => {
        const matchesQuery = !q ||
          (s.title || '').toLowerCase().includes(q) ||
          (s.code || '').toLowerCase().includes(q) ||
          (s.institution || '').toLowerCase().includes(q) ||
          (s.target_role || '').toLowerCase().includes(q) ||
          (s.target_skills || []).some(sk => sk.toLowerCase().includes(q));

        const matchesRole = role === 'all' || (s.target_role || '').toLowerCase().includes(role);

        const curDiff = (s.difficulty || '').toLowerCase();
        const matchesDiff = diff === 'all' ||
          (diff === 'beginner' ? (curDiff === 'beginner' || curDiff === 'novice') : curDiff === diff);

        return matchesQuery && matchesRole && matchesDiff;
      });

      // Promote not-done assessments to the top, completed ones below
      return matching.slice().sort((a, b) => {
        const doneA = getAttempt(a) !== null;
        const doneB = getAttempt(b) !== null;
        if (doneA !== doneB) {
          return doneA ? 1 : -1; // Unattempted first
        }
        return 0;
      });
    });

    function startSuite(suite) {
      activeSuite.value = suite;
      currentQuestionIndex.value = 0;
      userAnswers.value = {};
      suiteResult.value = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function exitSuite() {
      if (suiteResult.value || confirm('Are you sure you want to exit? Your progress in this assessment will be discarded.')) {
        activeSuite.value = null;
        userAnswers.value = {};
        suiteResult.value = null;
      }
    }

    function selectOption(questionId, optionIndex) {
      if (suiteResult.value) return;
      userAnswers.value[questionId] = optionIndex;
    }

    function nextQuestion() {
      if (activeSuite.value && currentQuestionIndex.value < activeSuite.value.questions.length - 1) {
        currentQuestionIndex.value++;
      }
    }

    function prevQuestion() {
      if (currentQuestionIndex.value > 0) {
        currentQuestionIndex.value--;
      }
    }

    function jumpToQuestion(index) {
      currentQuestionIndex.value = index;
    }

    const answeredCount = computed(() => {
      return Object.keys(userAnswers.value).length;
    });

    const currentQuestion = computed(() => {
      if (!activeSuite.value || !activeSuite.value.questions) return null;
      return activeSuite.value.questions[currentQuestionIndex.value] || null;
    });

    async function submitAssessment() {
      if (!activeSuite.value) return;

      const totalQs = activeSuite.value.questions.length;
      const answered = Object.keys(userAnswers.value).length;

      if (answered < totalQs) {
        if (!confirm(`You have answered ${answered} of ${totalQs} questions. Do you still want to submit?`)) {
          return;
        }
      }

      isSubmitting.value = true;
      const answersPayload = activeSuite.value.questions.map(q => ({
        question_id: q.question_id,
        selected_option: userAnswers.value[q.question_id] !== undefined ? userAnswers.value[q.question_id] : -1
      }));

      try {
        emit('submit-suite-assessment', {
          assessment_id: activeSuite.value.assessment_id || activeSuite.value.code,
          answers: answersPayload,
          callback: (res) => {
            suiteResult.value = res;
            isSubmitting.value = false;
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      } catch (e) {
        alert('Submission error: ' + e.message);
        isSubmitting.value = false;
      }
    }

    function getDifficultyBadge(diff) {
      const d = (diff || '').toLowerCase();
      if (d === 'beginner' || d === 'novice') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      }
      if (d === 'advanced') {
        return 'bg-amber-50 text-amber-800 border-amber-200';
      }
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }

    return {
      searchQuery,
      selectedRoleFilter,
      selectedDifficultyFilter,
      availableRoles,
      filteredSuites,
      activeSuite,
      currentQuestionIndex,
      currentQuestion,
      userAnswers,
      answeredCount,
      suiteResult,
      isSubmitting,
      startSuite,
      exitSuite,
      selectOption,
      nextQuestion,
      prevQuestion,
      jumpToQuestion,
      submitAssessment,
      getDifficultyBadge,
      getAttempt,
      decodeHtml
    };
  },
  template: `
    <div class="space-y-6">
      
      <div v-if="activeSuite" class="space-y-6">
        <!-- Header and Breadcrumbs -->
        <div class="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-brand-border">
          <div class="flex items-center gap-3">
            <button @click="exitSuite" class="btn-secondary text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium">
              ← Exit Assessment
            </button>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs font-medium text-brand-text bg-white px-2 py-0.5 rounded border border-brand-border">
                  {{ activeSuite.code }}
                </span>
                <span class="text-xs text-brand-muted font-medium">{{ activeSuite.institution }}</span>
              </div>
              <h2 class="font-serif text-lg text-brand-text font-semibold mt-0.5">{{ decodeHtml(activeSuite.title) }}</h2>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-xs text-brand-muted font-medium">
              Progress: {{ answeredCount }} / {{ activeSuite.questions.length }} Answered
            </span>
            <span :class="getDifficultyBadge(activeSuite.difficulty)" class="text-xs px-2.5 py-0.5 rounded border font-mono">
              {{ activeSuite.difficulty }}
            </span>
          </div>
        </div>

        <!-- RESULT BANNER -->
        <div v-if="suiteResult" class="p-6 card border-brand-border bg-white space-y-4 shadow-sm">
          <div class="flex flex-wrap justify-between items-center gap-4">
            <div>
              <div class="text-xs font-mono text-brand-muted uppercase tracking-wider">Evaluation Score</div>
              <div class="font-serif text-3xl font-bold mt-1" :class="suiteResult.passed ? 'text-emerald-700' : 'text-rose-700'">
                {{ suiteResult.score_pct }}% — {{ suiteResult.passed ? 'Assessment Passed' : 'Needs Review' }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs text-brand-muted">Verified Portfolio Tier</div>
              <div class="text-sm font-semibold text-brand-text font-mono mt-0.5">
                {{ suiteResult.updated_tier }} Competency Calibrated
              </div>
            </div>
          </div>

          <p class="text-sm text-brand-text leading-relaxed">{{ suiteResult.feedback }}</p>

          <div class="flex justify-end gap-3 pt-2">
            <button @click="exitSuite" class="btn-primary text-sm px-5 py-2 rounded-lg font-medium shadow-sm">
              Back to Assessments Catalog
            </button>
          </div>
        </div>

        <!-- TEST RUNNER QUESTION CARD -->
        <div v-if="currentQuestion" class="card p-6 md:p-8 space-y-6 shadow-sm">
          <div class="flex justify-between items-center pb-4 border-b border-brand-border">
            <span class="font-mono text-xs font-medium text-brand-muted uppercase">
              Question {{ currentQuestionIndex + 1 }} of {{ activeSuite.questions.length }}
            </span>
            <span class="text-xs text-brand-muted font-medium">
              Role: {{ activeSuite.target_role }}
            </span>
          </div>

          <!-- Prompt -->
          <div>
            <p class="text-base text-brand-text font-medium leading-relaxed">
              {{ decodeHtml(currentQuestion.question_text) }}
            </p>
          </div>

          <!-- Multiple Choices -->
          <div class="space-y-3">
            <div 
              v-for="(opt, oIdx) in currentQuestion.options" 
              :key="oIdx"
              @click="selectOption(currentQuestion.question_id, oIdx)"
              :class="[
                userAnswers[currentQuestion.question_id] === oIdx ? 'border-[#581C87] bg-[#F5F3FF]/40 ring-1 ring-[#581C87]/30 shadow-2xs' : 'border-brand-border hover:bg-brand-surface/50',
                suiteResult ? (Number(currentQuestion.correct_option) === oIdx ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900' : '') : ''
              ]"
              class="p-4 rounded-xl border cursor-pointer text-sm transition-all flex items-start gap-3 bg-white"
            >
              <span class="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border border-brand-border flex items-center justify-center">
                <span v-if="userAnswers[currentQuestion.question_id] === oIdx" class="w-2 h-2 rounded-full bg-[#581C87]"></span>
              </span>
              <span class="text-brand-text font-medium leading-relaxed">{{ decodeHtml(opt) }}</span>
            </div>
          </div>

          <!-- Rationale if Graded -->
          <div v-if="suiteResult ? !!currentQuestion.explanation : false" class="p-3 bg-brand-surface rounded-lg border border-brand-border text-xs text-brand-muted">
            <span class="font-semibold text-brand-text">Rubric Rationale:</span> {{ currentQuestion.explanation }}
          </div>

          <!-- Question Index Navigator and Actions -->
          <div class="flex flex-wrap justify-between items-center gap-4 pt-6 border-t border-brand-border">
            <div class="flex items-center gap-2">
              <button 
                v-for="(_, qIdx) in activeSuite.questions" 
                :key="qIdx"
                @click="jumpToQuestion(qIdx)"
                :class="[
                  currentQuestionIndex === qIdx ? 'border-[#581C87] bg-[#581C87] text-white font-semibold' : (userAnswers[activeSuite.questions[qIdx].question_id] !== undefined ? 'bg-[#F5F3FF] text-[#581C87] font-medium border-[#DDD6FE]' : 'bg-white text-brand-muted border-brand-border hover:border-gray-400')
                ]"
                class="w-7 h-7 rounded-lg border text-xs flex items-center justify-center font-mono transition-colors"
              >
                {{ qIdx + 1 }}
              </button>
            </div>

            <div class="flex items-center gap-2">
              <button 
                @click="prevQuestion" 
                :disabled="currentQuestionIndex === 0" 
                class="btn-secondary text-xs px-3 py-2 rounded-lg disabled:opacity-40 font-medium"
              >
                Previous
              </button>
              
              <button 
                v-if="currentQuestionIndex < activeSuite.questions.length - 1"
                @click="nextQuestion" 
                class="btn-secondary text-xs px-4 py-2 rounded-lg font-medium"
              >
                Next →
              </button>

              <button 
                v-if="!suiteResult"
                @click="submitAssessment" 
                :disabled="isSubmitting"
                class="btn-primary text-xs px-5 py-2 rounded-lg font-medium shadow-sm"
              >
                <span v-if="isSubmitting"><span class="spinner mr-1"></span> Evaluating...</span>
                <span v-else>Submit Assessment</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <header class="mb-6">
          <h1 class="font-serif text-3xl text-brand-text mb-2">Role-Based Technical Assessments</h1>
          <p class="text-brand-muted text-sm">Standardized, multi-question evaluations curated by leading university departments for specific industry engineering tracks.</p>
        </header>

        <!-- Search and Categorization Filters -->
        <div class="space-y-3 mb-6">
          <div class="flex gap-3">
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="Search by role, assessment title, institution (e.g. MIT, Cloud, TypeScript)..." 
              class="w-full max-w-lg bg-white border border-brand-border text-brand-text px-4 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]"
            />
          </div>

          <!-- Filter Pills: Target Roles
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <span class="text-xs text-brand-muted font-medium mr-1">Target Role:</span>
            <button 
              v-for="role in availableRoles" 
              :key="role"
              @click="selectedRoleFilter = role"
              :class="selectedRoleFilter === role ? 'bg-white text-[#581C87] border-[#DDD6FE] bg-[#F5F3FF] font-medium shadow-2xs' : 'bg-white text-brand-muted hover:text-brand-text border-brand-border'"
              class="text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize"
            >
              {{ role === 'all' ? 'All Industry Roles' : role }}
            </button>
          </div>
           -->

          <!-- Filter Pills: Difficulty -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-brand-muted font-medium mr-1">Difficulty:</span>
            <button 
              v-for="diff in ['all', 'Beginner', 'Intermediate', 'Advanced']" 
              :key="diff"
              @click="selectedDifficultyFilter = diff"
              :class="selectedDifficultyFilter.toLowerCase() === diff.toLowerCase() ? 'bg-white text-[#581C87] border-[#DDD6FE] bg-[#F5F3FF] font-medium shadow-2xs' : 'bg-white text-brand-muted hover:text-brand-text border-brand-border'"
              class="text-xs px-3 py-1.5 rounded-lg border transition-colors"
            >
              {{ diff === 'all' ? 'All Tiers' : diff }}
            </button>
          </div>
        </div>

        <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
          <span class="spinner mr-2"></span> Loading role assessments...
        </div>

        <div v-else-if="filteredSuites.length === 0" class="card p-12 text-center text-brand-muted text-sm">
          <div class="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-4 border border-brand-border text-brand-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="font-serif text-lg text-brand-text mb-2">No assessments match criteria</div>
          <p class="max-w-sm mx-auto leading-relaxed">Try selecting "All Industry Roles" or clear your keyword search.</p>
        </div>

        <!-- Assessment Suite Cards List -->
        <div v-else class="space-y-4">
          <div 
            v-for="suite in filteredSuites" 
            :key="suite.assessment_id || suite.code"
            class="card p-6 transition-colors hover:border-[#DDD6FE] space-y-4 shadow-sm"
          >
            <div class="flex flex-wrap justify-between items-start gap-4">
              <div class="space-y-1">
                <!-- Institution and Code Tag -->
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs font-medium text-brand-text bg-brand-surface px-2 py-0.5 rounded border border-brand-border">
                    {{ suite.code }}
                  </span>
                  <span class="text-xs font-medium text-brand-muted flex items-center gap-1">
                    <span>🏛️</span> {{ suite.institution }}
                  </span>
                </div>

                <h3 class="font-serif text-xl text-brand-text font-semibold">{{ decodeHtml(suite.title) }}</h3>
                
                <div class="flex flex-wrap items-center gap-2 text-xs text-brand-muted pt-0.5">
                  <span class="bg-brand-surface text-brand-text font-medium px-2 py-0.5 rounded border border-brand-border">
                    Role: {{ suite.target_role }}
                  </span>
                  <span>• {{ (suite.questions || []).length }} Questions</span>
                  <span>• {{ suite.duration_minutes || 30 }} Minutes</span>
                </div>
              </div>

              <div class="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 self-start">
                <!-- Current Score Badge for Completed Assessments -->
                <div v-if="getAttempt(suite)" class="flex items-center gap-1.5">
                  <span 
                    :class="getAttempt(suite).passed ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'"
                    class="text-xs px-2.5 py-1 rounded-lg font-mono font-medium border flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>{{ getAttempt(suite).passed ? '✓' : '⚠️' }}</span>
                    <span>Score: {{ getAttempt(suite).score_pct }}%</span>
                    <span class="opacity-75 text-[11px]">({{ getAttempt(suite).passed ? 'Passed' : 'Needs Review' }})</span>
                  </span>
                </div>

                <span :class="getDifficultyBadge(suite.difficulty)" class="text-xs px-2.5 py-1 rounded-lg font-mono font-medium border">
                  {{ suite.difficulty }}
                </span>

                <!-- Action Button: Retake vs Take Assessment -->
                <button 
                  v-if="getAttempt(suite)"
                  @click="startSuite(suite)"
                  class="btn-secondary text-xs px-4 py-2 rounded-lg font-medium shadow-2xs text-[#581C87] border-[#DDD6FE] hover:bg-[#F5F3FF] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>🔄 Retake Assessment</span>
                </button>
                <button 
                  v-else
                  @click="startSuite(suite)"
                  class="btn-primary text-xs px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>Take Assessment →</span>
                </button>
              </div>
            </div>

            <p class="text-sm text-brand-muted leading-relaxed max-w-3xl">{{ decodeHtml(suite.description) }}</p>

            <div class="flex flex-wrap gap-1.5 pt-3 border-t border-brand-border text-xs">
              <span class="text-brand-muted font-medium mr-1 self-center">Evaluated Skills:</span>
              <span 
                v-for="sk in suite.target_skills" 
                :key="sk" 
                class="bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-brand-text font-mono text-[11px]"
              >
                {{ sk }}
              </span>
            </div>
          </div>
        </div>
      </template>

    </div>
  `
};
