-- ══════════════════════════════════════════════════════════════════
-- TPV LEGAL ES — Schema completo para Supabase
-- Pega TODO este archivo en Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════════

-- ── EXTENSIONES ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── LIMPIAR (si ya existe una versión anterior) ───────────────────
DROP TABLE IF EXISTS op_log       CASCADE;
DROP TABLE IF EXISTS sales        CASCADE;
DROP TABLE IF EXISTS products     CASCADE;
DROP TABLE IF EXISTS categories   CASCADE;
DROP TABLE IF EXISTS users        CASCADE;
DROP TABLE IF EXISTS ticket_counter CASCADE;
DROP FUNCTION IF EXISTS decrement_stock CASCADE;
DROP FUNCTION IF EXISTS increment_stock CASCADE;

-- ══════════════════════════════════════════════════════════════════
-- TABLAS
-- ══════════════════════════════════════════════════════════════════

-- ── TICKET COUNTER ────────────────────────────────────────────────
CREATE TABLE ticket_counter (
  id  INT PRIMARY KEY DEFAULT 1,
  val BIGINT NOT NULL DEFAULT 1000,
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO ticket_counter (id, val) VALUES (1, 1000);

-- ── USERS ─────────────────────────────────────────────────────────
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'cajero'
                  CHECK (role IN ('cajero','encargado','admin')),
  active        BOOLEAN NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CATEGORIES ────────────────────────────────────────────────────
CREATE TABLE categories (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '🏷️',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PRODUCTS ──────────────────────────────────────────────────────
CREATE TABLE products (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '📦',
  category_id  BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  price        NUMERIC(10,4) NOT NULL DEFAULT 0,
  regime       TEXT NOT NULL DEFAULT 'iva' CHECK (regime IN ('iva','rebu')),
  iva_rate     NUMERIC(5,2) NOT NULL DEFAULT 21,
  cost_price   NUMERIC(10,4) NOT NULL DEFAULT 0,
  stock        INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SALES ─────────────────────────────────────────────────────────
-- Inalterable por diseño: nunca UPDATE en base ni iva_total ni hash
CREATE TABLE sales (
  id            BIGSERIAL PRIMARY KEY,
  ticket_id     TEXT NOT NULL UNIQUE,
  type          TEXT NOT NULL DEFAULT 'venta' CHECK (type IN ('venta','rectificativo')),
  date          TEXT NOT NULL,
  time          TEXT NOT NULL,
  ts            BIGINT NOT NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  iva_breakdown JSONB NOT NULL DEFAULT '{}',
  base          NUMERIC(12,6) NOT NULL,
  iva_total     NUMERIC(12,6) NOT NULL,
  total         NUMERIC(12,6) NOT NULL,
  pay           TEXT NOT NULL DEFAULT 'efectivo' CHECK (pay IN ('efectivo','tarjeta')),
  cashier_id    BIGINT REFERENCES users(id),
  cashier_name  TEXT NOT NULL,
  nif           TEXT NOT NULL,
  razon_social  TEXT NOT NULL,
  rect_of       TEXT,
  rect_reason   TEXT,
  rectified     BOOLEAN NOT NULL DEFAULT false,
  rectified_by  TEXT,
  rectified_at  TIMESTAMPTZ,
  hash          TEXT NOT NULL,
  prev_hash     TEXT NOT NULL,
  sw_name       TEXT NOT NULL DEFAULT 'TPV-Legal-ES',
  sw_version    TEXT NOT NULL DEFAULT '1.0.0',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_sales_ts         ON sales(ts DESC);
CREATE INDEX idx_sales_type       ON sales(type);
CREATE INDEX idx_sales_pay        ON sales(pay);
CREATE INDEX idx_sales_cashier    ON sales(cashier_id);
CREATE INDEX idx_sales_ticket_id  ON sales(ticket_id);
CREATE INDEX idx_sales_date       ON sales(date);

-- ── OP LOG ────────────────────────────────────────────────────────
CREATE TABLE op_log (
  id         BIGSERIAL PRIMARY KEY,
  ts         BIGINT NOT NULL,
  dt         TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('venta','rect','auth','admin','system')),
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  user_id    BIGINT REFERENCES users(id),
  username   TEXT NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_ts   ON op_log(ts DESC);
CREATE INDEX idx_log_type ON op_log(type);

-- ══════════════════════════════════════════════════════════════════
-- FUNCIONES AUXILIARES
-- ══════════════════════════════════════════════════════════════════

-- Decrementar stock (llamada desde API en cada venta)
CREATE OR REPLACE FUNCTION decrement_stock(p_id BIGINT, p_qty INT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock - p_qty)
  WHERE id = p_id;
END;
$$;

-- Incrementar stock (llamada desde API en rectificativo)
CREATE OR REPLACE FUNCTION increment_stock(p_id BIGINT, p_qty INT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET stock = stock + p_qty
  WHERE id = p_id;
END;
$$;

-- Resumen de IVA para un rango de fechas (útil para Mod. 303)
CREATE OR REPLACE FUNCTION iva_summary(p_from BIGINT, p_to BIGINT)
RETURNS TABLE (
  iva_rate    TEXT,
  total_base  NUMERIC,
  total_cuota NUMERIC,
  total_bruto NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH expanded AS (
    SELECT
      key AS rate,
      ((value->>'base')::NUMERIC)  AS base,
      ((value->>'iva')::NUMERIC)   AS iva,
      ((value->>'total')::NUMERIC) AS total
    FROM sales,
         jsonb_each(iva_breakdown)
    WHERE ts BETWEEN p_from AND p_to
      AND type = 'venta'
  )
  SELECT
    rate,
    ROUND(SUM(base),  2),
    ROUND(SUM(iva),   2),
    ROUND(SUM(total), 2)
  FROM expanded
  GROUP BY rate
  ORDER BY rate;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════
-- IMPORTANTE: toda la autenticación la gestiona la API con JWT.
-- Supabase se usa con service_role_key desde el servidor,
-- así que las políticas RLS son una capa adicional de seguridad.

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE op_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_counter  ENABLE ROW LEVEL SECURITY;

-- Solo el service_role (servidor) puede operar. Anon = sin acceso.
CREATE POLICY "service_only" ON users           FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON categories      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON products        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON sales           FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON op_log          FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_only" ON ticket_counter  FOR ALL USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════
-- DATOS DE EJEMPLO (seed)
-- ══════════════════════════════════════════════════════════════════

-- Usuarios (contraseñas hasheadas con bcrypt cost=12)
-- admin     → admin123
-- encargado → enc123
-- cajero1   → caj123
-- cajero2   → caj456
-- admin=admin123 | encargado=enc123 | cajero1=caj123 | cajero2=caj456
-- Cambia las contraseñas desde el panel Admin de la app tras el primer login
INSERT INTO users (username, password_hash, name, role) VALUES
  ('admin',
   '$2b$12$LS/rF4VSnI9GuS6j6vYNSeqy5b31trW5afsyFId36H.wvwpeX.KUC',
   'Administrador', 'admin'),
  ('encargado',
   '$2b$12$Y2t59BtKOS.87yGxArWx8.O2M6v85Y9Jq1PQYIJKrzArWaYKs.DXK',
   'María García', 'encargado'),
  ('cajero1',
   '$2b$12$OAyzwhkW5iVxI.MCGmbB.OiqFQ2wlVTe5PcrTnYNZUMBvunKqzDUe',
   'Juan López', 'cajero'),
  ('cajero2',
   '$2b$12$O5PP46jI.L4qvGgiRKi/lOG6Q8ltD95m4wqu2o.Fz/1yFV5GDUddS',
   'Ana Martínez', 'cajero');

-- Categorías
INSERT INTO categories (name, icon) VALUES
  ('Alimentación', '🥫'),
  ('Bebidas',      '🥤'),
  ('Limpieza',     '🧹'),
  ('Electrónica',  '📱'),
  ('Segunda Mano', '♻️'),
  ('Otros',        '📦');

-- Productos (category_id corresponde al orden de inserción)
INSERT INTO products (name, emoji, category_id, price, regime, iva_rate, cost_price, stock) VALUES
  ('Leche Entera 1L',   '🥛', 1, 1.15,  'iva',  4,  0,    45),
  ('Pan de Molde',      '🍞', 1, 1.30,  'iva',  4,  0,    20),
  ('Agua 1.5L',         '💧', 2, 0.55,  'iva',  10, 0,    80),
  ('Coca-Cola 2L',      '🥤', 2, 1.99,  'iva',  10, 0,    30),
  ('Detergente Ropa',   '🧺', 3, 5.49,  'iva',  21, 0,    12),
  ('Auriculares BT',    '🎧', 4, 29.99, 'iva',  21, 0,     5),
  ('Cable USB-C',       '🔌', 4, 8.99,  'iva',  21, 0,    15),
  ('Chaqueta Vintage',  '🧥', 5, 25.00, 'rebu', 21, 10.00, 3),
  ('Consola Retro',     '🎮', 5, 45.00, 'rebu', 21, 18.00, 2),
  ('Libro Colección',   '📚', 5, 12.00, 'rebu', 21,  3.00, 8);

-- Log inicial
INSERT INTO op_log (ts, dt, type, action, detail, username) VALUES
  (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
   TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI:SS'),
   'system', 'Base de datos inicializada', 'Schema TPV-Legal-ES v1.0.0 creado', 'sistema');

-- ══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL
-- ══════════════════════════════════════════════════════════════════
SELECT 'users'          AS tabla, COUNT(*) AS filas FROM users
UNION ALL
SELECT 'categories',    COUNT(*) FROM categories
UNION ALL
SELECT 'products',      COUNT(*) FROM products
UNION ALL
SELECT 'ticket_counter',COUNT(*) FROM ticket_counter
UNION ALL
SELECT 'op_log',        COUNT(*) FROM op_log;
