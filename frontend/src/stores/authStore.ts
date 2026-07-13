import { create } from 'zustand';
import apiClient from '../api/client';

export interface User {
  id: string;
  full_name: string;
  email: string;
  username: string;
  role: 'admin' | 'manager' | 'staff';
  status: 'active' | 'pending_verification' | 'blocked';
  branch_id?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  hourly_rate?: number;
  manager_id?: string | null;
  assigned_branches?: { branch_id: string; branch_name: string }[];
  branch_ids?: string[];
  facilities?: { id: string; name: string }[];
  current_branch_id?: string | null;
  current_branch_name?: string | null;
}

export const CURRENT_BRANCH_STORAGE_KEY = 'lanh_sach_current_branch_id';

export interface BranchOption {
  id: string;
  name: string;
}

export const getUserBranchOptions = (user?: User | null): BranchOption[] => {
  if (!user) return [];
  const byId = new Map<string, BranchOption>();

  (user.assigned_branches || []).forEach(branch => {
    if (branch.branch_id) byId.set(String(branch.branch_id), { id: String(branch.branch_id), name: branch.branch_name || 'Cơ sở' });
  });

  (user.facilities || []).forEach(branch => {
    if (branch.id) byId.set(String(branch.id), { id: String(branch.id), name: branch.name || 'Cơ sở' });
  });

  (user.branch_ids || []).forEach(branchId => {
    const id = String(branchId);
    if (!byId.has(id)) byId.set(id, { id, name: 'Cơ sở' });
  });

  if (user.branch_id && !byId.has(String(user.branch_id))) {
    byId.set(String(user.branch_id), { id: String(user.branch_id), name: user.current_branch_name || 'Cơ sở' });
  }

  return Array.from(byId.values());
};

const applyCurrentBranch = (user: User, requestedBranchId?: string | null): User => {
  const branches = getUserBranchOptions(user);
  if (branches.length === 0) {
    localStorage.removeItem(CURRENT_BRANCH_STORAGE_KEY);
    return { ...user, current_branch_id: null, current_branch_name: null };
  }

  const savedBranchId = localStorage.getItem(CURRENT_BRANCH_STORAGE_KEY);
  const selectedBranch =
    branches.find(branch => branch.id === requestedBranchId) ||
    branches.find(branch => branch.id === savedBranchId) ||
    branches.find(branch => branch.id === user.current_branch_id) ||
    branches.find(branch => branch.id === user.branch_id) ||
    branches[0];

  localStorage.setItem(CURRENT_BRANCH_STORAGE_KEY, selectedBranch.id);
  return {
    ...user,
    branch_id: selectedBranch.id,
    current_branch_id: selectedBranch.id,
    current_branch_name: selectedBranch.name,
  };
};

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (usernameOrEmail: string, password: string, expectedRole: 'admin' | 'manager' | 'staff') => Promise<{ success: boolean; message?: string }>;
  previewLogin: (usernameOrEmail: string, password: string, expectedRole: 'admin' | 'manager' | 'staff') => Promise<{ success: boolean; token?: string; user?: User; message?: string }>;
  completeLogin: (token: string, user: User, currentBranchId?: string) => void;
  loginWithGoogle: (idToken: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  setCurrentBranch: (branchId: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Initialize state from local storage
  const savedToken = localStorage.getItem('lanh_sach_token');
  const savedUserStr = localStorage.getItem('lanh_sach_user');
  let savedUser: User | null = null;
  
  if (savedUserStr) {
    try {
      savedUser = applyCurrentBranch(JSON.parse(savedUserStr));
    } catch (_) {
      localStorage.removeItem('lanh_sach_user');
    }
  }

  return {
    user: savedUser,
    token: savedToken,
    loading: false,
    error: null,

    login: async (usernameOrEmail, password, expectedRole) => {
      set({ loading: true, error: null });
      try {
        const response = await apiClient.post('/auth/login', {
          username_or_email: usernameOrEmail,
          password: password,
          expected_role: expectedRole,
        });
        
        const { token, user } = response.data;
        const userWithBranch = applyCurrentBranch(user);
        
        localStorage.setItem('lanh_sach_token', token);
        localStorage.setItem('lanh_sach_user', JSON.stringify(userWithBranch));
        
        set({ user: userWithBranch, token, loading: false });
        return { success: true };
      } catch (err: any) {
        const errMsg = err.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
        set({ error: errMsg, loading: false });
        return { success: false, message: errMsg };
      }
    },

    previewLogin: async (usernameOrEmail, password, expectedRole) => {
      set({ loading: true, error: null });
      try {
        const response = await apiClient.post('/auth/login', {
          username_or_email: usernameOrEmail,
          password: password,
          expected_role: expectedRole,
        });

        const { token, user } = response.data;
        set({ loading: false });
        return { success: true, token, user };
      } catch (err: any) {
        const errMsg = err.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
        set({ error: errMsg, loading: false });
        return { success: false, message: errMsg };
      }
    },

    completeLogin: (token, user, currentBranchId) => {
      const userWithBranch = applyCurrentBranch(user, currentBranchId);
      localStorage.setItem('lanh_sach_token', token);
      localStorage.setItem('lanh_sach_user', JSON.stringify(userWithBranch));
      set({ user: userWithBranch, token, loading: false, error: null });
    },

    loginWithGoogle: async (idToken) => {
      set({ loading: true, error: null });
      try {
        const response = await apiClient.post('/auth/google', { id_token: idToken });
        const { token, user } = response.data;
        const userWithBranch = applyCurrentBranch(user);
        
        localStorage.setItem('lanh_sach_token', token);
        localStorage.setItem('lanh_sach_user', JSON.stringify(userWithBranch));
        
        set({ user: userWithBranch, token, loading: false });
        return { success: true };
      } catch (err: any) {
        const errMsg = err.response?.data?.detail || 'Đăng nhập Google thất bại.';
        set({ error: errMsg, loading: false });
        return { success: false, message: errMsg };
      }
    },

    logout: () => {
      localStorage.removeItem('lanh_sach_token');
      localStorage.removeItem('lanh_sach_user');
      localStorage.removeItem(CURRENT_BRANCH_STORAGE_KEY);
      set({ user: null, token: null, error: null });
    },

    refreshUser: async () => {
      try {
        const response = await apiClient.get('/auth/me');
        const user = applyCurrentBranch(response.data, get().user?.current_branch_id || get().user?.branch_id);
        localStorage.setItem('lanh_sach_user', JSON.stringify(user));
        set({ user });
      } catch (err) {
        // If auth fails, token might be invalid; api client interceptor handles redirect
        console.error("Failed to refresh user info");
      }
    },

    updateUser: (userData) => {
      const currentUser = get().user;
      if (currentUser) {
        const updatedUser = { ...currentUser, ...userData };
        const userWithBranch = applyCurrentBranch(updatedUser, updatedUser.current_branch_id || updatedUser.branch_id);
        localStorage.setItem('lanh_sach_user', JSON.stringify(userWithBranch));
        set({ user: userWithBranch });
      }
    },

    setCurrentBranch: (branchId) => {
      const currentUser = get().user;
      if (!currentUser) return;
      const updatedUser = applyCurrentBranch(currentUser, branchId);
      localStorage.setItem('lanh_sach_user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  };
});
