-- Transacciones en producción: columnas bancarias, RLS colaborativo, Realtime.

ALTER TABLE IF EXISTS public.transactions
  ADD COLUMN IF NOT EXISTS account TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS operation TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Flujo de caja compartido del centro (como KV global y flota colaborativa).
DROP POLICY IF EXISTS tx_select_secure ON public.transactions;
DROP POLICY IF EXISTS tx_insert_secure ON public.transactions;
DROP POLICY IF EXISTS tx_update_secure ON public.transactions;
DROP POLICY IF EXISTS tx_delete_secure ON public.transactions;

CREATE POLICY tx_select_collaborative ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY tx_insert_collaborative ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY tx_update_collaborative ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY tx_delete_collaborative ON public.transactions
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.transactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_location ON public.transactions (location);
