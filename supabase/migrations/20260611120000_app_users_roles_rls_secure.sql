-- Restaura RLS seguro en app_users y roles (revertir políticas colaborativas de 20260610110000).

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
DROP POLICY IF EXISTS au_select_collaborative ON public.app_users;
DROP POLICY IF EXISTS au_insert_collaborative ON public.app_users;
DROP POLICY IF EXISTS au_update_collaborative ON public.app_users;
DROP POLICY IF EXISTS au_delete_collaborative ON public.app_users;

CREATE POLICY app_users_select_secure ON public.app_users
  FOR SELECT TO authenticated
  USING (public.current_user_is_admin() OR auth_id = auth.uid());

CREATE POLICY app_users_write_admin_only ON public.app_users
  FOR ALL TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

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
DROP POLICY IF EXISTS role_select_collaborative ON public.roles;
DROP POLICY IF EXISTS role_insert_collaborative ON public.roles;
DROP POLICY IF EXISTS role_update_collaborative ON public.roles;
DROP POLICY IF EXISTS role_delete_collaborative ON public.roles;

CREATE POLICY roles_select_authenticated ON public.roles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY roles_write_admin_only ON public.roles
  FOR ALL TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
