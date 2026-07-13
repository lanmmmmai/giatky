import apiClient from './client';

export interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'order' | 'system' | 'payroll' | 'announcement' | 'chat';
  sender_id?: string;
  target_role?: string | null;
  target_user_id?: string | null;
  branch_id?: string | null;
  action_url?: string | null;
  send_email: boolean;
  created_at: string;
  is_read: boolean;
}

export const getNotifications = () => apiClient.get<Notification[]>('/notifications').then(res => res.data);
export const createNotification = (data: any) => apiClient.post<Notification>('/notifications', data).then(res => res.data);
export const markNotificationRead = (id: string) => apiClient.patch(`/notifications/${id}/read`).then(res => res.data);
export const markAllNotificationsRead = () => apiClient.patch('/notifications/read-all').then(res => res.data);
