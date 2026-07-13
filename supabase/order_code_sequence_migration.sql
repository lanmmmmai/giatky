-- ============================================================
--  Atomic order_code generation and order creation
-- ============================================================

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

CREATE TABLE IF NOT EXISTS order_create_idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_create_idempotency_order
  ON order_create_idempotency_keys(order_id);

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
