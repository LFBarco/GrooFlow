-- GrooFlow - RLS hardening for operational tables
-- Safe to run multiple times. Applies only if target tables exist.

CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS TABLE (role TEXT, sedes TEXT[], all_sedes BOOLEAN, status TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT p.role, p.sedes, p.all_sedes, p.status
  FROM public.app_user_profiles p
  WHERE p.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.can_access_sede(p_location TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_user_profiles p
    WHERE p.user_id = auth.uid()
      AND p.status = 'active'
      AND (
        p.role IN ('admin', 'super_admin')
        OR p.all_sedes = TRUE
        OR p_location IS NULL
        OR cardinality(COALESCE(p.sedes, ARRAY[]::TEXT[])) = 0
        OR p_location = ANY(COALESCE(p.sedes, ARRAY[]::TEXT[]))
      )
  )
$$;

DO $$
BEGIN
  -- transactions
  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_select_secure ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_insert_secure ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_update_secure ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_delete_secure ON public.transactions';
    EXECUTE $SQL$
      CREATE POLICY tx_select_secure
      ON public.transactions
      FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR user_id = auth.uid()
        OR public.can_access_sede(location)
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY tx_insert_secure
      ON public.transactions
      FOR INSERT TO authenticated
      WITH CHECK (
        public.current_user_is_admin()
        OR (
          user_id = auth.uid()
          AND public.can_access_sede(location)
        )
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY tx_update_secure
      ON public.transactions
      FOR UPDATE TO authenticated
      USING (
        public.current_user_is_admin()
        OR user_id = auth.uid()
      )
      WITH CHECK (
        public.current_user_is_admin()
        OR (
          user_id = auth.uid()
          AND public.can_access_sede(location)
        )
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY tx_delete_secure
      ON public.transactions
      FOR DELETE TO authenticated
      USING (
        public.current_user_is_admin()
        OR user_id = auth.uid()
      )
    $SQL$;
  END IF;

  -- providers
  IF to_regclass('public.providers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.providers';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.providers';
    EXECUTE 'DROP POLICY IF EXISTS providers_select_secure ON public.providers';
    EXECUTE 'DROP POLICY IF EXISTS providers_insert_secure ON public.providers';
    EXECUTE 'DROP POLICY IF EXISTS providers_update_secure ON public.providers';
    EXECUTE 'DROP POLICY IF EXISTS providers_delete_secure ON public.providers';
    EXECUTE $SQL$
      CREATE POLICY providers_select_secure
      ON public.providers
      FOR SELECT TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY providers_insert_secure
      ON public.providers
      FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid())
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY providers_update_secure
      ON public.providers
      FOR UPDATE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
      WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid())
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY providers_delete_secure
      ON public.providers
      FOR DELETE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
    $SQL$;
  END IF;

  -- purchase_requests
  IF to_regclass('public.purchase_requests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.purchase_requests';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.purchase_requests';
    EXECUTE 'DROP POLICY IF EXISTS req_select_secure ON public.purchase_requests';
    EXECUTE 'DROP POLICY IF EXISTS req_insert_secure ON public.purchase_requests';
    EXECUTE 'DROP POLICY IF EXISTS req_update_secure ON public.purchase_requests';
    EXECUTE 'DROP POLICY IF EXISTS req_delete_secure ON public.purchase_requests';
    EXECUTE $SQL$
      CREATE POLICY req_select_secure
      ON public.purchase_requests
      FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR user_id = auth.uid()
        OR public.can_access_sede(location)
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY req_insert_secure
      ON public.purchase_requests
      FOR INSERT TO authenticated
      WITH CHECK (
        public.current_user_is_admin()
        OR (user_id = auth.uid() AND public.can_access_sede(location))
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY req_update_secure
      ON public.purchase_requests
      FOR UPDATE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
      WITH CHECK (
        public.current_user_is_admin()
        OR (user_id = auth.uid() AND public.can_access_sede(location))
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY req_delete_secure
      ON public.purchase_requests
      FOR DELETE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
    $SQL$;
  END IF;

  -- invoices
  IF to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.invoices';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.invoices';
    EXECUTE 'DROP POLICY IF EXISTS inv_select_secure ON public.invoices';
    EXECUTE 'DROP POLICY IF EXISTS inv_insert_secure ON public.invoices';
    EXECUTE 'DROP POLICY IF EXISTS inv_update_secure ON public.invoices';
    EXECUTE 'DROP POLICY IF EXISTS inv_delete_secure ON public.invoices';
    EXECUTE $SQL$
      CREATE POLICY inv_select_secure
      ON public.invoices
      FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR user_id = auth.uid()
        OR public.can_access_sede(location)
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY inv_insert_secure
      ON public.invoices
      FOR INSERT TO authenticated
      WITH CHECK (
        public.current_user_is_admin()
        OR (user_id = auth.uid() AND public.can_access_sede(location))
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY inv_update_secure
      ON public.invoices
      FOR UPDATE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
      WITH CHECK (
        public.current_user_is_admin()
        OR (user_id = auth.uid() AND public.can_access_sede(location))
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY inv_delete_secure
      ON public.invoices
      FOR DELETE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
    $SQL$;
  END IF;

  -- petty_cash_transactions
  IF to_regclass('public.petty_cash_transactions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.petty_cash_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.petty_cash_transactions';
    EXECUTE 'DROP POLICY IF EXISTS petty_select_secure ON public.petty_cash_transactions';
    EXECUTE 'DROP POLICY IF EXISTS petty_insert_secure ON public.petty_cash_transactions';
    EXECUTE 'DROP POLICY IF EXISTS petty_update_secure ON public.petty_cash_transactions';
    EXECUTE 'DROP POLICY IF EXISTS petty_delete_secure ON public.petty_cash_transactions';
    EXECUTE $SQL$
      CREATE POLICY petty_select_secure
      ON public.petty_cash_transactions
      FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR user_id = auth.uid()
        OR public.can_access_sede(location)
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY petty_insert_secure
      ON public.petty_cash_transactions
      FOR INSERT TO authenticated
      WITH CHECK (
        public.current_user_is_admin()
        OR (user_id = auth.uid() AND public.can_access_sede(location))
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY petty_update_secure
      ON public.petty_cash_transactions
      FOR UPDATE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
      WITH CHECK (
        public.current_user_is_admin()
        OR (user_id = auth.uid() AND public.can_access_sede(location))
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY petty_delete_secure
      ON public.petty_cash_transactions
      FOR DELETE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
    $SQL$;
  END IF;

  -- requisitions
  IF to_regclass('public.requisitions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.requisitions';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.requisitions';
    EXECUTE 'DROP POLICY IF EXISTS reqs_select_secure ON public.requisitions';
    EXECUTE 'DROP POLICY IF EXISTS reqs_insert_secure ON public.requisitions';
    EXECUTE 'DROP POLICY IF EXISTS reqs_update_secure ON public.requisitions';
    EXECUTE 'DROP POLICY IF EXISTS reqs_delete_secure ON public.requisitions';
    EXECUTE $SQL$
      CREATE POLICY reqs_select_secure
      ON public.requisitions
      FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR user_id = auth.uid()
        OR public.can_access_sede(location)
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY reqs_insert_secure
      ON public.requisitions
      FOR INSERT TO authenticated
      WITH CHECK (
        public.current_user_is_admin()
        OR (user_id = auth.uid() AND public.can_access_sede(location))
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY reqs_update_secure
      ON public.requisitions
      FOR UPDATE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
      WITH CHECK (
        public.current_user_is_admin()
        OR (user_id = auth.uid() AND public.can_access_sede(location))
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY reqs_delete_secure
      ON public.requisitions
      FOR DELETE TO authenticated
      USING (public.current_user_is_admin() OR user_id = auth.uid())
    $SQL$;
  END IF;

  -- app_users (directory of users)
  IF to_regclass('public.app_users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.app_users';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.app_users';
    EXECUTE 'DROP POLICY IF EXISTS app_users_select_secure ON public.app_users';
    EXECUTE 'DROP POLICY IF EXISTS app_users_write_admin_only ON public.app_users';
    EXECUTE $SQL$
      CREATE POLICY app_users_select_secure
      ON public.app_users
      FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR auth_id = auth.uid()
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY app_users_write_admin_only
      ON public.app_users
      FOR ALL TO authenticated
      USING (public.current_user_is_admin())
      WITH CHECK (public.current_user_is_admin())
    $SQL$;
  END IF;

  -- roles
  IF to_regclass('public.roles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.roles';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.roles';
    EXECUTE 'DROP POLICY IF EXISTS roles_select_authenticated ON public.roles';
    EXECUTE 'DROP POLICY IF EXISTS roles_write_admin_only ON public.roles';
    EXECUTE $SQL$
      CREATE POLICY roles_select_authenticated
      ON public.roles
      FOR SELECT TO authenticated
      USING (TRUE)
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY roles_write_admin_only
      ON public.roles
      FOR ALL TO authenticated
      USING (public.current_user_is_admin())
      WITH CHECK (public.current_user_is_admin())
    $SQL$;
  END IF;

  -- app_kv
  IF to_regclass('public.app_kv') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.app_kv ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_read" ON public.app_kv';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_write" ON public.app_kv';
    EXECUTE 'DROP POLICY IF EXISTS app_kv_select_admin_only ON public.app_kv';
    EXECUTE 'DROP POLICY IF EXISTS app_kv_write_admin_only ON public.app_kv';
    EXECUTE $SQL$
      CREATE POLICY app_kv_select_admin_only
      ON public.app_kv
      FOR SELECT TO authenticated
      USING (public.current_user_is_admin())
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY app_kv_write_admin_only
      ON public.app_kv
      FOR ALL TO authenticated
      USING (public.current_user_is_admin())
      WITH CHECK (public.current_user_is_admin())
    $SQL$;
  END IF;
END
$$;
