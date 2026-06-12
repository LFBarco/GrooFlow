-- Evita que usuarios no admin escalen rol vía upsert_own_app_user_profile (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.upsert_own_app_user_profile(
  p_role TEXT,
  p_sedes TEXT[],
  p_all_sedes BOOLEAN,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_existing_role TEXT;
  v_existing_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role, status
  INTO v_existing_role, v_existing_status
  FROM public.app_user_profiles
  WHERE user_id = auth.uid();

  IF public.current_user_is_admin() THEN
    v_role := COALESCE(NULLIF(trim(p_role), ''), COALESCE(v_existing_role, 'manager'));
  ELSE
    v_role := COALESCE(v_existing_role, 'manager');
  END IF;

  INSERT INTO public.app_user_profiles (user_id, role, sedes, all_sedes, status)
  VALUES (
    auth.uid(),
    v_role,
    COALESCE(p_sedes, '{}'),
    COALESCE(p_all_sedes, FALSE),
    CASE
      WHEN public.current_user_is_admin() THEN COALESCE(NULLIF(trim(p_status), ''), COALESCE(v_existing_status, 'active'))
      ELSE COALESCE(v_existing_status, COALESCE(NULLIF(trim(p_status), ''), 'active'))
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = CASE
      WHEN public.current_user_is_admin() THEN EXCLUDED.role
      ELSE public.app_user_profiles.role
    END,
    sedes = EXCLUDED.sedes,
    all_sedes = EXCLUDED.all_sedes,
    status = CASE
      WHEN public.current_user_is_admin() THEN EXCLUDED.status
      ELSE public.app_user_profiles.status
    END,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_own_app_user_profile(TEXT, TEXT[], BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_own_app_user_profile(TEXT, TEXT[], BOOLEAN, TEXT) TO authenticated;
