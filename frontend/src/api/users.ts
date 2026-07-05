import apiClient from './client';
import { User } from '../stores/authStore';

export const getUsers = () => apiClient.get<User[]>('/users').then(res => res.data);
export const createManager = (data: any) => apiClient.post('/users/manager', data).then(res => res.data);
export const createStaff = (data: any) => apiClient.post('/users/staff', data).then(res => res.data);
export const getUserDetail = (id: string) => apiClient.get<User>(`/users/${id}`).then(res => res.data);
export const updateUser = (id: string, data: any) => apiClient.put<User>(`/users/${id}`, data).then(res => res.data);
export const updateUserStatus = (id: string, status: string) => apiClient.patch(`/users/${id}/status`, { status }).then(res => res.data);
export const deleteUser = (id: string) => apiClient.delete(`/users/${id}`).then(res => res.data);
