-- Permite registrar último acceso sin permisos admin en app_users.

CREATE OR REPLACE FUNCTION public.touch_own_app_user_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.app_users
  SET last_login = now(), updated_at = now()
  WHERE auth_id = auth.uid();

  IF NOT FOUND THEN
    UPDATE public.app_users
    SET last_login = now(), updated_at = now()
    WHERE id = auth.uid()::text;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_own_app_user_last_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_own_app_user_last_login() TO authenticated;
