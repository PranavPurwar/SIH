import { ref, reactive, defineComponent } from '../../vue.js';
import type { PropType } from '../../vue.js';
import { decodeHtml } from '../../utils/formatters.js';
import type { AssessmentSuite, AssessmentQuestion, AuthUser } from '../../types/index.js';

export interface FacultyQuestionForm {
  question_id?: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: number;
  explanation: string;
}

export interface FacultyAssessmentsViewProps {
  facultyUser?: AuthUser | null;
  assessments: AssessmentSuite[];
  loading?: boolean;
}

export default defineComponent({
  name: 'FacultyAssessmentsView',
  props: {
    facultyUser: {
      type: Object as PropType<AuthUser | null>,
      default: null
    },
    assessments: {
      type: Array as PropType<AssessmentSuite[]>,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['create-assessment', 'update-assessment', 'refresh-assessments'],
  setup(props, { emit }) {
    const showModal = ref<boolean>(false);
    const isEditing = ref<boolean>(false);
    const editingId = ref<string | null>(null);
    const expandedSuiteId = ref<string | null>(null);

    const form = reactive<{
      code: string;
      title: string;
      institution: string;
      target_role: string;
      target_skills: string;
      difficulty: string;
      duration_minutes: number;
      description: string;
      questions: FacultyQuestionForm[];
    }>({
      code: '',
      title: '',
      institution: '',
      target_role: '',
      target_skills: '',
      difficulty: 'Intermediate',
      duration_minutes: 30,
      description: '',
      questions: []
    });

    function normalizeInstitution(name?: string): string {
      return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function canEditSuite(suite: AssessmentSuite): boolean {
      const userInst = props.facultyUser?.institution_or_company;
      if (!userInst || !suite.institution) return false;
      const u = normalizeInstitution(userInst);
      const s = normalizeInstitution(suite.institution);
      return u === s || u.includes(s) || s.includes(u);
    }

    function toggleExpand(id: string) {
      expandedSuiteId.value = expandedSuiteId.value === id ? null : id;
    }

    function openCreateModal() {
      isEditing.value = false;
      editingId.value = null;
      const userInst = props.facultyUser?.institution_or_company || '';
      const initials = userInst ? userInst.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 5) : 'EVAL';
      form.code = `${initials}-${Math.floor(100 + Math.random() * 899)}`;
      form.title = '';
      form.institution = userInst;
      form.target_role = '';
      form.target_skills = '';
      form.difficulty = 'Intermediate';
      form.duration_minutes = 45;
      form.description = '';
      form.questions = [
        {
          question_text: '',
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_option: 0,
          explanation: ''
        }
      ];
      showModal.value = true;
    }

    function openEditModal(suite: AssessmentSuite) {
      if (!canEditSuite(suite)) return;
      isEditing.value = true;
      editingId.value = suite.assessment_id || suite.code;
      form.code = suite.code || '';
      form.title = suite.title || '';
      form.institution = suite.institution || '';
      form.target_role = suite.target_role || '';
      form.target_skills = (suite.target_skills || []).join(', ');
      form.difficulty = suite.difficulty === 'Novice' ? 'Beginner' : (suite.difficulty || 'Intermediate');
      form.duration_minutes = suite.duration_minutes || 30;
      form.description = suite.description || '';
      
      const qList: FacultyQuestionForm[] = (suite.questions || []).map((q: AssessmentQuestion) => ({
        question_id: q.question_id,
        question_text: q.question_text || '',
        option_a: q.options?.[0] || '',
        option_b: q.options?.[1] || '',
        option_c: q.options?.[2] || '',
        option_d: q.options?.[3] || '',
        correct_option: q.correct_option !== undefined ? Number(q.correct_option) : 0,
        explanation: q.explanation || ''
      }));

      form.questions = qList.length > 0 ? qList : [
        {
          question_text: '',
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_option: 0,
          explanation: ''
        }
      ];

      showModal.value = true;
    }

    function closeModal() {
      showModal.value = false;
    }

    function addQuestion() {
      form.questions.push({
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 0,
        explanation: ''
      });
    }

    function removeQuestion(index: number) {
      if (form.questions.length > 1) {
        form.questions.splice(index, 1);
      }
    }

    function onSubmit() {
      const formattedQuestions: AssessmentQuestion[] = form.questions.map((q: FacultyQuestionForm, idx: number) => {
        const options = [q.option_a, q.option_b, q.option_c, q.option_d]
          .map(o => (o || '').trim())
          .filter(Boolean);

        return {
          question_id: q.question_id || `q-${idx + 1}`,
          question_text: q.question_text.trim(),
          options,
          correct_option: Number(q.correct_option) || 0,
          difficulty: form.difficulty,
          explanation: q.explanation || 'Verified by institutional evaluation.'
        };
      });

      const invalidQ = formattedQuestions.find(q => !q.question_text || q.options.length < 2);
      if (invalidQ) {
        alert('Each question must have text and at least 2 options.');
        return;
      }

      const payload = {
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        institution: form.institution.trim(),
        target_role: form.target_role.trim(),
        target_skills: form.target_skills.split(',').map(s => s.trim()).filter(Boolean),
        difficulty: form.difficulty,
        duration_minutes: Number(form.duration_minutes) || 30,
        description: form.description.trim(),
        questions: formattedQuestions
      };

      if (isEditing.value && editingId.value) {
        emit('update-assessment', {
          id: editingId.value,
          data: payload
        });
      } else {
        emit('create-assessment', payload);
      }

      showModal.value = false;
    }

    return {
      showModal,
      isEditing,
      editingId,
      expandedSuiteId,
      form,
      canEditSuite,
      toggleExpand,
      openCreateModal,
      openEditModal,
      closeModal,
      addQuestion,
      removeQuestion,
      onSubmit,
      decodeHtml
    };
  },
  template: `
    <div class="space-y-6">
      <header class="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 class="font-serif text-3xl text-brand-text mb-2">Institutional Assessment Suites</h1>
          <p class="text-brand-muted text-sm">Create, calibrate, and edit comprehensive multi-item evaluations tailored for specific industry roles.</p>
        </div>
        <button @click="openCreateModal" class="btn-primary text-sm px-4 py-2 rounded-lg font-medium shadow-sm">
          + Create Assessment Suite
        </button>
      </header>

      <div v-if="loading" class="text-center py-16 text-sm text-brand-muted">
        <span class="spinner mr-2"></span> Loading assessment suites...
      </div>

      <div v-else-if="assessments.length === 0" class="card p-12 text-center text-brand-muted text-sm">
        <div class="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-4 border border-brand-border text-brand-muted">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>
        </div>
        <div class="font-serif text-lg text-brand-text mb-2">No assessment suites defined</div>
        <p class="max-w-sm mx-auto leading-relaxed">Create structured role evaluations containing multiple technical items to verify candidate competency.</p>
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="suite in assessments" 
          :key="suite.assessment_id || suite.code" 
          class="card p-6 transition-colors hover:border-[#DDD6FE] space-y-4 shadow-sm"
        >
          <div class="flex flex-wrap justify-between items-start gap-3">
            <div>
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="font-mono text-xs font-medium text-brand-text bg-brand-surface px-2 py-0.5 rounded border border-brand-border">
                  {{ suite.code }}
                </span>
                <span class="text-xs font-medium text-brand-muted">
                  {{ suite.institution }}
                </span>
                <span v-if="canEditSuite(suite)" class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                  Your Institution
                </span>
              </div>
              <h2 
                @click="toggleExpand(suite.assessment_id || suite.code)"
                class="font-serif text-xl text-brand-text font-semibold hover:text-[#581C87] hover:underline cursor-pointer transition-colors"
                title="Click to inspect assessment questions & items"
              >
                {{ decodeHtml(suite.title) }}
              </h2>
              <div class="text-xs text-brand-muted mt-1 flex items-center gap-2">
                <span class="font-medium text-brand-text">Role: {{ suite.target_role }}</span>
                <span>• {{ (suite.questions || []).length }} Questions</span>
                <span>• {{ suite.duration_minutes || 30 }} Mins</span>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <span 
                class="text-xs border px-2.5 py-1 rounded font-mono font-medium"
                :class="suite.difficulty === 'Advanced' ? 'bg-amber-50 text-amber-800 border-amber-200' : suite.difficulty === 'Beginner' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'"
              >
                {{ suite.difficulty || 'Intermediate' }}
              </span>

              <!-- Edit button only for own institution -->
              <button 
                v-if="canEditSuite(suite)"
                @click="openEditModal(suite)"
                class="btn-secondary text-xs px-3 py-1 rounded-lg font-medium flex items-center gap-1 hover:border-[#581C87] text-[#581C87]"
                title="Edit Institutional Assessment Suite"
              >
                <svg class="w-3 h-3 text-[#581C87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                </svg>
                <span>Edit</span>
              </button>

              <!-- Read-only badge for external consortium benchmarks -->
              <span 
                v-else
                class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 font-mono flex items-center gap-1.5"
                title="This assessment suite is authored by an external consortium institution and is read-only for your account."
              >
                <svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <span>Consortium Benchmark (Read-Only)</span>
              </span>

              <button 
                @click="toggleExpand(suite.assessment_id || suite.code)"
                class="btn-secondary text-xs px-3 py-1 rounded-lg font-medium"
              >
                {{ expandedSuiteId === (suite.assessment_id || suite.code) ? 'Hide Items' : 'View Items' }}
              </button>
            </div>
          </div>

          <p class="text-sm text-brand-muted leading-relaxed max-w-3xl">{{ decodeHtml(suite.description) }}</p>

          <div class="flex flex-wrap gap-1.5 pt-2 border-t border-brand-border text-xs">
            <span class="text-brand-muted font-medium mr-1 self-center">Target Skills:</span>
            <span v-for="sk in suite.target_skills" :key="sk" class="bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-brand-text font-mono text-[11px]">
              {{ sk }}
            </span>
          </div>

          <!-- Expandable Questions List -->
          <div v-if="expandedSuiteId === (suite.assessment_id || suite.code)" class="pt-4 border-t border-brand-border space-y-3">
            <div class="text-xs font-semibold text-brand-text uppercase tracking-wider">Evaluation Items in Suite:</div>
            <div 
              v-for="(q, qIdx) in (suite.questions || [])" 
              :key="q.question_id || qIdx"
              class="p-4 rounded-xl bg-brand-surface/60 border border-brand-border text-xs space-y-2"
            >
              <div class="flex justify-between items-start font-medium text-brand-text">
                <span>{{ qIdx + 1 }}. {{ decodeHtml(q.question_text) }}</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <div 
                  v-for="(opt, optIdx) in q.options" 
                  :key="optIdx"
                  :class="Number(q.correct_option) === optIdx ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium' : 'bg-white border-brand-border text-brand-muted'"
                  class="p-2.5 rounded-lg border flex items-center justify-between"
                >
                  <span>{{ decodeHtml(opt) }}</span>
                  <span v-if="Number(q.correct_option) === optIdx" class="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-semibold">
                    Correct
                  </span>
                </div>
              </div>
              <div v-if="q.explanation" class="text-[11px] text-brand-muted mt-1 italic">
                Rationale: {{ q.explanation }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Assessment Suite Modal -->
      <div v-if="showModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 1rem;">
        <div class="card w-full max-w-2xl p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center">
            <div>
              <h2 class="font-serif text-2xl text-brand-text">{{ isEditing ? 'Edit Role Assessment Suite' : 'Create Role Assessment Suite' }}</h2>
              <p class="text-xs text-brand-muted">{{ isEditing ? 'Update questions, rubric, skills, and configuration for this evaluation.' : 'Bundle multiple technical verification items into a standardized institutional evaluation.' }}</p>
            </div>
            <button @click="closeModal" class="text-brand-muted hover:text-brand-text text-xl">✕</button>
          </div>

          <form @submit.prevent="onSubmit" class="space-y-5">
            <!-- Suite Metadata -->
            <div class="space-y-3 p-4 rounded-xl bg-brand-surface border border-brand-border">
              <div class="font-serif text-sm font-semibold text-brand-text">Assessment Configuration</div>
              
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="sm:col-span-2">
                  <label class="block text-xs font-medium text-brand-muted mb-1">Assessment Title</label>
                  <input v-model="form.title" required placeholder="e.g. Clinical Pharmacognosy & Standardization Assessment" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-brand-muted mb-1">Code</label>
                  <input v-model="form.code" required placeholder="e.g. AIIA-AYUR-501 or EVAL-101" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none font-mono uppercase focus:border-[#581C87]" />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-brand-muted mb-1">Evaluating Institution</label>
                  <input v-model="form.institution" required placeholder="e.g. IIT Bombay, IISc Bangalore, AIIMS Delhi" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-brand-muted mb-1">Target Industry Role</label>
                  <input v-model="form.target_role" required placeholder="e.g. Distributed Systems Engineer, Research Scientist" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-brand-muted mb-1">Target Skills (comma-separated)</label>
                  <input v-model="form.target_skills" required placeholder="Dravyaguna, HPLC, Clinical Protocols, Phytochemistry" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-medium text-brand-muted mb-1">Difficulty</label>
                    <select v-model="form.difficulty" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]">
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-brand-muted mb-1">Duration (Min)</label>
                    <input v-model.number="form.duration_minutes" type="number" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]" />
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-brand-muted mb-1">Description and Focus Areas</label>
                <textarea v-model="form.description" rows="2" required placeholder="State assessment purpose, target candidate pool, and key evaluation criteria..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-[#581C87]"></textarea>
              </div>
            </div>

            <!-- Questions Editor List -->
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="font-serif text-sm font-semibold text-brand-text">
                  Questions in Suite ({{ form.questions.length }})
                </span>
                <button type="button" @click="addQuestion" class="btn-secondary text-xs px-3 py-1.5 rounded-lg font-medium">
                  + Add Question Item
                </button>
              </div>

              <div 
                v-for="(q, qIndex) in form.questions" 
                :key="qIndex" 
                class="p-4 rounded-xl bg-white border border-brand-border space-y-3 relative shadow-2xs"
              >
                <div class="flex justify-between items-center">
                  <span class="font-mono text-xs font-medium text-brand-text">Question {{ qIndex + 1 }}</span>
                  <button 
                    type="button" 
                    v-if="form.questions.length > 1" 
                    @click="removeQuestion(qIndex)" 
                    class="text-rose-600 hover:underline text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>

                <div>
                  <label class="block text-xs font-medium text-brand-muted mb-1">Question Prompt</label>
                  <textarea v-model="q.question_text" rows="2" required placeholder="Enter technical question or architectural scenario..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-xs outline-none focus:border-[#581C87]"></textarea>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input v-model="q.option_a" required placeholder="Option A" class="bg-white border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#581C87]" />
                  <input v-model="q.option_b" required placeholder="Option B" class="bg-white border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#581C87]" />
                  <input v-model="q.option_c" placeholder="Option C (optional)" class="bg-white border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#581C87]" />
                  <input v-model="q.option_d" placeholder="Option D (optional)" class="bg-white border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#581C87]" />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-brand-muted mb-1">Correct Answer</label>
                    <select v-model.number="q.correct_option" class="w-full bg-white border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#581C87]">
                      <option :value="0">Option A</option>
                      <option :value="1">Option B</option>
                      <option :value="2">Option C</option>
                      <option :value="3">Option D</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-brand-muted mb-1">Explanation / Solution Rubric</label>
                    <input v-model="q.explanation" placeholder="e.g. Raft Section 5.4.1 safety invariant" class="w-full bg-white border border-brand-border text-brand-text px-3 py-1.5 rounded-lg text-xs outline-none focus:border-[#581C87]" />
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-brand-border">
              <button type="button" @click="closeModal" class="btn-secondary px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button type="submit" class="btn-primary px-5 py-2 rounded-lg text-sm font-medium shadow-sm">
                {{ isEditing ? 'Save Changes' : 'Publish Assessment Suite' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
});
