BEGIN;

CREATE TABLE IF NOT EXISTS sales_customer_orders (
  id uuid PRIMARY KEY,
  number text NOT NULL,
  external_code text,
  created_at_source varchar,
  document_at varchar NOT NULL,
  source_updated_at varchar NOT NULL,
  is_posted boolean NOT NULL,
  state_id uuid,
  customer_id uuid,
  organization_id uuid,
  store_id uuid,
  owner_id uuid,
  currency_id uuid,
  exchange_rate numeric,
  sum_minor numeric(20,4) NOT NULL,
  paid_sum_minor numeric(20,4),
  shipped_sum_minor numeric(20,4),
  invoiced_sum_minor numeric(20,4),
  reserved_sum_minor numeric(20,4),
  vat_enabled boolean,
  vat_included boolean,
  vat_sum_minor numeric(20,4),
  description text,
  attributes jsonb NOT NULL,
  document_links jsonb NOT NULL,
  raw_json jsonb NOT NULL,
  synced_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sales_orders_document_at_idx ON sales_customer_orders(document_at);
CREATE INDEX IF NOT EXISTS sales_orders_updated_idx ON sales_customer_orders(source_updated_at);
CREATE INDEX IF NOT EXISTS sales_orders_customer_idx ON sales_customer_orders(customer_id);
CREATE INDEX IF NOT EXISTS sales_orders_store_idx ON sales_customer_orders(store_id);

CREATE TABLE IF NOT EXISTS sales_customer_order_positions (
  order_id uuid NOT NULL REFERENCES sales_customer_orders(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  assortment_id uuid,
  assortment_type varchar,
  quantity numeric NOT NULL,
  price_minor numeric(20,4) NOT NULL,
  discount numeric,
  vat numeric,
  vat_enabled boolean,
  reserve numeric,
  raw_json jsonb NOT NULL,
  PRIMARY KEY (order_id, id)
);
CREATE INDEX IF NOT EXISTS sales_positions_assortment_idx ON sales_customer_order_positions(assortment_id);
COMMIT;
