import { ref, computed, watch, type Ref } from '../vue.js';
import type { AuthUser, NavTab } from '../types/index.js';

export function useNavigation(authUser: Ref<AuthUser | null>, isAuthenticated: Ref<boolean>) {
  const initialRole = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}')?.role : null;
  const activeTab = ref<string>(initialRole === 'faculty' ? 'faculty-programs' : (initialRole === 'recruiter' ? 'jobs' : 'jobs'));
  const publicCandidateId = ref<string | null>(null);

  const primaryNavTabs = computed<NavTab[]>(() => {
    const role = authUser.value?.role || 'student';
    if (role === 'recruiter') {
      return [
        { id: 'jobs', name: 'Job Postings' },
        { id: 'applications', name: 'Candidates Pipeline' },
        { id: 'profile', name: 'Company Profile' }
      ];
    } else if (role === 'faculty') {
      return [
        { id: 'faculty-programs', name: 'Opportunities & Grants' },
        { id: 'analytics', name: 'Institutional Profile & Analytics' },
        { id: 'mentorship', name: 'Mentorship & Programs' }
      ];
    }
    return [
      { id: 'jobs', name: 'Positions' },
      { id: 'applications', name: 'Applications' },
      { id: 'mentorship', name: 'Mentorship & Programs' },
      { id: 'courses', name: 'Courseware' },
      { id: 'quiz', name: 'Assessments' },
      { id: 'profile', name: 'Profile' }
    ];
  });

  watch(authUser, (newUser) => {
    if (!newUser) {
      activeTab.value = 'jobs';
      return;
    }
    const validTabIds = primaryNavTabs.value.map(t => t.id);
    if (!validTabIds.includes(activeTab.value)) {
      activeTab.value = validTabIds[0] || (newUser.role === 'faculty' ? 'faculty-programs' : 'jobs');
    }
  });

  function checkRoute() {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path.startsWith('/candidate/') || path.startsWith('/student/')) {
      const parts = path.split('/');
      if (parts[2]) {
        publicCandidateId.value = parts[2];
      }
    } else if (path === '/jobs') {
      activeTab.value = 'jobs';
    } else if (path === '/courses') {
      activeTab.value = 'courses';
    } else if (path === '/assessments' || path === '/quiz') {
      activeTab.value = 'quiz';
    } else if (path === '/profile' || path === '/faculty-profile') {
      activeTab.value = authUser.value?.role === 'faculty' ? 'faculty-profile' : 'profile';
    } else if (path === '/faculty' || path === '/faculty-programs') {
      activeTab.value = 'faculty-programs';
    } else if (path === '/analytics') {
      activeTab.value = 'analytics';
    } else if (path === '/mentorship') {
      activeTab.value = 'mentorship';
    } else if (path === '/recruiter') {
      activeTab.value = 'applications';
    }
  }

  function setTab(tabId: string) {
    activeTab.value = tabId;
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({}, '', `/${tabId === 'quiz' ? 'assessments' : tabId}`);
    }
  }

  function viewCandidatePublic(candId: string) {
    publicCandidateId.value = candId;
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({}, '', `/candidate/${candId}`);
    }
  }

  function closePublicCandidate() {
    publicCandidateId.value = null;
    const role = authUser.value?.role;
    if (role === 'recruiter') {
      activeTab.value = 'applications';
    }
    const targetRoute = role === 'recruiter' ? '/recruiter' : (activeTab.value === 'quiz' ? '/assessments' : `/${activeTab.value || 'jobs'}`);
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({}, '', targetRoute);
    }
  }

  function handleCandidateViewOpenLogin() {
    publicCandidateId.value = null;
    if (!isAuthenticated.value && typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({}, '', '/login');
    }
  }

  return {
    activeTab,
    primaryNavTabs,
    publicCandidateId,
    checkRoute,
    setTab,
    viewCandidatePublic,
    closePublicCandidate,
    handleCandidateViewOpenLogin
  };
}
