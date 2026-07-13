import apiClient from './client';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  variables?: string[];
  /** Mã trigger (danh mục quản lý ở /email/triggers — admin thêm mới được) */
  type: string;
  is_active: boolean;
  updated_by?: string;
  updated_by_name?: string | null;
  created_at: string;
  updated_at?: string;
}

// Danh mục fallback khi bảng email_triggers chưa được migrate
export const EMAIL_TEMPLATE_TYPES: { value: string; label: string }[] = [
  { value: 'verify_account', label: 'Xác minh tài khoản' },
  { value: 'reset_password', label: 'Đặt lại mật khẩu' },
  { value: 'order_success', label: 'Xác nhận đơn hàng' },
  { value: 'announcement', label: 'Thông báo chung' },
  { value: 'payroll', label: 'Thông báo bảng lương' },
];

export interface EmailTrigger {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  is_system?: boolean;
  created_at?: string;
}

export interface EmailLog {
  id: string;
  to_email: string;
  subject: string;
  body_html: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  provider?: string;
  trigger_code?: string;
  sender_name?: string;
  created_at: string;
}

export interface EmailSettings {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  encryption: 'none' | 'ssl' | 'tls';
  sender_name: string;
  sender_email: string;
  is_active: boolean;
  has_password: boolean;
  updated_at?: string;
}

export interface EmailPreviewResult {
  subject: string;
  body_html: string;
  body_text: string;
}

/* ─── Templates ─── */
export const getEmailTemplates = () => apiClient.get<EmailTemplate[]>('/email/templates').then(res => res.data);
export const createEmailTemplate = (data: any) => apiClient.post<EmailTemplate>('/email/templates', data).then(res => res.data);
export const updateEmailTemplate = (id: string, data: any) => apiClient.put<EmailTemplate>(`/email/templates/${id}`, data).then(res => res.data);
export const deleteEmailTemplate = (id: string) => apiClient.delete(`/email/templates/${id}`).then(res => res.data);
export const duplicateEmailTemplate = (id: string) => apiClient.post<EmailTemplate>(`/email/templates/${id}/duplicate`).then(res => res.data);
export const previewEmailTemplate = (data: { subject: string; body_html: string; body_text?: string }) =>
  apiClient.post<EmailPreviewResult>('/email/templates/preview', data).then(res => res.data);
export const sendTestEmail = (id: string, data: { to_email: string; subject_override?: string }) =>
  apiClient.post<{ message: string; to: string; subject: string }>(`/email/templates/${id}/send-test`, data).then(res => res.data);
export const getActiveTemplate = (trigger: string) =>
  apiClient.get<EmailTemplate>('/email/templates/active', { params: { trigger } }).then(res => res.data);

/* ─── Placeholders & Triggers ─── */
export const getPlaceholders = () => apiClient.get<Record<string, string>>('/email/placeholders').then(res => res.data);
export const getEmailTriggers = () => apiClient.get<EmailTrigger[]>('/email/triggers').then(res => res.data);
export const createEmailTrigger = (data: { code: string; name: string; description?: string }) =>
  apiClient.post<EmailTrigger>('/email/triggers', data).then(res => res.data);
export const deleteEmailTrigger = (code: string) => apiClient.delete(`/email/triggers/${code}`).then(res => res.data);

/* ─── Logs ─── */
export const getEmailLogs = () => apiClient.get<EmailLog[]>('/email/logs').then(res => res.data);

/* ─── Email Settings (SMTP) ─── */
export const getEmailSettings = () => apiClient.get<EmailSettings>('/email/settings').then(res => res.data);
export const updateEmailSettings = (data: Partial<EmailSettings> & { smtp_password?: string }) =>
  apiClient.put<EmailSettings>('/email/settings', data).then(res => res.data);
export const testEmailSettings = (to_email: string) =>
  apiClient.post<{ message: string; to: string }>('/email/settings/test', { to_email }).then(res => res.data);
