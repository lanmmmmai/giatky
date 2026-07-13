-- ============================================================
--  GIẶT KÝ — SUPABASE DATABASE SCHEMA
-- ============================================================

-- Bật extension uuid-ossp (nếu cần)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- 1. BẢNG USERS (Không có khóa ngoại tới branches ngay lập tức)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  username            TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  avatar_url          TEXT,
  phone               TEXT,
  role                TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  status              TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('active', 'pending_verification', 'blocked')),
  hourly_rate         BIGINT DEFAULT 0,
  branch_id           UUID, -- Sẽ add FK sau
  manager_id          UUID, -- Sẽ add FK sau
  created_by          UUID, -- Sẽ add FK sau
  email_verified_at   TIMESTAMPTZ,
  verification_token  TEXT,
  reset_password_token TEXT,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. BẢNG BRANCHES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  address             TEXT,
  phone               TEXT,
  manager_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm khóa ngoại cho users sau khi bảng branches được tạo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_users_branch' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_users_manager' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT fk_users_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_users_creator' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 3. BẢNG SERVICES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT,
  unit        TEXT DEFAULT 'kg',
  price       BIGINT DEFAULT 0,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. BẢNG CUSTOMERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  TEXT NOT NULL,
  phone      TEXT UNIQUE NOT NULL,
  email      TEXT,
  address    TEXT,
  date_of_birth DATE,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. BẢNG ORDERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code              TEXT UNIQUE NOT NULL,
  customer_id             UUID REFERENCES customers(id) ON DELETE SET NULL,
  branch_id               UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_by_staff_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name_snapshot  TEXT,
  customer_phone_snapshot TEXT,
  status                  TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'washing', 'drying', 'ready', 'delivered', 'cancelled')),
  payment_status          TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial')),
  payment_method          TEXT NOT NULL DEFAULT 'none' CHECK (payment_method IN ('cash', 'bank_transfer', 'e_wallet', 'none')),
  subtotal                BIGINT DEFAULT 0,
  discount                BIGINT DEFAULT 0,
  surcharge               BIGINT DEFAULT 0,
  total_amount            BIGINT DEFAULT 0,
  paid_amount             BIGINT DEFAULT 0,
  paid_at                 TIMESTAMPTZ,
  note                    TEXT,
  received_at             TIMESTAMPTZ DEFAULT NOW(),
  expected_return_at      TIMESTAMPTZ,
  delivered_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Sequence sinh mã đơn theo ngày, dùng atomic upsert trong create_order_atomic()
CREATE TABLE IF NOT EXISTS order_code_sequences (
  code_date DATE PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO order_code_sequences (
  code_date,
  last_number,
  updated_at
)
SELECT
  TO_DATE(SUBSTRING(order_code FROM '^LS-([0-9]{8})-'), 'YYYYMMDD') AS code_date,
  MAX((SUBSTRING(order_code FROM '^LS-[0-9]{8}-([0-9]+)$'))::INTEGER) AS last_number,
  NOW()
FROM orders
WHERE order_code ~ '^LS-[0-9]{8}-[0-9]+$'
GROUP BY 1
ON CONFLICT (code_date)
DO UPDATE SET
  last_number = GREATEST(order_code_sequences.last_number, EXCLUDED.last_number),
  updated_at = NOW();

-- ─────────────────────────────────────────────
-- 6. BẢNG ORDER_PAYMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'e_wallet')),
  amount         BIGINT NOT NULL CHECK (amount > 0),
  status         TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'cancelled')),
  paid_at        TIMESTAMPTZ DEFAULT NOW(),
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, status)
);

CREATE TABLE IF NOT EXISTS order_create_idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_create_idempotency_order
  ON order_create_idempotency_keys(order_id);

