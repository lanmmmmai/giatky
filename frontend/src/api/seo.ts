import apiClient from './client';

export interface SeoSettings {
  id: string;
  domain: string;
  page_key: string;
  meta_title?: string;
  meta_description?: string;
  keywords?: string;
  canonical_url?: string;
  og_image?: string;
  updated_by?: string;
  updated_by_name?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SeoImageUploadResult {
  path: string;
  public_url: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
}

export const getSeoSettings = () => apiClient.get<SeoSettings[]>('/seo-settings').then(res => res.data);
export const getSeoSettingById = (id: string) => apiClient.get<SeoSettings>(`/seo-settings/${id}`).then(res => res.data);
export const getSeoByDomain = (host?: string) =>
  apiClient.get<SeoSettings>('/seo-settings/by-domain', { params: host ? { host } : {} }).then(res => res.data);
export const createSeoSettings = (data: Partial<SeoSettings>) => apiClient.post<SeoSettings>('/seo-settings', data).then(res => res.data);
export const updateSeoSettings = (id: string, data: Partial<SeoSettings>) => apiClient.put<SeoSettings>(`/seo-settings/${id}`, data).then(res => res.data);
export const deleteSeoSettings = (id: string) => apiClient.delete<{ message: string }>(`/seo-settings/${id}`).then(res => res.data);

export const uploadSeoImage = (file: File, domain: string, kind: 'og' | 'favicon' | 'logo' = 'og') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('domain', domain || 'general');
  formData.append('kind', kind);
  return apiClient
    .post<SeoImageUploadResult>('/seo-settings/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(res => res.data);
};

export const deleteSeoImage = (path: string, excludeId?: string) =>
  apiClient
    .delete<{ message: string }>('/seo-settings/upload-image', { params: { path, exclude_id: excludeId } })
    .then(res => res.data);
