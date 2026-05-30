-- Perfil propio: upsert sin fricción RLS (flota / Realtime multi-usuario).

DROP POLICY IF EXISTS app_user_profiles_update_admin_only ON public.app_user_profiles;
DROP POLICY IF EXISTS app_user_profiles_insert_admin_only ON public.app_user_profiles;
DROP POLICY IF EXISTS app_user_profiles_update_self_or_admin ON public.app_user_profiles;
DROP POLICY IF EXISTS app_user_profiles_insert_self_or_admin ON public.app_user_profiles;

CREATE POLICY app_user_profiles_update_self_or_admin ON public.app_user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = user_id OR public.current_user_is_admin());

CREATE POLICY app_user_profiles_insert_self_or_admin ON public.app_user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.current_user_is_admin());

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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.app_user_profiles (user_id, role, sedes, all_sedes, status)
  VALUES (
    auth.uid(),
    COALESCE(NULLIF(trim(p_role), ''), 'manager'),
    COALESCE(p_sedes, '{}'),
    COALESCE(p_all_sedes, FALSE),
    COALESCE(NULLIF(trim(p_status), ''), 'active')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    sedes = EXCLUDED.sedes,
    all_sedes = EXCLUDED.all_sedes,
    status = EXCLUDED.status,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_own_app_user_profile(TEXT, TEXT[], BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_own_app_user_profile(TEXT, TEXT[], BOOLEAN, TEXT) TO authenticated;

-- Flota: lectura/escritura colaborativa (Realtime entre usuarios del centro).
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

DROP POLICY IF EXISTS fleet_checklist_write ON public.fleet_checklist;
CREATE POLICY fleet_checklist_write ON public.fleet_checklist
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
