-- ============================================================
-- MIGRATION: CA TUYỂN DỤNG CÓ CẤU TRÚC CHO JOB POSTS
-- ============================================================
-- Chạy trong Supabase SQL Editor. Idempotent — chạy lại không gây lỗi.
--
-- Hệ thống chưa có bảng ca làm việc chuẩn (chấm công dùng phiên vào-ra,
-- không có danh mục ca), nên ca tuyển dụng lưu dạng JSONB có cấu trúc
-- trên từng bài (phương án B trong spec):
--   [{"id": "morning", "name": "Ca sáng", "start_time": "07:00", "end_time": "12:00"}]
--
-- Cột shift_name (text tự do) được GIỮ NGUYÊN cho các bài cũ — không
-- backfill tự đoán ca. Bài cũ hiển thị shift_name; bài mới dùng shifts.

ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS shifts JSONB DEFAULT '[]'::jsonb;

-- Hồ sơ ứng tuyển lưu ID ca đã chọn (id thuộc mảng shifts của bài).
-- preferred_shift (text hiển thị) giữ nguyên, được backend tự resolve
-- từ dữ liệu bài tuyển dụng — không tin text từ client.
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS preferred_shift_id TEXT;

-- Làm giàu mẫu email hệ thống với dòng Ca/Cơ sở ứng tuyển.
-- Key theo `type` (mã trigger ổn định) — CHỈ cập nhật khi mẫu CHƯA có biến
-- {{shift_name}}, để không ghi đè nội dung admin đã tùy biến hoặc chạy lại
-- migration nhiều lần. Không match body_html verbatim vì chỉ cần một khoảng
-- trắng khác đi là điều kiện không bao giờ khớp và enrichment bị bỏ qua
-- âm thầm.
UPDATE email_templates
SET body_html = '<p>Xin chào {{full_name}},</p><p>Giặt Ký đã nhận hồ sơ ứng tuyển vị trí <strong>{{job_title}}</strong>.</p><p>Mã hồ sơ: <strong>{{application_code}}</strong></p><p>Cơ sở: {{branch_name}}</p><p>Ca ứng tuyển: {{shift_name}}</p><p>Ngày gửi: {{application_date}}</p><p>Bộ phận tuyển dụng sẽ liên hệ với bạn trong thời gian sớm nhất.</p>',
    variables = '["full_name","application_code","job_title","branch_name","shift_name","application_date","job_url","support_email","support_phone","company_name"]'::jsonb
WHERE type = 'JOB_APPLICATION_RECEIVED'
  AND body_html NOT LIKE '%{{shift_name}}%';

UPDATE email_templates
SET body_html = '<p>Có hồ sơ ứng tuyển mới.</p><p>Mã hồ sơ: <strong>{{application_code}}</strong></p><p>Ứng viên: {{full_name}}</p><p>Số điện thoại: {{phone}}</p><p>Email: {{email}}</p><p>Vị trí: {{job_title}}</p><p>Cơ sở: {{branch_name}}</p><p>Ca: {{shift_name}}</p><p>Ngày có thể bắt đầu: {{available_date}}</p><p><a href="{{admin_application_url}}">Xem hồ sơ trong trang quản trị</a></p>',
    variables = '["application_code","full_name","phone","email","job_title","branch_name","shift_name","available_date","admin_application_url","company_name"]'::jsonb
WHERE type = 'NEW_JOB_APPLICATION'
  AND body_html NOT LIKE '%{{shift_name}}%';
