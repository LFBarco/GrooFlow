-- Confirmación idempotente: flota colaborativa en producción (lectura/escritura autenticada).
-- Aplica si migraciones anteriores no llegaron al proyecto remoto.

DROP POLICY IF EXISTS fleet_vehicles_insert ON public.fleet_vehicles;
DROP POLICY IF EXISTS fleet_vehicles_update ON public.fleet_vehicles;
DROP POLICY IF EXISTS fleet_vehicles_delete ON public.fleet_vehicles;
DROP POLICY IF EXISTS fleet_vehicles_select ON public.fleet_vehicles;
DROP POLICY IF EXISTS fleet_vehicles_write ON public.fleet_vehicles;
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
DROP POLICY IF EXISTS fleet_maintenance_write ON public.fleet_maintenance;
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
DROP POLICY IF EXISTS fleet_fuel_write ON public.fleet_fuel_entries;
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
DROP POLICY IF EXISTS fleet_inspections_write ON public.fleet_inspections;
CREATE POLICY fleet_inspections_select ON public.fleet_inspections
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY fleet_inspections_insert ON public.fleet_inspections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_inspections_update ON public.fleet_inspections
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_inspections_delete ON public.fleet_inspections
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fleet_checklist_select ON public.fleet_checklist;
DROP POLICY IF EXISTS fleet_checklist_write ON public.fleet_checklist;
CREATE POLICY fleet_checklist_select ON public.fleet_checklist
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY fleet_checklist_insert ON public.fleet_checklist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_checklist_update ON public.fleet_checklist
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fleet_checklist_delete ON public.fleet_checklist
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
