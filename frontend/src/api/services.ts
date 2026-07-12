import apiClient from './client';

export interface Service {
  id: string;
  name: string;
  category_id?: string | null;
  category_name?: string | null;
  price: number;
  unit: string;
  description?: string | null;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

interface RawService {
  id: string;
  name: string;
  category?: string | null;
  unit: string;
  price: number;
  description?: string | null;
  is_active?: boolean;
  status?: 'active' | 'inactive' | null;
  created_at?: string;
  updated_at?: string;
}

interface ServiceMutationInput {
  name: string;
  category_id?: string | null;
  category_name?: string | null;
  price: number;
  unit: string;
  description?: string | null;
  status: 'active' | 'inactive';
}

const mapRawService = (service: RawService): Service => {
  const categoryName = service.category?.trim() || null;
  const derivedStatus =
    service.status ||
    (service.is_active === false ? 'inactive' : 'active');

  return {
    id: service.id,
    name: service.name,
    category_id: categoryName,
    category_name: categoryName,
    price: service.price,
    unit: service.unit,
    description: service.description || null,
    status: derivedStatus,
    created_at: service.created_at,
    updated_at: service.updated_at,
  };
};

const toApiPayload = (data: Partial<ServiceMutationInput>) => {
  const payload: Record<string, unknown> = {};

  if (data.name !== undefined) payload.name = data.name;
  if (data.price !== undefined) payload.price = data.price;
  if (data.unit !== undefined) payload.unit = data.unit;
  if (data.description !== undefined) payload.description = data.description;
  if (data.status !== undefined) payload.is_active = data.status === 'active';
  if (data.category_id !== undefined || data.category_name !== undefined) {
    payload.category = data.category_name ?? data.category_id ?? null;
  }

  return payload;
};

export const getServices = () =>
  apiClient
    .get<RawService[]>('/services')
    .then((res) => (res.data || []).map(mapRawService));

export const createService = (data: ServiceMutationInput) =>
  apiClient
    .post<RawService>('/services', toApiPayload(data))
    .then((res) => mapRawService(res.data));

export const updateService = (id: string, data: Partial<ServiceMutationInput>) =>
  apiClient
    .put<RawService>(`/services/${id}`, toApiPayload(data))
    .then((res) => mapRawService(res.data));

export const deleteService = (id: string) =>
  apiClient.delete(`/services/${id}`).then((res) => res.data);

export const importExcelServices = (services: ServiceMutationInput[]) =>
  apiClient
    .post('/services/import-excel', {
      services: services.map((service) => ({
        name: service.name,
        category: service.category_name ?? service.category_id ?? null,
        unit: service.unit,
        price: service.price,
        description: service.description ?? '',
      })),
    })
    .then((res) => res.data);
