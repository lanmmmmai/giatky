import apiClient from './client';

export interface ShiftRegistrationRequestPayload {
  full_name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  address?: string;
  desired_shift: string;
  available_start_date: string;
  branch_id: string;
  note?: string;
}

export const createShiftRegistrationRequest = (data: ShiftRegistrationRequestPayload) =>
  apiClient.post('/staff/shift-registration-requests', data).then(res => res.data);

