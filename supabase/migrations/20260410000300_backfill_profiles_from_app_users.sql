-- Backfill app_user_profiles from app_users when available.
-- Idempotent and safe if app_users does not exist yet.

DO $$
BEGIN
  IF to_regclass('public.app_users') IS NULL THEN
    RAISE NOTICE 'Skipping backfill: public.app_users does not exist.';
    RETURN;
  END IF;

  -- Sync by explicit auth_id mapping
  UPDATE public.app_user_profiles p
  SET
    role = COALESCE(NULLIF(LOWER(u.role), ''), p.role),
    status = CASE
      WHEN LOWER(COALESCE(u.status, 'active')) = 'inactive' THEN 'inactive'
      ELSE 'active'
    END,
    all_sedes = COALESCE(u.all_sedes, p.all_sedes),
    sedes = COALESCE(u.sedes, p.sedes),
    updated_at = now()
  FROM public.app_users u
  WHERE u.auth_id IS NOT NULL
    AND p.user_id = u.auth_id
    AND LOWER(COALESCE(u.role, 'manager')) IN ('super_admin', 'admin', 'manager', 'analyst');

  -- Fallback sync by email if auth_id is null in app_users
  UPDATE public.app_user_profiles p
  SET
    role = COALESCE(NULLIF(LOWER(u.role), ''), p.role),
    status = CASE
      WHEN LOWER(COALESCE(u.status, 'active')) = 'inactive' THEN 'inactive'
      ELSE 'active'
    END,
    all_sedes = COALESCE(u.all_sedes, p.all_sedes),
    sedes = COALESCE(u.sedes, p.sedes),
    updated_at = now()
  FROM public.app_users u
  JOIN auth.users au ON au.email = u.email
  WHERE u.auth_id IS NULL
    AND u.email IS NOT NULL
    AND p.user_id = au.id
    AND LOWER(COALESCE(u.role, 'manager')) IN ('super_admin', 'admin', 'manager', 'analyst');
END
$$;

