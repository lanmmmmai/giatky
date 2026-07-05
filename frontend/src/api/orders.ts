import apiClient from './client';

export interface OrderItem {
  id?: string;
  service_id?: string | null;
  service_name_snapshot: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Order {
  id: string;
  order_code: string;
  customer_id?: string;
  branch_id?: string;
  branch_name?: string;
  created_by_staff_id?: string;
  staff_name?: string;
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  customer_name?: string;
  customer_phone?: string;
  status: 'new' | 'washing' | 'drying' | 'ready' | 'delivered' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'partial';
  payment_method: 'cash' | 'bank_transfer' | 'e_wallet' | 'none';
  subtotal: number;
  discount: number;
  surcharge: number;
  total_amount: number;
  paid_amount: number;
  note?: string;
  received_at: string;
  expected_return_at?: string;
  delivered_at?: string;
  created_at: string;
  items?: OrderItem[];
  customers?: {
    full_name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
  };
}

export const getOrders = (params?: { branch_id?: string; status?: string; payment_status?: string; customer_phone?: string }) => 
  apiClient.get<Order[]>('/orders', { params }).then(res => res.data);
  
export const createOrder = (data: any) => apiClient.post<Order>('/orders', data).then(res => res.data);
export const getOrderDetail = (id: string) => apiClient.get<Order>(`/orders/${id}`).then(res => res.data);
export const updateOrder = (id: string, data: any) => apiClient.put<Order>(`/orders/${id}`, data).then(res => res.data);
export const updateOrderStatus = (id: string, status: string) => apiClient.patch<Order>(`/orders/${id}/status`, { status }).then(res => res.data);
export const updateOrderPayment = (id: string, data: { payment_status: string; payment_method: string; paid_amount: number }) => 
  apiClient.patch<Order>(`/orders/${id}/payment`, data).then(res => res.data);
export const deleteOrder = (id: string) => apiClient.delete(`/orders/${id}`).then(res => res.data);
