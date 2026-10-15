CREATE TABLE IF NOT EXISTS products (
  code TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_code TEXT NOT NULL REFERENCES products(code),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  old_price TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('ATIVA','BREVE','ENCERRADA'))
);

CREATE INDEX IF NOT EXISTS promotions_product_code_idx ON promotions(product_code);
CREATE INDEX IF NOT EXISTS promotions_store_id_idx ON promotions(store_id);
CREATE INDEX IF NOT EXISTS promotions_status_idx ON promotions(status);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_count INTEGER NOT NULL
);
