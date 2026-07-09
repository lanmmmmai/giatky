import apiClient from './client';

export interface Expense {
  id: string;
  report_id: string;
  expense_type: string;
  amount: number;
  description: string;
  created_by: string;
  created_at: string;
}

export interface RevenueReport {
  id: string | null; // Can be null if it's a draft day not saved in DB yet
  report_date: string;
  month: number;
  year: number;
  branch_id: string | null;
  staff_id: string | null;
  opening_cash: number;
  cumulative_revenue: number;
  cumulative_revenue_before?: number;
  daily_revenue: number;
  order_invoice_count: number;
  order_bank_transfer: number;
  order_cash: number;
  order_debt: number;
  debt_collection_total: number;
  debt_invoice_count: number;
  debt_bank_transfer: number;
  debt_cash: number;
  expense_amount: number;
  expense_description: string;
  total_expense?: number;
  closing_cash: number;
  note: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_at?: string;
  updated_at?: string;
  branches?: { name: string } | null;
  users?: { full_name: string } | null;
  expenses?: Expense[];
}

export interface ReportCreateParams {
  report_date: string;
  branch_id: string;
  opening_cash: number;
  expense_amount: number;
  expense_description: string;
  note?: string;
}

export interface ReportManualUpdateParams {
  opening_cash: number;
  expense_amount: number;
  expense_description: string;
  note: string;
}

export const getRevenueReports = (params?: {
  month?: number;
  year?: number;
  branch_id?: string;
  status?: string;
}) => {
  return apiClient.get<RevenueReport[]>('/revenue-reports', { params }).then(res => res.data);
};

export const getMonthlyReports = (branch_id: string, month: number, year: number) => {
  return apiClient.get<RevenueReport[]>('/revenue-reports/monthly', {
    params: { branch_id, month, year }
  }).then(res => res.data);
};

export const getReportDetail = (id: string) => {
  return apiClient.get<RevenueReport>(`/revenue-reports/${id}`).then(res => res.data);
};

export const createReport = (data: ReportCreateParams) => {
  return apiClient.post<{ success: boolean; data: RevenueReport }>('/revenue-reports', data).then(res => res.data);
};

export const updateManualFields = (id: string, data: ReportManualUpdateParams) => {
  return apiClient.put<{ success: boolean; data: RevenueReport }>(`/revenue-reports/${id}/manual-fields`, data).then(res => res.data);
};

export const deleteReport = (id: string) => {
  return apiClient.delete(`/revenue-reports/${id}`).then(res => res.data);
};

export const submitReport = (id: string) => {
  return apiClient.patch<RevenueReport>(`/revenue-reports/${id}/submit`).then(res => res.data);
};

export const approveReport = (id: string) => {
  return apiClient.patch<RevenueReport>(`/revenue-reports/${id}/approve`).then(res => res.data);
};

export const rejectReport = (id: string, rejectReason?: string) => {
  return apiClient.patch<RevenueReport>(`/revenue-reports/${id}/reject`, { reject_reason: rejectReason }).then(res => res.data);
};
