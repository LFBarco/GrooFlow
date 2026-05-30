-- Corrige RLS legacy que no se eliminó en 20260524120000 (nombres incorrectos en DROP).
-- Objetivo: solo políticas colaborativas autenticadas, sin admin-only zombie ni req_/inv_/petty_.

-- ─── purchase_requests (legacy: req_*) ───
DROP POLICY IF EXISTS req_select_secure ON public.purchase_requests;
DROP POLICY IF EXISTS req_insert_secure ON public.purchase_requests;
DROP POLICY IF EXISTS req_update_secure ON public.purchase_requests;
DROP POLICY IF EXISTS req_delete_secure ON public.purchase_requests;
DROP POLICY IF EXISTS purchaserequests_select_collaborative ON public.purchase_requests;
DROP POLICY IF EXISTS purchaserequests_insert_collaborative ON public.purchase_requests;
DROP POLICY IF EXISTS purchaserequests_update_collaborative ON public.purchase_requests;
DROP POLICY IF EXISTS purchaserequests_delete_collaborative ON public.purchase_requests;

CREATE POLICY pr_select_collaborative ON public.purchase_requests
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY pr_insert_collaborative ON public.purchase_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY pr_update_collaborative ON public.purchase_requests
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY pr_delete_collaborative ON public.purchase_requests
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ─── invoices (legacy: inv_*) ───
DROP POLICY IF EXISTS inv_select_secure ON public.invoices;
DROP POLICY IF EXISTS inv_insert_secure ON public.invoices;
DROP POLICY IF EXISTS inv_update_secure ON public.invoices;
DROP POLICY IF EXISTS inv_delete_secure ON public.invoices;
DROP POLICY IF EXISTS invoices_select_collaborative ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_collaborative ON public.invoices;
DROP POLICY IF EXISTS invoices_update_collaborative ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_collaborative ON public.invoices;

CREATE POLICY inv_select_collaborative ON public.invoices
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY inv_insert_collaborative ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY inv_update_collaborative ON public.invoices
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY inv_delete_collaborative ON public.invoices
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ─── petty_cash_transactions (legacy: petty_*) ───
DROP POLICY IF EXISTS petty_select_secure ON public.petty_cash_transactions;
DROP POLICY IF EXISTS petty_insert_secure ON public.petty_cash_transactions;
DROP POLICY IF EXISTS petty_update_secure ON public.petty_cash_transactions;
DROP POLICY IF EXISTS petty_delete_secure ON public.petty_cash_transactions;
DROP POLICY IF EXISTS pettycashtransactions_select_collaborative ON public.petty_cash_transactions;
DROP POLICY IF EXISTS pettycashtransactions_insert_collaborative ON public.petty_cash_transactions;
DROP POLICY IF EXISTS pettycashtransactions_update_collaborative ON public.petty_cash_transactions;
DROP POLICY IF EXISTS pettycashtransactions_delete_collaborative ON public.petty_cash_transactions;

CREATE POLICY pc_select_collaborative ON public.petty_cash_transactions
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY pc_insert_collaborative ON public.petty_cash_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY pc_update_collaborative ON public.petty_cash_transactions
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY pc_delete_collaborative ON public.petty_cash_transactions
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ─── providers ───
DROP POLICY IF EXISTS providers_select_secure ON public.providers;
DROP POLICY IF EXISTS providers_insert_secure ON public.providers;
DROP POLICY IF EXISTS providers_update_secure ON public.providers;
DROP POLICY IF EXISTS providers_delete_secure ON public.providers;
DROP POLICY IF EXISTS providers_select_collaborative ON public.providers;
DROP POLICY IF EXISTS providers_insert_collaborative ON public.providers;
DROP POLICY IF EXISTS providers_update_collaborative ON public.providers;
DROP POLICY IF EXISTS providers_delete_collaborative ON public.providers;

CREATE POLICY prov_select_collaborative ON public.providers
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY prov_insert_collaborative ON public.providers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY prov_update_collaborative ON public.providers
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY prov_delete_collaborative ON public.providers
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ─── app_users ───
DROP POLICY IF EXISTS app_users_select_secure ON public.app_users;
DROP POLICY IF EXISTS app_users_insert_secure ON public.app_users;
DROP POLICY IF EXISTS app_users_update_secure ON public.app_users;
DROP POLICY IF EXISTS app_users_delete_secure ON public.app_users;
DROP POLICY IF EXISTS app_users_write_admin_only ON public.app_users;
DROP POLICY IF EXISTS appusers_select_collaborative ON public.app_users;
DROP POLICY IF EXISTS appusers_insert_collaborative ON public.app_users;
DROP POLICY IF EXISTS appusers_update_collaborative ON public.app_users;
DROP POLICY IF EXISTS appusers_delete_collaborative ON public.app_users;

CREATE POLICY au_select_collaborative ON public.app_users
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY au_insert_collaborative ON public.app_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY au_update_collaborative ON public.app_users
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY au_delete_collaborative ON public.app_users
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ─── roles ───
DROP POLICY IF EXISTS roles_select_secure ON public.roles;
DROP POLICY IF EXISTS roles_insert_secure ON public.roles;
DROP POLICY IF EXISTS roles_update_secure ON public.roles;
DROP POLICY IF EXISTS roles_delete_secure ON public.roles;
DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
DROP POLICY IF EXISTS roles_write_admin_only ON public.roles;
DROP POLICY IF EXISTS roles_select_collaborative ON public.roles;
DROP POLICY IF EXISTS roles_insert_collaborative ON public.roles;
DROP POLICY IF EXISTS roles_update_collaborative ON public.roles;
DROP POLICY IF EXISTS roles_delete_collaborative ON public.roles;

CREATE POLICY role_select_collaborative ON public.roles
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY role_insert_collaborative ON public.roles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY role_update_collaborative ON public.roles
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY role_delete_collaborative ON public.roles
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

ALTER TABLE public.purchase_requests REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.petty_cash_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.providers REPLICA IDENTITY FULL;
ALTER TABLE public.app_users REPLICA IDENTITY FULL;
ALTER TABLE public.roles REPLICA IDENTITY FULL;
