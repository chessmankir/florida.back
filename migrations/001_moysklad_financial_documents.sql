CREATE TABLE IF NOT EXISTS moysklad_financial_documents (
  type varchar(32) NOT NULL,
  id uuid NOT NULL,
  remote_updated varchar NULL,
  payload jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (type, id)
);
