ALTER TABLE order_items
ALTER COLUMN quantity TYPE NUMERIC(10,2)
USING quantity::numeric(10,2);

ALTER TABLE order_items
ALTER COLUMN quantity SET DEFAULT 1;
