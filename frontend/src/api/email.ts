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
}

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
