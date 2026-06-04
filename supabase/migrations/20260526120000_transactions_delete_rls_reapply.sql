-- Re-aplica políticas DELETE colaborativas en transactions (por si quedó tx_delete_secure legacy).

DROP POLICY IF EXISTS tx_select_secure ON public.transactions;
DROP POLICY IF EXISTS tx_insert_secure ON public.transactions;
DROP POLICY IF EXISTS tx_update_secure ON public.transactions;
DROP POLICY IF EXISTS tx_delete_secure ON public.transactions;
DROP POLICY IF EXISTS tx_select_collaborative ON public.transactions;
DROP POLICY IF EXISTS tx_insert_collaborative ON public.transactions;
DROP POLICY IF EXISTS tx_update_collaborative ON public.transactions;
DROP POLICY IF EXISTS tx_delete_collaborative ON public.transactions;

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
