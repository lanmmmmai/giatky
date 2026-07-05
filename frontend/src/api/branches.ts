import apiClient from './client';

export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  manager_id?: string | null;
  manager_name?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export const getBranches = () => apiClient.get<Branch[]>('/branches').then(res => res.data);
export const createBranch = (data: any) => apiClient.post<Branch>('/branches', data).then(res => res.data);
export const updateBranch = (id: string, data: any) => apiClient.put<Branch>(`/branches/${id}`, data).then(res => res.data);
export const deleteBranch = (id: string) => apiClient.delete(`/branches/${id}`).then(res => res.data);
