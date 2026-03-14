-- ══════════════════════════════════════════════════════════════════
-- TPV LEGAL ES — Migración: Módulo de Compras
-- Pega en Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════════

-- ── LIMPIAR si existe versión anterior ──
DROP TABLE IF EXISTS deposit_events CASCADE;
DROP TABLE IF EXISTS deposits       CASCADE;
DROP TABLE IF EXISTS rebu_purchases CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchases      CASCADE;

-- ══════════════════════════════════════════════════════════════════
-- 1. COMPRAS CON FACTURA (artículos nuevos de proveedor)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE purchases (
  id                BIGSERIAL PRIMARY KEY,
  ref               TEXT NOT NULL UNIQUE,        -- referencia interna (ej: COM-000001)
  supplier_name     TEXT NOT NULL,               -- nombre proveedor
  supplier_nif      TEXT NOT NULL,               -- NIF/CIF proveedor
  supplier_invoice  TEXT NOT NULL,               -- nº factura del proveedor
  invoice_date      TEXT NOT NULL,               -- fecha factura proveedor
  invoice_total     NUMERIC(12,4) NOT NULL,      -- importe total factura
  notes             TEXT NOT NULL DEFAULT '',
  created_by        BIGINT REFERENCES users(id),
  created_by_name   TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ts                BIGINT NOT NULL
);

-- Artículos generados por esta factura
CREATE TABLE purchase_items (
  id           BIGSERIAL PRIMARY KEY,
  purchase_id  BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   BIGINT REFERENCES products(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '📦',
  category_id  BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  qty          INT NOT NULL DEFAULT 1,
  unit_cost    NUMERIC(10,4) NOT NULL,
  sale_price   NUMERIC(10,4) NOT NULL,
  iva_rate     NUMERIC(5,2) NOT NULL DEFAULT 21,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchases_ts ON purchases(ts DESC);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);

-- ══════════════════════════════════════════════════════════════════
-- 2. COMPRAS REBU (artículos de segunda mano a particulares)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE rebu_purchases (
  id              BIGSERIAL PRIMARY KEY,
  ref             TEXT NOT NULL UNIQUE,          -- ej: REBU-000001
  seller_name     TEXT NOT NULL,                 -- nombre del vendedor particular
  seller_dni      TEXT NOT NULL,                 -- DNI obligatorio REBU
  seller_address  TEXT NOT NULL DEFAULT '',      -- dirección del vendedor
  seller_phone    TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL,                 -- descripción del artículo
  buy_price       NUMERIC(10,4) NOT NULL,        -- precio de compra al particular
  sale_price      NUMERIC(10,4) NOT NULL,        -- precio de venta previsto
  category_id     BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  product_id      BIGINT REFERENCES products(id) ON DELETE SET NULL,
  notes           TEXT NOT NULL DEFAULT '',
  created_by      BIGINT REFERENCES users(id),
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ts              BIGINT NOT NULL
);

CREATE INDEX idx_rebu_purchases_ts ON rebu_purchases(ts DESC);

-- ══════════════════════════════════════════════════════════════════
-- 3. EMPEÑOS Y DEPÓSITOS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE deposits (
  id                BIGSERIAL PRIMARY KEY,
  ref               TEXT NOT NULL UNIQUE,        -- ej: DEP-000001 o EMP-000001
  deposit_type      TEXT NOT NULL DEFAULT 'deposito'
                      CHECK (deposit_type IN ('deposito','empeno')),
  -- Cliente / depositante
  client_name       TEXT NOT NULL,
  client_dni        TEXT NOT NULL,
  client_phone      TEXT NOT NULL DEFAULT '',
  client_address    TEXT NOT NULL DEFAULT '',
  -- Artículo
  description       TEXT NOT NULL,
  appraised_value   NUMERIC(10,4) NOT NULL,      -- valor tasado
  agreed_price      NUMERIC(10,4) NOT NULL,      -- precio acordado (empeño: importe prestado; depósito: precio de venta acordado)
  commission_pct    NUMERIC(5,2) NOT NULL DEFAULT 20, -- % comisión sobre venta
  -- Plazos
  entry_date        TEXT NOT NULL,
  expiry_date       TEXT NOT NULL,               -- fecha límite recogida/caducidad
  -- Estado
  status            TEXT NOT NULL DEFAULT 'activo'
                      CHECK (status IN ('activo','vendido','recuperado','caducado','cancelado')),
  -- Artículo creado
  category_id       BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  product_id        BIGINT REFERENCES products(id) ON DELETE SET NULL,
  notes             TEXT NOT NULL DEFAULT '',
  created_by        BIGINT REFERENCES users(id),
  created_by_name   TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ts                BIGINT NOT NULL
);

-- Historial de eventos del depósito/empeño
CREATE TABLE deposit_events (
  id          BIGSERIAL PRIMARY KEY,
  deposit_id  BIGINT NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('creacion','venta','recuperacion','renovacion','caducidad','nota')),
  detail      TEXT NOT NULL DEFAULT '',
  amount      NUMERIC(10,4),
  created_by_name TEXT NOT NULL DEFAULT 'sistema',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deposits_ts     ON deposits(ts DESC);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_deposit_events  ON deposit_events(deposit_id);

-- ══════════════════════════════════════════════════════════════════
-- RLS — solo service_role
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebu_purchases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_events  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_only" ON purchases      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON purchase_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON rebu_purchases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON deposits       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON deposit_events FOR ALL USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════
-- CONTADORES para referencias
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE ticket_counter ADD COLUMN IF NOT EXISTS purchase_val  BIGINT NOT NULL DEFAULT 1000;
ALTER TABLE ticket_counter ADD COLUMN IF NOT EXISTS rebu_val      BIGINT NOT NULL DEFAULT 1000;
ALTER TABLE ticket_counter ADD COLUMN IF NOT EXISTS deposit_val   BIGINT NOT NULL DEFAULT 1000;

-- ══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ══════════════════════════════════════════════════════════════════
SELECT 'purchases'      AS tabla, COUNT(*) FROM purchases
UNION ALL SELECT 'purchase_items', COUNT(*) FROM purchase_items
UNION ALL SELECT 'rebu_purchases', COUNT(*) FROM rebu_purchases
UNION ALL SELECT 'deposits',       COUNT(*) FROM deposits
UNION ALL SELECT 'deposit_events', COUNT(*) FROM deposit_events;
