-- ============================================================
--  LÀNH SẠCH LAUNDRY — SUPABASE SEED DATA
-- ============================================================

-- 1. Insert default Admin account
-- Password: 123@Admin (bcrypt hash: $2b$12$7ypTTTloRyqoNTeljOLbZenQmle3ctOMrFifg/rmCICr457LNUbHi)
INSERT INTO users (
  id,
  full_name,
  email,
  username,
  password_hash,
  role,
  status,
  phone,
  hourly_rate,
  email_verified_at,
  created_at,
  updated_at
) VALUES (
  'a0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e0e0',
  'Lành Sạch Admin',
  'admin@lanhsach.com',
  'admin',
  '$2b$12$7ypTTTloRyqoNTeljOLbZenQmle3ctOMrFifg/rmCICr457LNUbHi',
  'admin',
  'active',
  '0909090909',
  0,
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- 2. Insert email templates
INSERT INTO email_templates (
  id,
  name,
  subject,
  body_html,
  variables,
  type,
  is_active
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Xác thực tài khoản',
  'Chào mừng bạn đến với Lành Sạch Laundry - Xác nhận tài khoản',
  '<html><body><h2>Xin chào {{full_name}},</h2><p>Tài khoản của bạn tại Lành Sạch Laundry đã được tạo thành công với vai trò <strong>{{role}}</strong>.</p><p>Vui lòng click vào liên kết dưới đây để xác thực tài khoản và bắt đầu làm việc:</p><p><a href="{{verify_link}}" style="background-color:#2563EB;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Xác Thực Tài Khoản</a></p><br/><p>Đường dẫn này sẽ hết hạn sau 24 giờ.</p><p>Trân trọng,<br/>Đội ngũ Lành Sạch Laundry</p></body></html>',
  '["full_name", "role", "verify_link"]'::jsonb,
  'verify_account',
  true
), (
  '22222222-2222-2222-2222-222222222222',
  'Đặt lại mật khẩu',
  'Yêu cầu đặt lại mật khẩu - Lành Sạch Laundry',
  '<html><body><h2>Xin chào {{full_name}},</h2><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p><p>Vui lòng click vào liên kết dưới đây để thực hiện thay đổi mật khẩu:</p><p><a href="{{reset_link}}" style="background-color:#2563EB;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Đặt Lại Mật Khẩu</a></p><br/><p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p><p>Trân trọng,<br/>Đội ngũ Lành Sạch Laundry</p></body></html>',
  '["full_name", "reset_link"]'::jsonb,
  'reset_password',
  true
), (
  '33333333-3333-3333-3333-333333333333',
  'Đặt đơn thành công',
  'Đơn hàng mới {{order_code}} đã được tiếp nhận - Lành Sạch Laundry',
  '<html><body><h2>Chào {{full_name}},</h2><p>Cảm ơn quý khách đã sử dụng dịch vụ của Lành Sạch Laundry.</p><p>Đơn hàng của quý khách đã được tạo thành công với thông tin như sau:</p><ul><li>Mã đơn hàng: <strong>{{order_code}}</strong></li><li>Cơ sở tiếp nhận: {{branch_name}}</li><li>Tổng số tiền: {{total_amount}} VNĐ</li><li>Trạng thái thanh toán: {{payment_status}}</li><li>Thời gian hẹn trả dự kiến: {{expected_return_at}}</li></ul><p>Chúng tôi sẽ thông báo cho quý khách khi đồ giặt sẵn sàng để nhận.</p><p>Trân trọng,<br/>Lành Sạch Laundry</p></body></html>',
  '["full_name", "order_code", "branch_name", "total_amount", "payment_status", "expected_return_at"]'::jsonb,
  'order_success',
  true
), (
  '44444444-4444-4444-4444-444444444444',
  'Thông báo hệ thống',
  'Thông báo từ Ban quản trị - Lành Sạch Laundry',
  '<html><body><h2>Thông báo mới,</h2><p>Gửi các thành viên của Lành Sạch Laundry:</p><div style="border-left:4px solid #2563EB;padding-left:15px;margin:15px 0;"><strong>{{title}}</strong><br/><p>{{content}}</p></div><p>Trân trọng,<br/>Ban quản trị</p></body></html>',
  '["title", "content"]'::jsonb,
  'announcement',
  true
), (
  '55555555-5555-5555-5555-555555555555',
  'Bảng tính lương',
  'Bảng lương tháng {{month}}/{{year}} của bạn - Lành Sạch Laundry',
  '<html><body><h2>Xin chào {{full_name}},</h2><p>Bảng lương tháng {{month}}/{{year}} của bạn đã được tính thành công:</p><ul><li>Tổng số giờ làm việc: {{total_hours}} giờ</li><li>Đơn giá lương: {{hourly_rate}} VNĐ/giờ</li><li>Tổng lương nhận được: <strong>{{total_salary}} VNĐ</strong></li><li>Trạng thái: {{status}}</li></ul><p>Vui lòng đăng nhập vào ứng dụng để kiểm tra chi tiết ca làm việc.</p><p>Trân trọng,<br/>Lành Sạch Laundry</p></body></html>',
  '["full_name", "month", "year", "total_hours", "hourly_rate", "total_salary", "status"]'::jsonb,
  'payroll',
  true
) ON CONFLICT (type) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  variables = EXCLUDED.variables;

-- 3. Insert some default services
INSERT INTO services (
  id, name, category, unit, price, description, is_active
) VALUES (
  '51111111-1111-1111-1111-111111111111', 'Giặt Sấy Tiêu Chuẩn', 'Giặt thường', 'kg', 15000, 'Giặt nước và sấy khô tiêu chuẩn trong 2-3 giờ', true
), (
  '52222222-2222-2222-2222-222222222222', 'Giặt Sấy Nhanh (Lấy Liền)', 'Nhanh', 'kg', 25000, 'Giặt nước sấy nhanh trong vòng 1.5 giờ', true
), (
  '53333333-3333-3333-3333-333333333333', 'Giặt Hấp Áo Sơ Mi / Áo Thun', 'Hấp', 'cái', 35000, 'Giặt hấp chuyên dụng và là ủi phẳng', true
), (
  '54444444-4444-4444-4444-444444444444', 'Giặt Hấp Vest / Blazer', 'Hấp', 'bộ', 90000, 'Giặt khô hấp cao cấp cho áo vest và quần tây đi kèm', true
), (
  '55555555-5555-5555-5555-555555555555', 'Giặt Giày Thể Thao', 'Giặt thường', 'đôi', 50000, 'Làm sạch vết bẩn, khử mùi và diệt khuẩn giày thể thao', true
) ON CONFLICT DO NOTHING;