-- ─────────────────────────────────────────────
-- 7. BẢNG ORDER_ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id            UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name_snapshot TEXT NOT NULL,
  unit                  TEXT DEFAULT 'kg',
  quantity              NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price            BIGINT NOT NULL DEFAULT 0,
  amount                BIGINT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_order JSONB,
  p_items JSONB,
  p_payment JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_code_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_existing_order_id UUID;
  v_existing_user_id UUID;
  v_inserted_key INTEGER := 0;
  v_last_number INTEGER := 0;
  v_order_code TEXT;
  v_attempt INTEGER := 0;
  v_user_id UUID := (p_order->>'created_by_staff_id')::UUID;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL AND LENGTH(TRIM(p_idempotency_key)) > 0 THEN
    INSERT INTO order_create_idempotency_keys (idempotency_key, user_id)
    VALUES (TRIM(p_idempotency_key), v_user_id)
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_inserted_key = ROW_COUNT;

    IF v_inserted_key = 0 THEN
      SELECT user_id, order_id
      INTO v_existing_user_id, v_existing_order_id
      FROM order_create_idempotency_keys
      WHERE idempotency_key = TRIM(p_idempotency_key);

      IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_BY_DIFFERENT_USER' USING ERRCODE = '23505';
      END IF;

      IF v_existing_order_id IS NOT NULL THEN
        SELECT * INTO v_order FROM orders WHERE id = v_existing_order_id;
        RETURN jsonb_build_object(
          'order', to_jsonb(v_order),
          'order_code', v_order.order_code,
          'sequence_number', NULL,
          'idempotent_replay', TRUE
        );
      END IF;

      RAISE EXCEPTION 'IDEMPOTENCY_REQUEST_IN_PROGRESS' USING ERRCODE = '55P03';
    END IF;
  END IF;

  FOR v_attempt IN 1..3 LOOP
    INSERT INTO order_code_sequences (code_date, last_number, updated_at)
    VALUES (p_code_date, 1, NOW())
    ON CONFLICT (code_date)
    DO UPDATE SET
      last_number = order_code_sequences.last_number + 1,
      updated_at = NOW()
    RETURNING last_number INTO v_last_number;

    v_order_code := 'LS-' || TO_CHAR(p_code_date, 'YYYYMMDD') || '-' || LPAD(v_last_number::TEXT, 3, '0');

    BEGIN
      INSERT INTO orders (
        order_code,
        customer_id,
        branch_id,
        created_by_staff_id,
        customer_name_snapshot,
        customer_phone_snapshot,
        status,
        payment_status,
        payment_method,
        subtotal,
        discount,
        surcharge,
        total_amount,
        paid_amount,
        paid_at,
        note,
        expected_return_at,
        received_at
      )
      VALUES (
        v_order_code,
        (p_order->>'customer_id')::UUID,
        (p_order->>'branch_id')::UUID,
        (p_order->>'created_by_staff_id')::UUID,
        p_order->>'customer_name_snapshot',
        p_order->>'customer_phone_snapshot',
        COALESCE(p_order->>'status', 'new'),
        COALESCE(p_order->>'payment_status', 'unpaid'),
        COALESCE(p_order->>'payment_method', 'none'),
        COALESCE((p_order->>'subtotal')::BIGINT, 0),
        COALESCE((p_order->>'discount')::BIGINT, 0),
        COALESCE((p_order->>'surcharge')::BIGINT, 0),
        COALESCE((p_order->>'total_amount')::BIGINT, 0),
        COALESCE((p_order->>'paid_amount')::BIGINT, 0),
        NULLIF(p_order->>'paid_at', '')::TIMESTAMPTZ,
        NULLIF(p_order->>'note', ''),
        NULLIF(p_order->>'expected_return_at', '')::TIMESTAMPTZ,
        COALESCE(NULLIF(p_order->>'received_at', '')::TIMESTAMPTZ, NOW())
      )
      RETURNING * INTO v_order;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 3 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'ORDER_CODE_CONFLICT' USING ERRCODE = '23505';
  END IF;

  INSERT INTO order_items (
    order_id,
    service_id,
    service_name_snapshot,
    unit,
    quantity,
    unit_price,
    amount
  )
  SELECT
    v_order.id,
    NULLIF(item->>'service_id', '')::UUID,
    item->>'service_name_snapshot',
    COALESCE(item->>'unit', 'kg'),
    COALESCE((item->>'quantity')::NUMERIC, 1),
    COALESCE((item->>'unit_price')::BIGINT, 0),
    COALESCE((item->>'amount')::BIGINT, 0)
  FROM jsonb_array_elements(p_items) AS item;

  IF p_payment IS NOT NULL AND COALESCE((p_payment->>'amount')::BIGINT, 0) > 0 THEN
    INSERT INTO order_payments (
      order_id,
      payment_method,
      amount,
      status,
      paid_at,
      created_by,
      note
    )
    VALUES (
      v_order.id,
      p_payment->>'payment_method',
      (p_payment->>'amount')::BIGINT,
      COALESCE(p_payment->>'status', 'success'),
      COALESCE(NULLIF(p_payment->>'paid_at', '')::TIMESTAMPTZ, NOW()),
      (p_payment->>'created_by')::UUID,
      NULLIF(p_payment->>'note', '')
    );
  END IF;

  IF p_idempotency_key IS NOT NULL AND LENGTH(TRIM(p_idempotency_key)) > 0 THEN
    UPDATE order_create_idempotency_keys
    SET order_id = v_order.id
    WHERE idempotency_key = TRIM(p_idempotency_key);
  END IF;

  RETURN jsonb_build_object(
    'order', to_jsonb(v_order),
    'order_code', v_order.order_code,
    'sequence_number', v_last_number,
    'idempotent_replay', FALSE
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 7. BẢNG ATTENDANCE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id      UUID REFERENCES branches(id) ON DELETE SET NULL,
  work_date      DATE NOT NULL,
  check_in_time  TIMESTAMPTZ NOT NULL,
  check_out_time TIMESTAMPTZ,
  total_hours    NUMERIC DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'completed', 'missing_checkout')),
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 8. BẢNG PAYROLLS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payrolls (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id            UUID REFERENCES branches(id) ON DELETE SET NULL,
  month                INTEGER NOT NULL,
  year                 INTEGER NOT NULL,
  hourly_rate_snapshot BIGINT NOT NULL,
  total_hours          NUMERIC DEFAULT 0,
  total_salary         BIGINT DEFAULT 0,
  generated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at         TIMESTAMPTZ DEFAULT NOW(),
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'paid'))
);

