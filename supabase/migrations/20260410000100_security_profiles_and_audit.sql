-- GrooFlow Security Baseline
-- 1) Perfil canónico de usuario (rol/sedes/estado) ligado a auth.users
-- 2) Log de auditoría básico para acciones administrativas
-- 3) Helpers SQL para validación de permisos desde funciones/consultas

CREATE TABLE IF NOT EXISTS public.app_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'manager',
  sedes TEXT[] NOT NULL DEFAULT '{}',
  all_sedes BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_user_profiles_role_chk CHECK (role IN ('super_admin', 'admin', 'manager', 'analyst')),
  CONSTRAINT app_user_profiles_status_chk CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_actor_user_id ON public.security_audit_logs (actor_user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_app_user_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_app_user_profiles ON public.app_user_profiles;
CREATE TRIGGER trg_set_updated_at_app_user_profiles
BEFORE UPDATE ON public.app_user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_app_user_profiles();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_user_profiles (user_id, role, sedes, all_sedes, status)
  VALUES (NEW.id, 'manager', '{}', FALSE, 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_profile ON auth.users;
CREATE TRIGGER trg_auth_user_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_profile();

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_user_profiles p
    WHERE p.user_id = p_user_id
      AND p.status = 'active'
      AND p.role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_admin_user(auth.uid());
$$;

ALTER TABLE public.app_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_user_profiles_select_self_or_admin ON public.app_user_profiles;
CREATE POLICY app_user_profiles_select_self_or_admin
ON public.app_user_profiles
FOR SELECT
USING (auth.uid() = user_id OR public.current_user_is_admin());

DROP POLICY IF EXISTS app_user_profiles_update_admin_only ON public.app_user_profiles;
CREATE POLICY app_user_profiles_update_admin_only
ON public.app_user_profiles
FOR UPDATE
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS app_user_profiles_insert_admin_only ON public.app_user_profiles;
CREATE POLICY app_user_profiles_insert_admin_only
ON public.app_user_profiles
FOR INSERT
WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS security_audit_logs_select_admin_only ON public.security_audit_logs;
CREATE POLICY security_audit_logs_select_admin_only
ON public.security_audit_logs
FOR SELECT
USING (public.current_user_is_admin());

DROP POLICY IF EXISTS security_audit_logs_insert_admin_only ON public.security_audit_logs;
CREATE POLICY security_audit_logs_insert_admin_only
ON public.security_audit_logs
FOR INSERT
WITH CHECK (public.current_user_is_admin());

-- Backfill perfiles para usuarios existentes (idempotente)
INSERT INTO public.app_user_profiles (user_id, role, sedes, all_sedes, status)
SELECT u.id, 'manager', '{}', FALSE, 'active'
FROM auth.users u
LEFT JOIN public.app_user_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;
