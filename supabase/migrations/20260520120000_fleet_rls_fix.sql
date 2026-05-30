-- Fix: políticas fleet demasiado estrictas (can_access_sede en INSERT bloqueaba guardado
-- si el perfil SQL no coincide con la sede del vehículo). Alinear con providers.

DROP POLICY IF EXISTS fleet_vehicles_write ON public.fleet_vehicles;
CREATE POLICY fleet_vehicles_insert ON public.fleet_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY fleet_vehicles_update ON public.fleet_vehicles
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid())
  WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY fleet_vehicles_delete ON public.fleet_vehicles
  FOR DELETE TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS fleet_maintenance_write ON public.fleet_maintenance;
CREATE POLICY fleet_maintenance_insert ON public.fleet_maintenance
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY fleet_maintenance_update ON public.fleet_maintenance
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid())
  WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY fleet_maintenance_delete ON public.fleet_maintenance
  FOR DELETE TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS fleet_fuel_write ON public.fleet_fuel_entries;
CREATE POLICY fleet_fuel_insert ON public.fleet_fuel_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY fleet_fuel_update ON public.fleet_fuel_entries
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid())
  WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY fleet_fuel_delete ON public.fleet_fuel_entries
  FOR DELETE TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS fleet_inspections_write ON public.fleet_inspections;
CREATE POLICY fleet_inspections_insert ON public.fleet_inspections
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY fleet_inspections_update ON public.fleet_inspections
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid())
  WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY fleet_inspections_delete ON public.fleet_inspections
  FOR DELETE TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid());

-- Lectura: dueño, admin o sede visible (multi-usuario mismo centro)
DROP POLICY IF EXISTS fleet_vehicles_select ON public.fleet_vehicles;
CREATE POLICY fleet_vehicles_select ON public.fleet_vehicles
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR home_base IS NULL
    OR public.can_access_sede(home_base)
  );

DROP POLICY IF EXISTS fleet_maintenance_select ON public.fleet_maintenance;
CREATE POLICY fleet_maintenance_select ON public.fleet_maintenance
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR location IS NULL
    OR public.can_access_sede(location)
  );

DROP POLICY IF EXISTS fleet_fuel_select ON public.fleet_fuel_entries;
CREATE POLICY fleet_fuel_select ON public.fleet_fuel_entries
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR location IS NULL
    OR public.can_access_sede(location)
  );

DROP POLICY IF EXISTS fleet_inspections_select ON public.fleet_inspections;
CREATE POLICY fleet_inspections_select ON public.fleet_inspections
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR home_base IS NULL
    OR public.can_access_sede(home_base)
  );
