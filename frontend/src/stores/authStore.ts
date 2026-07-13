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
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (usernameOrEmail: string, password: string, expectedRole: 'admin' | 'manager' | 'staff') => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: (idToken: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Initialize state from local storage
  const savedToken = localStorage.getItem('lanh_sach_token');
  const savedUserStr = localStorage.getItem('lanh_sach_user');
  let savedUser: User | null = null;
  
  if (savedUserStr) {
    try {
      savedUser = JSON.parse(savedUserStr);
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
        
        localStorage.setItem('lanh_sach_token', token);
        localStorage.setItem('lanh_sach_user', JSON.stringify(user));
        
        set({ user, token, loading: false });
        return { success: true };
      } catch (err: any) {
        const errMsg = err.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
        set({ error: errMsg, loading: false });
        return { success: false, message: errMsg };
      }
    },

    loginWithGoogle: async (idToken) => {
      set({ loading: true, error: null });
      try {
        const response = await apiClient.post('/auth/google', { id_token: idToken });
        const { token, user } = response.data;
        
        localStorage.setItem('lanh_sach_token', token);
        localStorage.setItem('lanh_sach_user', JSON.stringify(user));
        
        set({ user, token, loading: false });
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
      set({ user: null, token: null, error: null });
    },

    refreshUser: async () => {
      try {
        const response = await apiClient.get('/auth/me');
        const user = response.data;
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
        localStorage.setItem('lanh_sach_user', JSON.stringify(updatedUser));
        set({ user: updatedUser });
      }
    }
  };
});
