import apiClient from './client';

export interface DashboardSummary {
  revenue_today: number;
  revenue_month: number;
  orders_today_count: number;
  orders_processing_count: number;
  orders_delivered_count: number;
  recent_orders: any[];
  branches_count?: number;
  managers_count?: number;
  staff_count?: number;
  revenue_by_branch?: { branch_name: string; revenue: number }[];
  daily_revenue?: { date: string; revenue: number }[];
  active_staff?: { id: string; full_name: string }[];
}

export interface RevenueReport {
  summary: {
    total_revenue: number;
    paid_revenue: number;
    unpaid_revenue: number;
    total_orders: number;
    average_order_value: number;
  };
  revenue_by_branch: { branch_name: string; revenue: number }[];
  revenue_by_staff: { staff_name: string; revenue: number }[];
  revenue_by_service: { service_name: string; revenue: number }[];
}

export const getDashboardSummary = () => apiClient.get<DashboardSummary>('/reports/dashboard').then(res => res.data);
export const getRevenueReport = (params?: { branch_id?: string; staff_id?: string; start_date?: string; end_date?: string; payment_status?: string; payment_method?: string }) => 
  apiClient.get<RevenueReport>('/reports/revenue', { params }).then(res => res.data);
