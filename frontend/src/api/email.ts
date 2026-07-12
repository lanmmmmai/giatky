import apiClient from './client';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  variables?: string[];
  type: 'verify_account' | 'reset_password' | 'order_success' | 'announcement' | 'payroll';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Mirrors the CHECK constraint on email_templates.type in the Supabase schema
export const EMAIL_TEMPLATE_TYPES: { value: EmailTemplate['type']; label: string }[] = [
  { value: 'verify_account', label: 'Xác minh tài khoản' },
  { value: 'reset_password', label: 'Đặt lại mật khẩu' },
  { value: 'order_success', label: 'Xác nhận đơn hàng' },
  { value: 'announcement', label: 'Thông báo chung' },
  { value: 'payroll', label: 'Thông báo bảng lương' },
];

export interface EmailLog {
  id: string;
  to_email: string;
  subject: string;
  body_html: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  sender_name?: string;
  created_at: string;
}

export const getEmailTemplates = () => apiClient.get<EmailTemplate[]>('/email/templates').then(res => res.data);
export const createEmailTemplate = (data: any) => apiClient.post<EmailTemplate>('/email/templates', data).then(res => res.data);
export const updateEmailTemplate = (id: string, data: any) => apiClient.put<EmailTemplate>(`/email/templates/${id}`, data).then(res => res.data);
export const deleteEmailTemplate = (id: string) => apiClient.delete(`/email/templates/${id}`).then(res => res.data);
export const getEmailLogs = () => apiClient.get<EmailLog[]>('/email/logs').then(res => res.data);
