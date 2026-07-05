import apiClient from './client';

export interface Service {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export const getServices = () => apiClient.get<Service[]>('/services').then(res => res.data);
export const createService = (data: any) => apiClient.post<Service>('/services', data).then(res => res.data);
export const updateService = (id: string, data: any) => apiClient.put<Service>(`/services/${id}`, data).then(res => res.data);
export const deleteService = (id: string) => apiClient.delete(`/services/${id}`).then(res => res.data);
export const importExcelServices = (services: any[]) => apiClient.post('/services/import-excel', { services }).then(res => res.data);
