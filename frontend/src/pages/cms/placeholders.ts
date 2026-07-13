// Bảng placeholder chuẩn của hệ thống email — đồng bộ với
// SAMPLE_PLACEHOLDER_DATA ở backend (app/email/email_service.py).
export interface PlaceholderDef {
  key: string;
  label: string;
  sample: string;
}

export const EMAIL_PLACEHOLDERS: PlaceholderDef[] = [
  { key: 'customer_name', label: 'Tên khách hàng', sample: 'Nguyễn Văn A' },
  { key: 'customer_email', label: 'Email khách hàng', sample: 'khachhang@example.com' },
  { key: 'customer_phone', label: 'SĐT khách hàng', sample: '0901 234 567' },
  { key: 'order_code', label: 'Mã đơn hàng', sample: 'LS-20260713-001' },
  { key: 'order_date', label: 'Ngày đặt đơn', sample: '13/07/2026 09:30' },
  { key: 'branch_name', label: 'Chi nhánh', sample: 'Giặt Ký - Chi nhánh Quận 1' },
  { key: 'service_name', label: 'Dịch vụ', sample: 'Giặt sấy tiêu chuẩn' },
  { key: 'order_status', label: 'Trạng thái đơn', sample: 'Đặt đơn thành công' },
  { key: 'total', label: 'Tổng tiền', sample: '150,000đ' },
  { key: 'payment_method', label: 'Phương thức thanh toán', sample: 'Tiền mặt' },
  { key: 'pickup_time', label: 'Thời gian nhận đồ', sample: '13/07/2026 09:30' },
  { key: 'delivery_time', label: 'Thời gian giao đồ', sample: '14/07/2026 17:00' },
  { key: 'website', label: 'Website', sample: 'https://giatky.site' },
  { key: 'support_phone', label: 'Hotline hỗ trợ', sample: '1900 0000' },
  { key: 'company_name', label: 'Tên công ty', sample: 'Giặt Ký' },
];
