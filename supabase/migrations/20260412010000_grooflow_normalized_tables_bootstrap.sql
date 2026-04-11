-- GrooFlow — Tablas normalizadas (bootstrap) en el mismo proyecto Supabase
-- Objetivo: tener el esquema listo para migrar desde KV (kv_store / Edge) hacia SQL.
-- Seguro en proyectos nuevos: IF NOT EXISTS. Si ya creaste tablas a mano, revisa nombres/columnas.
-- RLS duro: ya cubierto en 20260410000200 cuando las tablas existen.

-- ---------------------------------------------------------------------------
-- Tabla genérica opcional (misma idea que data:* en KV, pero en SQL directo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_kv (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_kv IS 'KV alternativo en Postgres; migración gradual desde Edge kv_store.';

-- ---------------------------------------------------------------------------
-- Entidades operativas (alineadas con BACKEND_MIGRATION.md)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id           TEXT PRIMARY KEY,
  amount       NUMERIC NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category     TEXT NOT NULL,
  subcategory  TEXT,
  concept      TEXT,
  description  TEXT NOT NULL,
  date         TIMESTAMPTZ NOT NULL,
  provider_id  TEXT,
  location     TEXT,
  user_id      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.providers (
  id                     TEXT PRIMARY KEY,
  ruc                    TEXT NOT NULL,
  name                   TEXT NOT NULL,
  category               TEXT NOT NULL,
  default_credit_days    INTEGER DEFAULT 0,
  email                  TEXT,
  phone                  TEXT,
  area                   TEXT,
  contact_name           TEXT,
  bank_name              TEXT,
  bank_account           TEXT,
  type                   TEXT,
  specialty              TEXT,
  total_purchased        NUMERIC DEFAULT 0,
  user_id                UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id                   TEXT PRIMARY KEY,
  provider_id          TEXT,
  provider_name        TEXT NOT NULL,
  request_date         TIMESTAMPTZ NOT NULL,
  description          TEXT NOT NULL,
  amount               NUMERIC NOT NULL,
  location             TEXT NOT NULL,
  priority             TEXT NOT NULL,
  payment_condition    TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',
  requester_name       TEXT NOT NULL,
  requester_initials   TEXT NOT NULL,
  approver_name        TEXT,
  approver_initials    TEXT,
  rejection_reason     TEXT,
  approval_comment     TEXT,
  user_id              UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id             TEXT PRIMARY KEY,
  file_name      TEXT NOT NULL,
  provider       TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  issue_date     DATE NOT NULL,
  due_date       DATE NOT NULL,
  description    TEXT NOT NULL,
  location       TEXT NOT NULL,
  subtotal       NUMERIC NOT NULL,
  igv            NUMERIC DEFAULT 0,
  total          NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft',
  user_id        UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.petty_cash_transactions (
  id              TEXT PRIMARY KEY,
  date            TIMESTAMPTZ NOT NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  type            TEXT NOT NULL,
  location        TEXT,
  category        TEXT NOT NULL,
  requester       TEXT NOT NULL,
  custodian_id    TEXT,
  receipt_number  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending_audit',
  week_number     TEXT,
  receipt_type    TEXT,
  doc_type        TEXT,
  doc_number      TEXT,
  provider_name   TEXT,
  area            TEXT,
  is_extra        BOOLEAN DEFAULT FALSE,
  amount_bi       NUMERIC,
  igv             NUMERIC,
  user_id         UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_users (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  initials         TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'manager',
  email            TEXT UNIQUE,
  location         TEXT,
  sedes            TEXT[],
  all_sedes        BOOLEAN DEFAULT FALSE,
  petty_cash_limit NUMERIC,
  last_login       TIMESTAMPTZ,
  status           TEXT DEFAULT 'active',
  auth_id          UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT,
  bg_color      TEXT,
  border_color  TEXT,
  is_system     BOOLEAN DEFAULT FALSE,
  permissions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.requisitions (
  id               TEXT PRIMARY KEY,
  location         TEXT NOT NULL,
  requester_id     TEXT NOT NULL,
  requester_name   TEXT NOT NULL,
  date             TIMESTAMPTZ NOT NULL,
  due_date         TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'draft',
  priority         TEXT NOT NULL DEFAULT 'medium',
  items            JSONB NOT NULL DEFAULT '[]'::jsonb,
  approver_id      TEXT,
  approval_date    TIMESTAMPTZ,
  rejection_reason TEXT,
  received_date    TIMESTAMPTZ,
  received_by      TEXT,
  user_id          UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
