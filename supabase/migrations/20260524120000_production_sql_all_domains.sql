-- Producción: RLS colaborativo, Realtime y columnas extra para todos los dominios operativos.

-- Columnas extra JSONB + updated_at en tablas normalizadas
ALTER TABLE IF EXISTS public.providers
  ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS public.purchase_requests
  ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS public.petty_cash_transactions
  ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS public.app_users
  ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS public.roles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Macro: políticas colaborativas autenticadas (lectura/escritura compartida del centro)
DO $$
DECLARE
  tbl TEXT;
  pol_prefix TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'providers',
    'purchase_requests',
    'invoices',
    'petty_cash_transactions',
    'app_users',
    'roles'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;

    pol_prefix := replace(tbl, '_', '') || '_';

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_secure', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert_secure', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update_secure', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete_secure', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || 'select_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || 'insert_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || 'update_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || 'delete_collaborative', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)',
      pol_prefix || 'select_collaborative', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)',
      pol_prefix || 'insert_collaborative', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      pol_prefix || 'update_collaborative', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)',
      pol_prefix || 'delete_collaborative', tbl
    );

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
  END LOOP;
END $$;

-- Realtime en tablas operativas
DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY ARRAY[
    'providers',
    'purchase_requests',
    'invoices',
    'petty_cash_transactions',
    'app_users',
    'roles',
    'app_kv'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_providers_name ON public.providers (name);
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON public.petty_cash_transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON public.invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_date ON public.purchase_requests (request_date DESC);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users (email);
CREATE INDEX IF NOT EXISTS idx_app_kv_updated ON public.app_kv (updated_at DESC);

ALTER TABLE public.app_kv REPLICA IDENTITY FULL;
