-- Metadatos operativos de caja chica (cierres, pre-cierres, dotaciones) separados de settings:system.

CREATE TABLE IF NOT EXISTS public.petty_cash_week_meta (
  id TEXT PRIMARY KEY DEFAULT 'global',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.petty_cash_week_meta IS
  'Cierres de semana, pre-cierres y dotaciones de caja chica (fuente SQL; KV data:pettyCashMeta).';

ALTER TABLE public.petty_cash_week_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pcm_select_authenticated ON public.petty_cash_week_meta;
DROP POLICY IF EXISTS pcm_insert_authenticated ON public.petty_cash_week_meta;
DROP POLICY IF EXISTS pcm_update_authenticated ON public.petty_cash_week_meta;
DROP POLICY IF EXISTS pcm_delete_admin ON public.petty_cash_week_meta;

CREATE POLICY pcm_select_authenticated ON public.petty_cash_week_meta
  FOR SELECT TO authenticated USING (true);

CREATE POLICY pcm_insert_authenticated ON public.petty_cash_week_meta
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY pcm_update_authenticated ON public.petty_cash_week_meta
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY pcm_delete_admin ON public.petty_cash_week_meta
  FOR DELETE TO authenticated USING (public.current_user_is_admin());

ALTER TABLE public.petty_cash_week_meta REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.petty_cash_week_meta;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