-- ─────────────────────────────────────────────
-- 9. BẢNG NOTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('order', 'system', 'payroll', 'announcement', 'chat')),
  sender_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  target_role    TEXT CHECK (target_role IN ('admin', 'manager', 'staff')),
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  branch_id      UUID REFERENCES branches(id) ON DELETE CASCADE,
  send_email     BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 10. BẢNG NOTIFICATION_READS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (notification_id, user_id)
);

-- ─────────────────────────────────────────────
-- 11. BẢNG EMAIL_TEMPLATES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body_html  TEXT NOT NULL,
  variables  JSONB,
  type       TEXT NOT NULL UNIQUE CHECK (type IN ('verify_account', 'reset_password', 'order_success', 'announcement', 'payroll')),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 12. BẢNG EMAIL_LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 13. BẢNG SEO_SETTINGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain           TEXT NOT NULL,
  page_key         TEXT NOT NULL UNIQUE,
  meta_title       TEXT,
  meta_description TEXT,
  keywords         TEXT,
  canonical_url    TEXT,
  og_image         TEXT,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 14. BẢNG CHAT_ROOMS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT,
  type       TEXT NOT NULL CHECK (type IN ('branch', 'direct', 'group')),
  branch_id  UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 15. BẢNG CHAT_ROOM_MEMBERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_room_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

-- ─────────────────────────────────────────────
-- 16. BẢNG CHAT_MESSAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message        TEXT NOT NULL,
  attachment_url TEXT,
  is_read        BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders (order_code);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders (branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance (staff_id, work_date);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages (room_id, created_at DESC);
