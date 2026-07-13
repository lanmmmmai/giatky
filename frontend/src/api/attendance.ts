import apiClient from './client';

export interface AttendanceRecord {
  id: string;
  staff_id: string;
  staff_name?: string;
  staff_username?: string;
  branch_id?: string;
  branch_name?: string;
  work_date: string;
  check_in_time?: string;
  check_out_time?: string;
  check_in_at?: string;
  check_out_at?: string;
  shift_id?: string;
  shift_name?: string;
  shift_start_time?: string;
  shift_end_time?: string;
  break_minutes?: number;
  work_minutes?: number;
  late_minutes?: number;
  early_leave_minutes?: number;
  overtime_minutes?: number;
  total_hours: number;
  status: string;
  source?: 'STAFF_CHECK_IN' | 'STAFF_CHECK_OUT' | 'ADMIN_MANUAL' | 'SYSTEM';
  is_manual?: boolean;
  adjustment_type?: string;
  manual_reason?: string;
  updated_by_name?: string;
  updated_at?: string;
  note?: string;
}

export interface AttendanceSummary {
  status: 'checked_in' | 'checked_out';
  current_shift?: AttendanceRecord | null;
  total_hours_today: number;
  total_hours_month: number;
}

export const checkIn = (note?: string) => apiClient.post<AttendanceRecord>('/attendance/check-in', { note }).then(res => res.data);
export const checkOut = (note?: string) => apiClient.post<AttendanceRecord>('/attendance/check-out', { note }).then(res => res.data);
export const getMyAttendance = () => apiClient.get<AttendanceRecord[]>('/attendance/me').then(res => res.data);
export const getAttendanceList = (params?: { branch_id?: string; staff_id?: string }) => 
  apiClient.get<AttendanceRecord[]>('/attendance', { params }).then(res => res.data);
export const getAttendanceSummary = () => apiClient.get<AttendanceSummary>('/attendance/summary').then(res => res.data);

export interface AdminAttendanceFilters {
  date_from?: string;
  date_to?: string;
  staff_id?: string;
  branch_id?: string;
  shift_id?: string;
  status_filter?: string;
  source?: string;
  search?: string;
}

export interface ManualAttendancePayload {
  staff_id: string;
  work_date: string;
  shift_id?: string;
  shift_name: string;
  shift_start_time?: string;
  shift_end_time?: string;
  check_in_at?: string;
  check_out_at?: string;
  break_minutes?: number;
  adjustment_type: string;
  manual_reason: string;
  note?: string;
}

export const getAdminAttendance = (params?: AdminAttendanceFilters) =>
  apiClient.get<AttendanceRecord[]>('/admin/attendance', { params }).then(res => res.data);

export const createManualAttendance = (data: ManualAttendancePayload) =>
  apiClient.post<AttendanceRecord>('/admin/attendance/manual', data).then(res => res.data);

export const updateAdminAttendance = (id: string, data: Partial<ManualAttendancePayload> & { manual_reason: string }) =>
  apiClient.put<AttendanceRecord>(`/admin/attendance/${id}`, data).then(res => res.data);

export const getAdminAttendanceHistory = (id: string) =>
  apiClient.get(`/admin/attendance/${id}/history`).then(res => res.data);
