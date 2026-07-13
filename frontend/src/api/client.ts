import axios, { InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('lanh_sach_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const currentBranchId = localStorage.getItem('lanh_sach_current_branch_id');
    if (currentBranchId && config.headers) {
      config.headers['X-Current-Branch'] = currentBranchId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    
    const isAuthEndpoint = 
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/google') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/register-staff') ||
      requestUrl.includes('/auth/verify-email') ||
      requestUrl.includes('/auth/reset-password');

    const isPublicEndpoint =
      requestUrl.includes('/staff/shift-registration-requests') ||
      requestUrl.includes('/branches/public');
      
    if (status === 401 && !isAuthEndpoint && !isPublicEndpoint) {
      localStorage.removeItem('lanh_sach_token');
      localStorage.removeItem('lanh_sach_user');
      localStorage.removeItem('lanh_sach_current_branch_id');
      // Redirect to login page
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
