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
  created_at: string;
}

export const getSeoSettings = () => apiClient.get<SeoSettings[]>('/seo-settings').then(res => res.data);
export const createSeoSettings = (data: any) => apiClient.post<SeoSettings>('/seo-settings', data).then(res => res.data);
export const updateSeoSettings = (id: string, data: any) => apiClient.put<SeoSettings>(`/seo-settings/${id}`, data).then(res => res.data);
