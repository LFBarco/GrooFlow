-- Realtime respeta RLS en SELECT: si un usuario no puede leer la fila, no recibe el evento.
-- Flota clínica es compartida entre usuarios autenticados del centro (como fleet_checklist).

DROP POLICY IF EXISTS fleet_vehicles_select ON public.fleet_vehicles;
CREATE POLICY fleet_vehicles_select ON public.fleet_vehicles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fleet_maintenance_select ON public.fleet_maintenance;
CREATE POLICY fleet_maintenance_select ON public.fleet_maintenance
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fleet_fuel_select ON public.fleet_fuel_entries;
CREATE POLICY fleet_fuel_select ON public.fleet_fuel_entries
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fleet_inspections_select ON public.fleet_inspections;
CREATE POLICY fleet_inspections_select ON public.fleet_inspections
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
