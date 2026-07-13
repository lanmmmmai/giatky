-- ============================================================
-- MIGRATION: MODULE SEO & EMAIL TEMPLATE (chuẩn hệ thống quản trị)
-- ============================================================
-- Chạy file này trong Supabase SQL Editor (Dashboard → SQL Editor).
-- Toàn bộ lệnh đều idempotent (IF NOT EXISTS / IF EXISTS) — chạy lại
-- nhiều lần không gây lỗi, không phá dữ liệu hiện có.
--
-- Backend được viết để tự phát hiện cột mới (feature-detect): khi chưa
-- chạy migration, các tính năng cũ vẫn hoạt động bình thường; các tính
-- năng mới sẽ báo rõ "cần chạy migration".

-- ─────────────────────────────────────────────
-- 1. SEO_SETTINGS: bổ sung field SEO đầy đủ
-- ─────────────────────────────────────────────
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS robots              TEXT DEFAULT 'index, follow';
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS og_title            TEXT;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS og_description      TEXT;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS twitter_card        TEXT DEFAULT 'summary_large_image';
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS twitter_title       TEXT;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS twitter_description TEXT;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS twitter_image       TEXT;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS favicon             TEXT;

-- ─────────────────────────────────────────────
-- 2. EMAIL_TEMPLATES: trigger tự do + audit người sửa
-- ─────────────────────────────────────────────
-- Bỏ ràng buộc CHECK cứng trên type để admin thêm trigger mới không giới hạn.
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;
-- Bỏ UNIQUE(type) để cho phép nhiều mẫu cùng một trigger (chỉ mẫu active được dùng).
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_type_key;

ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS body_text  TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_templates_type_active ON email_templates (type, is_active);

-- ─────────────────────────────────────────────
-- 3. EMAIL_TRIGGERS: danh mục trigger (admin thêm mới được)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_triggers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN DEFAULT FALSE,  -- trigger hệ thống: không cho xóa
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO email_triggers (code, name, description, is_system) VALUES
  ('verify_account',  'Đăng ký tài khoản',    'Gửi khi người dùng đăng ký tài khoản mới (email xác minh).', TRUE),
  ('reset_password',  'Quên mật khẩu',        'Gửi khi người dùng yêu cầu đặt lại mật khẩu.', TRUE),
  ('otp',             'OTP',                  'Gửi mã OTP xác thực.', TRUE),
  ('order_success',   'Đặt đơn thành công (legacy)', 'Mẫu cũ gửi khi tạo đơn — giữ để tương thích.', TRUE),
  ('ORDER_CREATED',   'Đặt đơn thành công',   'Gửi tới khách khi đơn hàng được tạo thành công.', TRUE),
  ('ORDER_RECEIVED',  'Đơn đã nhận',          'Gửi khi cửa hàng đã nhận đồ của khách.', TRUE),
  ('ORDER_WASHING',   'Đơn đang giặt',        'Gửi khi đơn chuyển sang trạng thái đang giặt.', TRUE),
  ('ORDER_DRYING',    'Đơn đang sấy',         'Gửi khi đơn chuyển sang trạng thái đang sấy.', TRUE),
  ('ORDER_COMPLETED', 'Đơn hoàn thành',       'Gửi khi đơn giặt xong, sẵn sàng giao/nhận.', TRUE),
  ('ORDER_DELIVERED', 'Đơn giao thành công',  'Gửi khi đơn đã giao tới khách.', TRUE),
  ('ORDER_CANCELLED', 'Hủy đơn',              'Gửi khi đơn hàng bị hủy.', TRUE),
  ('PAYMENT_SUCCESS', 'Thanh toán thành công','Gửi khi đơn được ghi nhận thanh toán đủ.', TRUE),
  ('PAYMENT_FAILED',  'Thanh toán thất bại',  'Gửi khi thanh toán thất bại.', TRUE),
  ('announcement',    'Thông báo chung',      'Mẫu thông báo chung của hệ thống.', TRUE),
  ('payroll',         'Thông báo bảng lương', 'Gửi thông báo bảng lương cho nhân viên.', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. EMAIL_SETTINGS: cấu hình SMTP gửi mail
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host     TEXT,
  smtp_port     INTEGER DEFAULT 587,
  smtp_user     TEXT,
  smtp_password TEXT,
  encryption    TEXT DEFAULT 'tls' CHECK (encryption IN ('none', 'ssl', 'tls')),
  sender_name   TEXT,
  sender_email  TEXT,
  is_active     BOOLEAN DEFAULT FALSE,  -- bật = gửi qua SMTP; tắt = dùng Brevo API như hiện tại
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. EMAIL_LOGS: bổ sung thông tin truy vết
-- ─────────────────────────────────────────────
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider            TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS template_id         UUID REFERENCES email_templates(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS trigger_code        TEXT;

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs (created_at DESC);
