import apiClient from './client';

export interface AttendanceRecord {
  id: string;
  staff_id: string;
  staff_name?: string;
  branch_id?: string;
  branch_name?: string;
  work_date: string;
  check_in_time: string;
  check_out_time?: string;
  total_hours: number;
  status: 'checked_in' | 'completed' | 'missing_checkout';
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
