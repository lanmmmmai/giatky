-- ============================================================
-- ĐỀ XUẤT MIGRATION CHO BẢNG seo_settings (CHƯA CHẠY)
-- ============================================================
-- File này chỉ là ĐỀ XUẤT. KHÔNG được chạy tự động.
-- Vui lòng xem xét và tự chạy trong Supabase SQL Editor nếu đồng ý.
--
-- Bối cảnh: schema hiện tại của seo_settings gồm:
--   id, domain, page_key (UNIQUE), meta_title, meta_description,
--   keywords, canonical_url, og_image, updated_by, created_at, updated_at
--
-- Các field dưới đây là phần yêu cầu nghiệp vụ CMS SEO (Phần 9)
-- nhưng CHƯA có trong schema, nên hiện chưa được triển khai trên UI:
--   - site_name        : Tên website hiển thị
--   - favicon           : Ảnh favicon (đường dẫn file trong Storage)
--   - logo              : Logo website (đường dẫn file trong Storage)
--   - is_active         : Trạng thái hoạt động của cấu hình
--   - is_default        : Cấu hình mặc định khi không khớp domain nào
--   - og_image_meta     : Metadata file ảnh OG (tên gốc, mime, dung lượng, thời gian upload)
--
-- Lưu ý: hiện hệ thống dùng page_key = domain (đã chuẩn hóa) để tận dụng
-- UNIQUE constraint có sẵn làm chốt chặn trùng domain ở tầng database.
-- Nếu chạy migration này, có thể thêm UNIQUE trực tiếp trên domain.

ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS site_name     TEXT;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS favicon       TEXT;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS logo          TEXT;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS is_active     BOOLEAN DEFAULT TRUE;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS is_default    BOOLEAN DEFAULT FALSE;
ALTER TABLE seo_settings ADD COLUMN IF NOT EXISTS og_image_meta JSONB;

-- Chống trùng domain ở tầng DB (hiện đang được chống ở tầng backend
-- + gián tiếp qua UNIQUE(page_key) vì page_key = domain chuẩn hóa):
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_settings_domain ON seo_settings (domain);

-- Đảm bảo chỉ một cấu hình mặc định đang hoạt động:
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_settings_default
--   ON seo_settings (is_default) WHERE is_default = TRUE;
