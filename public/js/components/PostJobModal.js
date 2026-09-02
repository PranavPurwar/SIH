import { reactive } from '../vue.js';

export default {
  name: 'PostJobModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    defaultCompany: {
      type: String,
      default: 'Enterprise Systems'
    }
  },
  emits: ['close', 'submit-job'],
  setup(props, { emit }) {
    const newJob = reactive({
      title: '',
      description: '',
      company: props.defaultCompany,
      stipend: '',
      eligibility: 'Graduates & Final Year',
      required_skills: ''
    });

    function onSubmit() {
      emit('submit-job', {
        title: newJob.title,
        description: newJob.description,
        company: props.defaultCompany,
        stipend: newJob.stipend || 'Competitive',
        eligibility: newJob.eligibility || 'Graduates & Final Year',
        required_skills: newJob.required_skills
      });
      newJob.title = '';
      newJob.description = '';
      newJob.required_skills = '';
      newJob.stipend = '';
    }

    return {
      newJob,
      onSubmit
    };
  },
  template: `
    <div v-if="isOpen" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); padding: 1rem;">
      <div class="card w-full max-w-lg p-6 space-y-6 shadow-2xl">
        <div class="flex justify-between items-center">
          <h2 class="font-serif text-2xl text-brand-text">Post New Requisition</h2>
          <button @click="$emit('close')" class="text-brand-muted hover:text-brand-text text-lg">✕</button>
        </div>
        <form @submit.prevent="onSubmit" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-brand-muted mb-1">Job Title</label>
            <input v-model="newJob.title" required placeholder="e.g. Senior Distributed Systems Engineer" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Company</label>
              <input :value="defaultCompany" disabled class="w-full bg-brand-surface border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none opacity-70" />
            </div>
            <div>
              <label class="block text-xs font-medium text-brand-muted mb-1">Compensation / Stipend</label>
              <input v-model="newJob.stipend" placeholder="e.g. ₹28,00,000 / yr" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-brand-muted mb-1">Required Skills (comma separated)</label>
            <input v-model="newJob.required_skills" required placeholder="e.g. Go, Kubernetes, Kafka, Distributed Systems" class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach" />
          </div>
          <div>
            <label class="block text-xs font-medium text-brand-muted mb-1">Description</label>
            <textarea v-model="newJob.description" rows="3" required placeholder="Describe core responsibilities and technical context..." class="w-full bg-white border border-brand-border text-brand-text px-3 py-2 rounded-lg text-sm outline-none focus:border-anthropic-peach"></textarea>
          </div>
          <div class="flex justify-end gap-3 pt-4 border-t border-brand-border">
            <button type="button" @click="$emit('close')" class="btn-secondary px-4 py-2 rounded-lg text-sm">Cancel</button>
            <button type="submit" class="btn-primary px-4 py-2 rounded-lg text-sm font-medium">Post Role</button>
          </div>
        </form>
      </div>
    </div>
  `
};

