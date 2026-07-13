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
  paid_at?: string | null;
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
  customer_total_orders?: number;
  customer_total_spent?: number;
  customer_is_vip?: boolean;
}

export interface CustomerProfile {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  note?: string | null;
  total_orders: number;
  total_spent: number;
  last_order?: string | null;
  last_order_at?: string | null;
  first_order?: string | null;
  first_order_at?: string | null;
  average_order?: number;
  average_order_value?: number;
  total_kg?: number;
  total_items?: number;
  is_vip?: boolean;
  recent_orders?: Array<{
    id: string;
    order_code: string;
    received_at?: string | null;
    expected_return_at?: string | null;
    delivered_at?: string | null;
    status: string;
    payment_status: string;
    total_amount: number;
    staff_name?: string;
  }>;
}

const isCreateOrderResponse = (body: Order | { success: boolean; data: Order }): body is { success: boolean; data: Order } =>
  Boolean((body as { data?: Order }).data);

export const getOrders = (params?: { branch_id?: string; status?: string; payment_status?: string; customer_phone?: string; search?: string; page?: number; page_size?: number }) =>
  apiClient.get<Order[]>('/orders', { params }).then(res => res.data);
  
export const createOrder = (data: any, idempotencyKey?: string): Promise<Order> =>
  apiClient.post<Order | { success: boolean; data: Order }>('/orders', data, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  }).then(res => {
    const body = res.data as Order | { success: boolean; data: Order };
    return isCreateOrderResponse(body) ? body.data : body;
  });
export const getOrderDetail = (id: string) => apiClient.get<Order>(`/orders/${id}`).then(res => res.data);
export const updateOrder = (id: string, data: any) => apiClient.put<Order>(`/orders/${id}`, data).then(res => res.data);
export const updateOrderStatus = (id: string, status: string) => apiClient.patch<Order>(`/orders/${id}/status`, { status }).then(res => res.data);
export const updateOrderPayment = (id: string, data: { payment_status: string; payment_method: string; paid_amount: number }) => 
  apiClient.patch<Order>(`/orders/${id}/payment`, data).then(res => res.data);
export const completeOrderDelivery = (id: string, data?: { payment_method?: string; note?: string }) =>
  apiClient.post<{ success: boolean; order: Order; payment?: any; payment_status?: string; delivered_at?: string }>(`/orders/${id}/complete-delivery`, data || {}).then(res => res.data);
export const deleteOrder = (id: string) => apiClient.delete(`/orders/${id}`).then(res => res.data);

export const searchCustomers = (query: string) =>
  apiClient.get<CustomerProfile[]>('/orders/customers/search', { params: { query } }).then(res => res.data);

export const createCustomer = (data: {
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  note?: string | null;
}) => apiClient.post<CustomerProfile>('/orders/customers', data).then(res => res.data);

export const lookupCustomer = (phone: string) =>
  apiClient.get<CustomerProfile | null>(`/orders/customer-lookup/${phone}`).then(res => res.data);
