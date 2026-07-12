import apiClient from './client';

export interface PayrollRecord {
  id: string;
  staff_id: string;
  staff_name?: string;
  staff_username?: string;
  branch_id: string;
  branch_name?: string;
  month: number;
  year: number;
  hourly_rate_snapshot: number;
  total_hours: number;
  total_salary: number;
  generated_at: string;
  status: 'draft' | 'confirmed' | 'paid';
}

export const getPayrolls = (params?: { month?: number; year?: number; branch_id?: string; staff_id?: string }) => 
  apiClient.get<PayrollRecord[]>('/payrolls', { params }).then(res => res.data);
  
export const generatePayroll = (month: number, year: number, branch_id: string, staff_id?: string) =>
  apiClient.post('/payrolls/generate', { month, year, branch_id, staff_id }).then(res => res.data);
  
export const confirmPayroll = (id: string) => apiClient.patch<PayrollRecord>(`/payrolls/${id}/confirm`).then(res => res.data);
export const payPayroll = (id: string) => apiClient.patch<PayrollRecord>(`/payrolls/${id}/paid`).then(res => res.data);
export const getMyPayroll = () => apiClient.get<PayrollRecord[]>('/payrolls/me').then(res => res.data);
