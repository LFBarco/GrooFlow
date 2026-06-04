-- Fase 2: RLS por sede (reemplaza políticas colaborativas abiertas) + auditoría insertable por el actor.

-- ─── Auditoría: cualquier usuario autenticado puede registrar su propia acción ───
DROP POLICY IF EXISTS security_audit_logs_insert_admin_only ON public.security_audit_logs;
DROP POLICY IF EXISTS security_audit_logs_insert_actor ON public.security_audit_logs;
CREATE POLICY security_audit_logs_insert_actor ON public.security_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() OR public.current_user_is_admin());

-- ─── Helper: eliminar políticas colaborativas legacy ───
DO $$
DECLARE
  tbl TEXT;
  pol_prefix TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'transactions',
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
    pol_prefix := replace(tbl, '_', '');
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_secure', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert_secure', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update_secure', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete_secure', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || 'select_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || 'insert_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || 'update_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_prefix || 'delete_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tx_select_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tx_insert_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tx_update_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tx_delete_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'pr_select_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'pr_insert_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'pr_update_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'pr_delete_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'inv_select_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'inv_insert_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'inv_update_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'inv_delete_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'pc_select_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'pc_insert_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'pc_update_collaborative', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'pc_delete_collaborative', tbl);
  END LOOP;
END $$;

-- ─── transactions (sede + admin; DELETE por sede para prune colaborativo) ───
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tx_select_collaborative ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_insert_collaborative ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_update_collaborative ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_delete_collaborative ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_select_secure ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_insert_secure ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_update_secure ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS tx_delete_secure ON public.transactions';

    EXECUTE $SQL$
      CREATE POLICY tx_select_secure ON public.transactions
      FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR public.can_access_sede(location)
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY tx_insert_secure ON public.transactions
      FOR INSERT TO authenticated
      WITH CHECK (
        public.current_user_is_admin()
        OR public.can_access_sede(location)
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY tx_update_secure ON public.transactions
      FOR UPDATE TO authenticated
      USING (
        public.current_user_is_admin()
        OR public.can_access_sede(location)
      )
      WITH CHECK (
        public.current_user_is_admin()
        OR public.can_access_sede(location)
      )
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY tx_delete_secure ON public.transactions
      FOR DELETE TO authenticated
      USING (
        public.current_user_is_admin()
        OR public.can_access_sede(location)
      )
    $SQL$;
  END IF;
END $$;

-- ─── providers (catálogo compartido: lectura/escritura autenticados; borrado admin) ───
DO $$
BEGIN
  IF to_regclass('public.providers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS providers_select_secure ON public.providers';
    EXECUTE 'DROP POLICY IF EXISTS providers_insert_secure ON public.providers';
    EXECUTE 'DROP POLICY IF EXISTS providers_update_secure ON public.providers';
    EXECUTE 'DROP POLICY IF EXISTS providers_delete_secure ON public.providers';

    EXECUTE $SQL$
      CREATE POLICY providers_select_secure ON public.providers
      FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY providers_insert_secure ON public.providers
      FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY providers_update_secure ON public.providers
      FOR UPDATE TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY providers_delete_secure ON public.providers
      FOR DELETE TO authenticated USING (public.current_user_is_admin())
    $SQL$;
  END IF;
END $$;

-- ─── purchase_requests, invoices, petty_cash (sede) ───
DO $$
BEGIN
  IF to_regclass('public.purchase_requests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS req_select_secure ON public.purchase_requests';
    EXECUTE 'DROP POLICY IF EXISTS req_insert_secure ON public.purchase_requests';
    EXECUTE 'DROP POLICY IF EXISTS req_update_secure ON public.purchase_requests';
    EXECUTE 'DROP POLICY IF EXISTS req_delete_secure ON public.purchase_requests';

    EXECUTE $SQL$
      CREATE POLICY req_select_secure ON public.purchase_requests
      FOR SELECT TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY req_insert_secure ON public.purchase_requests
      FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY req_update_secure ON public.purchase_requests
      FOR UPDATE TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
      WITH CHECK (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY req_delete_secure ON public.purchase_requests
      FOR DELETE TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS inv_select_secure ON public.invoices';
    EXECUTE 'DROP POLICY IF EXISTS inv_insert_secure ON public.invoices';
    EXECUTE 'DROP POLICY IF EXISTS inv_update_secure ON public.invoices';
    EXECUTE 'DROP POLICY IF EXISTS inv_delete_secure ON public.invoices';

    EXECUTE $SQL$
      CREATE POLICY inv_select_secure ON public.invoices
      FOR SELECT TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY inv_insert_secure ON public.invoices
      FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY inv_update_secure ON public.invoices
      FOR UPDATE TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
      WITH CHECK (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY inv_delete_secure ON public.invoices
      FOR DELETE TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
  END IF;

  IF to_regclass('public.petty_cash_transactions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS petty_select_secure ON public.petty_cash_transactions';
    EXECUTE 'DROP POLICY IF EXISTS petty_insert_secure ON public.petty_cash_transactions';
    EXECUTE 'DROP POLICY IF EXISTS petty_update_secure ON public.petty_cash_transactions';
    EXECUTE 'DROP POLICY IF EXISTS petty_delete_secure ON public.petty_cash_transactions';

    EXECUTE $SQL$
      CREATE POLICY petty_select_secure ON public.petty_cash_transactions
      FOR SELECT TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY petty_insert_secure ON public.petty_cash_transactions
      FOR INSERT TO authenticated
      WITH CHECK (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY petty_update_secure ON public.petty_cash_transactions
      FOR UPDATE TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
      WITH CHECK (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY petty_delete_secure ON public.petty_cash_transactions
      FOR DELETE TO authenticated
      USING (public.current_user_is_admin() OR public.can_access_sede(location))
    $SQL$;
  END IF;
END $$;

-- ─── app_users / roles (directorio y RBAC) ───
DO $$
BEGIN
  IF to_regclass('public.app_users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS app_users_select_secure ON public.app_users';
    EXECUTE 'DROP POLICY IF EXISTS app_users_write_admin_only ON public.app_users';
    EXECUTE $SQL$
      CREATE POLICY app_users_select_secure ON public.app_users
      FOR SELECT TO authenticated
      USING (public.current_user_is_admin() OR auth_id = auth.uid())
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY app_users_write_admin_only ON public.app_users
      FOR ALL TO authenticated
      USING (public.current_user_is_admin())
      WITH CHECK (public.current_user_is_admin())
    $SQL$;
  END IF;

  IF to_regclass('public.roles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS roles_select_authenticated ON public.roles';
    EXECUTE 'DROP POLICY IF EXISTS roles_write_admin_only ON public.roles';
    EXECUTE $SQL$
      CREATE POLICY roles_select_authenticated ON public.roles
      FOR SELECT TO authenticated USING (TRUE)
    $SQL$;
    EXECUTE $SQL$
      CREATE POLICY roles_write_admin_only ON public.roles
      FOR ALL TO authenticated
      USING (public.current_user_is_admin())
      WITH CHECK (public.current_user_is_admin())
    $SQL$;
  END IF;
END $$;

-- ─── Flota: lectura/escritura autenticada (centro compartido; sede en body JSON) ───
-- Mantiene políticas colaborativas de 20260521120000 (ya aplicadas).
