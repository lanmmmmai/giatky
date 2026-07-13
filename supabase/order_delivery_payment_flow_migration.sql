ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'e_wallet')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'cancelled')),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, status)
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_paid_at ON order_payments(paid_at DESC);
