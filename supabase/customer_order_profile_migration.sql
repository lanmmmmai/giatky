ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE INDEX IF NOT EXISTS idx_customers_name_search ON customers (LOWER(full_name));
CREATE INDEX IF NOT EXISTS idx_customers_phone_search ON customers (phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_received ON orders (customer_id, received_at DESC);
