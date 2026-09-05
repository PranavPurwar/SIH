import { ref } from '../vue.js';
import { api, setAuthToken, getAuthToken } from '../services/api.js';
import type { AuthUser, LoginCredentials, RegisterPayload } from '../types/index.js';

export function useAuth() {
  const isAuthenticated = ref(!!getAuthToken());
  const authUser = ref<AuthUser | null>(
    typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null
  );

  async function handleLogin(credentials: LoginCredentials) {
    try {
      const res = await api.login(credentials);
      if (res && res.token) {
        setAuthToken(res.token, res.user);
        isAuthenticated.value = true;
        authUser.value = res.user;
        return res.user;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      alert(msg);
      throw err;
    }
  }

  async function handleRegister(payload: RegisterPayload) {
    try {
      const res = await api.register(payload);
      if (res && res.token) {
        setAuthToken(res.token, res.user);
        isAuthenticated.value = true;
        authUser.value = res.user;
        return res.user;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      alert(msg);
      throw err;
    }
  }

  function handleLogout() {
    setAuthToken(null);
    isAuthenticated.value = false;
    authUser.value = null;
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
  }

  return {
    isAuthenticated,
    authUser,
    handleLogin,
    handleRegister,
    handleLogout
  };
}
