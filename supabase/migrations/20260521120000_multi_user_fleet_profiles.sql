-- Multi-usuario: flota compartida, perfiles sincronizables y KV accesible por usuarios autenticados.

-- ─── can_access_sede: sin perfil SQL = acceso (legacy); perfil activo aplica sedes ───
CREATE OR REPLACE FUNCTION public.can_access_sede(p_location TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      p_location IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.app_user_profiles p WHERE p.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.app_user_profiles p
        WHERE p.user_id = auth.uid()
          AND p.status = 'active'
          AND (
            p.role IN ('admin', 'super_admin')
            OR p.all_sedes = TRUE
            OR cardinality(COALESCE(p.sedes, ARRAY[]::TEXT[])) = 0
            OR p_location = ANY(COALESCE(p.sedes, ARRAY[]::TEXT[]))
          )
      )
    );
$$;

-- ─── app_user_profiles: cada usuario puede leer/actualizar su fila; admin gestiona todas ───
DROP POLICY IF EXISTS app_user_profiles_update_admin_only ON public.app_user_profiles;
CREATE POLICY app_user_profiles_update_self_or_admin ON public.app_user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = user_id OR public.current_user_is_admin());

DROP POLICY IF EXISTS app_user_profiles_insert_admin_only ON public.app_user_profiles;
CREATE POLICY app_user_profiles_insert_self_or_admin ON public.app_user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.current_user_is_admin());

-- ─── app_kv: lectura/escritura para cualquier usuario autenticado (blobs compartidos data:*) ───
DO $$
BEGIN
  IF to_regclass('public.app_kv') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS app_kv_select_admin_only ON public.app_kv';
    EXECUTE 'DROP POLICY IF EXISTS app_kv_write_admin_only ON public.app_kv';
    EXECUTE 'DROP POLICY IF EXISTS app_kv_select_authenticated ON public.app_kv';
    EXECUTE 'DROP POLICY IF EXISTS app_kv_write_authenticated ON public.app_kv';
    EXECUTE $p$
      CREATE POLICY app_kv_select_authenticated ON public.app_kv
        FOR SELECT TO authenticated
        USING (auth.uid() IS NOT NULL)
    $p$;
    EXECUTE $p$
      CREATE POLICY app_kv_insert_authenticated ON public.app_kv
        FOR INSERT TO authenticated
        WITH CHECK (auth.uid() IS NOT NULL)
    $p$;
    EXECUTE $p$
      CREATE POLICY app_kv_update_authenticated ON public.app_kv
        FOR UPDATE TO authenticated
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL)
    $p$;
    EXECUTE $p$
      CREATE POLICY app_kv_delete_authenticated ON public.app_kv
        FOR DELETE TO authenticated
        USING (auth.uid() IS NOT NULL)
    $p$;
  END IF;
END $$;

-- ─── Flota clínica: datos compartidos del centro (lectura + escritura colaborativa) ───
DROP POLICY IF EXISTS fleet_vehicles_insert ON public.fleet_vehicles;
DROP POLICY IF EXISTS fleet_vehicles_update ON public.fleet_vehicles;
DROP POLICY IF EXISTS fleet_vehicles_delete ON public.fleet_vehicles;
DROP POLICY IF EXISTS fleet_vehicles_select ON public.fleet_vehicles;
CREATE POLICY fleet_vehicles_select ON public.fleet_vehicles
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY fleet_vehicles_insert ON public.fleet_vehicles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_vehicles_update ON public.fleet_vehicles
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_vehicles_delete ON public.fleet_vehicles
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fleet_maintenance_insert ON public.fleet_maintenance;
DROP POLICY IF EXISTS fleet_maintenance_update ON public.fleet_maintenance;
DROP POLICY IF EXISTS fleet_maintenance_delete ON public.fleet_maintenance;
DROP POLICY IF EXISTS fleet_maintenance_select ON public.fleet_maintenance;
CREATE POLICY fleet_maintenance_select ON public.fleet_maintenance
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY fleet_maintenance_insert ON public.fleet_maintenance
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_maintenance_update ON public.fleet_maintenance
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_maintenance_delete ON public.fleet_maintenance
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fleet_fuel_insert ON public.fleet_fuel_entries;
DROP POLICY IF EXISTS fleet_fuel_update ON public.fleet_fuel_entries;
DROP POLICY IF EXISTS fleet_fuel_delete ON public.fleet_fuel_entries;
DROP POLICY IF EXISTS fleet_fuel_select ON public.fleet_fuel_entries;
CREATE POLICY fleet_fuel_select ON public.fleet_fuel_entries
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY fleet_fuel_insert ON public.fleet_fuel_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_fuel_update ON public.fleet_fuel_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_fuel_delete ON public.fleet_fuel_entries
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fleet_inspections_insert ON public.fleet_inspections;
DROP POLICY IF EXISTS fleet_inspections_update ON public.fleet_inspections;
DROP POLICY IF EXISTS fleet_inspections_delete ON public.fleet_inspections;
DROP POLICY IF EXISTS fleet_inspections_select ON public.fleet_inspections;
CREATE POLICY fleet_inspections_select ON public.fleet_inspections
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY fleet_inspections_insert ON public.fleet_inspections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_inspections_update ON public.fleet_inspections
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_inspections_delete ON public.fleet_inspections
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Backfill perfiles activos para todos los usuarios auth existentes
INSERT INTO public.app_user_profiles (user_id, role, sedes, all_sedes, status)
SELECT u.id, 'manager', '{}', FALSE, 'active'
FROM auth.users u
LEFT JOIN public.app_user_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
