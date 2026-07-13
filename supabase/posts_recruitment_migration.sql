CREATE TABLE IF NOT EXISTS email_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS body_text TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_type_check;
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_type_key;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-applications',
  'job-applications',
  FALSE,
  5242880,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT DEFAULT '',
  post_type TEXT NOT NULL DEFAULT 'news' CHECK (post_type IN ('news', 'recruitment', 'announcement', 'guide', 'other')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'hidden', 'expired')),
  featured_image TEXT,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT,
  canonical_url TEXT,
  og_image TEXT,
  allow_application_form BOOLEAN DEFAULT FALSE,
  allow_comments BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_posts_status_type ON posts(status, post_type);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at);

CREATE TABLE IF NOT EXISTS job_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  job_title TEXT,
  department TEXT,
  employment_type TEXT CHECK (employment_type IS NULL OR employment_type IN ('full_time', 'part_time', 'shift', 'seasonal', 'internship')),
  shift_name TEXT,
  salary_text TEXT,
  quantity INTEGER DEFAULT 0,
  experience TEXT,
  gender TEXT,
  age_range TEXT,
  application_deadline DATE,
  recruiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  receiving_email TEXT,
  contact_phone TEXT,
  benefits TEXT,
  requirements TEXT,
  responsibilities TEXT,
  allow_online_application BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_post_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE(job_post_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_job_post_branches_job ON job_post_branches(job_post_id);
CREATE INDEX IF NOT EXISTS idx_job_post_branches_branch ON job_post_branches(branch_id);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_code TEXT NOT NULL UNIQUE,
  job_post_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  preferred_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  preferred_shift TEXT,
  experience TEXT,
  education TEXT,
  available_date DATE,
  expected_salary TEXT,
  introduction TEXT,
  cv_path TEXT,
  photo_path TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW', 'VIEWED', 'CONTACTING', 'INTERVIEW_SCHEDULED', 'INTERVIEW_PASSED',
    'INTERVIEW_FAILED', 'HIRED', 'REJECTED', 'ARCHIVED'
  )),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  internal_note TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_post_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_submitted ON job_applications(submitted_at DESC);

CREATE TABLE IF NOT EXISTS job_application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  note TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_application_logs_application ON job_application_logs(application_id);

INSERT INTO email_triggers (code, name, description, is_system) VALUES
  ('JOB_APPLICATION_RECEIVED', 'Xác nhận đã nhận hồ sơ ứng tuyển', 'Gửi email xác nhận cho ứng viên sau khi nộp hồ sơ.', TRUE),
  ('NEW_JOB_APPLICATION', 'Thông báo hồ sơ ứng tuyển mới', 'Gửi email cho bộ phận tuyển dụng khi có hồ sơ mới.', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO email_templates (name, subject, body_html, body_text, variables, type, is_active)
SELECT
  'Xác nhận hồ sơ ứng tuyển',
  'Giặt Ký đã nhận hồ sơ ứng tuyển của bạn - {{application_code}}',
  '<p>Xin chào {{full_name}},</p><p>Giặt Ký đã nhận hồ sơ ứng tuyển vị trí <strong>{{job_title}}</strong>.</p><p>Mã hồ sơ: <strong>{{application_code}}</strong></p><p>Cơ sở: {{branch_name}}</p><p>Ngày gửi: {{application_date}}</p><p>Bộ phận tuyển dụng sẽ liên hệ với bạn trong thời gian sớm nhất.</p>',
  'Giặt Ký đã nhận hồ sơ ứng tuyển {{application_code}} cho vị trí {{job_title}}.',
  '["full_name","application_code","job_title","branch_name","application_date","job_url","support_email","support_phone","company_name"]'::jsonb,
  'JOB_APPLICATION_RECEIVED',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates WHERE type = 'JOB_APPLICATION_RECEIVED' AND name = 'Xác nhận hồ sơ ứng tuyển'
);

INSERT INTO email_templates (name, subject, body_html, body_text, variables, type, is_active)
SELECT
  'Thông báo hồ sơ ứng tuyển mới',
  'Có hồ sơ ứng tuyển mới: {{job_title}} - {{full_name}}',
  '<p>Có hồ sơ ứng tuyển mới.</p><p>Mã hồ sơ: <strong>{{application_code}}</strong></p><p>Ứng viên: {{full_name}}</p><p>Số điện thoại: {{phone}}</p><p>Email: {{email}}</p><p>Vị trí: {{job_title}}</p><p>Cơ sở: {{branch_name}}</p><p>Ngày có thể bắt đầu: {{available_date}}</p><p><a href="{{admin_application_url}}">Xem hồ sơ trong trang quản trị</a></p>',
  'Có hồ sơ ứng tuyển mới {{application_code}} từ {{full_name}} cho vị trí {{job_title}}.',
  '["application_code","full_name","phone","email","job_title","branch_name","available_date","admin_application_url","company_name"]'::jsonb,
  'NEW_JOB_APPLICATION',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates WHERE type = 'NEW_JOB_APPLICATION' AND name = 'Thông báo hồ sơ ứng tuyển mới'
);
