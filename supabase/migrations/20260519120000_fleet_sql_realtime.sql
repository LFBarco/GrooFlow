-- GrooFlow — Flota clínica en tablas SQL + Realtime (Fase 5 + 4)
-- Cada fila guarda el documento completo en `body` (JSONB) + columnas indexadas para RLS.

CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id          TEXT PRIMARY KEY,
  home_base   TEXT,
  body        JSONB NOT NULL,
  user_id     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fleet_maintenance (
  id          TEXT PRIMARY KEY,
  vehicle_id  TEXT NOT NULL,
  location    TEXT,
  body        JSONB NOT NULL,
  user_id     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fleet_fuel_entries (
  id          TEXT PRIMARY KEY,
  vehicle_id  TEXT NOT NULL,
  location    TEXT,
  body        JSONB NOT NULL,
  user_id     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fleet_inspections (
  id          TEXT PRIMARY KEY,
  vehicle_id  TEXT NOT NULL,
  home_base   TEXT,
  body        JSONB NOT NULL,
  user_id     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fleet_checklist (
  id          TEXT PRIMARY KEY DEFAULT 'default',
  sections    JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_home_base ON public.fleet_vehicles (home_base);
CREATE INDEX IF NOT EXISTS idx_fleet_maintenance_location ON public.fleet_maintenance (location);
CREATE INDEX IF NOT EXISTS idx_fleet_fuel_location ON public.fleet_fuel_entries (location);
CREATE INDEX IF NOT EXISTS idx_fleet_inspections_vehicle ON public.fleet_inspections (vehicle_id);

COMMENT ON TABLE public.fleet_vehicles IS 'Flota — vehículos (Fase 5 SQL; migra desde data:fleet KV)';

-- RLS (mismo patrón que transacciones / caja chica)
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_fuel_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fleet_vehicles_select ON public.fleet_vehicles;
DROP POLICY IF EXISTS fleet_vehicles_write ON public.fleet_vehicles;
CREATE POLICY fleet_vehicles_select ON public.fleet_vehicles
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR public.can_access_sede(home_base)
  );
CREATE POLICY fleet_vehicles_write ON public.fleet_vehicles
  FOR ALL TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_is_admin()
    OR (
      user_id = auth.uid()
      AND public.can_access_sede(home_base)
    )
  );

DROP POLICY IF EXISTS fleet_maintenance_select ON public.fleet_maintenance;
DROP POLICY IF EXISTS fleet_maintenance_write ON public.fleet_maintenance;
CREATE POLICY fleet_maintenance_select ON public.fleet_maintenance
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR public.can_access_sede(location)
  );
CREATE POLICY fleet_maintenance_write ON public.fleet_maintenance
  FOR ALL TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid())
  WITH CHECK (
    public.current_user_is_admin()
    OR (user_id = auth.uid() AND public.can_access_sede(location))
  );

DROP POLICY IF EXISTS fleet_fuel_select ON public.fleet_fuel_entries;
DROP POLICY IF EXISTS fleet_fuel_write ON public.fleet_fuel_entries;
CREATE POLICY fleet_fuel_select ON public.fleet_fuel_entries
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR public.can_access_sede(location)
  );
CREATE POLICY fleet_fuel_write ON public.fleet_fuel_entries
  FOR ALL TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid())
  WITH CHECK (
    public.current_user_is_admin()
    OR (user_id = auth.uid() AND public.can_access_sede(location))
  );

DROP POLICY IF EXISTS fleet_inspections_select ON public.fleet_inspections;
DROP POLICY IF EXISTS fleet_inspections_write ON public.fleet_inspections;
CREATE POLICY fleet_inspections_select ON public.fleet_inspections
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = auth.uid()
    OR public.can_access_sede(home_base)
  );
CREATE POLICY fleet_inspections_write ON public.fleet_inspections
  FOR ALL TO authenticated
  USING (public.current_user_is_admin() OR user_id = auth.uid())
  WITH CHECK (
    public.current_user_is_admin()
    OR (user_id = auth.uid() AND public.can_access_sede(home_base))
  );

DROP POLICY IF EXISTS fleet_checklist_select ON public.fleet_checklist;
DROP POLICY IF EXISTS fleet_checklist_write ON public.fleet_checklist;
CREATE POLICY fleet_checklist_select ON public.fleet_checklist
  FOR SELECT TO authenticated USING (true);
CREATE POLICY fleet_checklist_write ON public.fleet_checklist
  FOR ALL TO authenticated
  USING (public.current_user_is_admin() OR auth.uid() IS NOT NULL)
  WITH CHECK (public.current_user_is_admin() OR auth.uid() IS NOT NULL);

-- Realtime (Fase 4)
ALTER TABLE public.fleet_vehicles REPLICA IDENTITY FULL;
ALTER TABLE public.fleet_maintenance REPLICA IDENTITY FULL;
ALTER TABLE public.fleet_fuel_entries REPLICA IDENTITY FULL;
ALTER TABLE public.fleet_inspections REPLICA IDENTITY FULL;
ALTER TABLE public.fleet_checklist REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_vehicles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_maintenance;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_fuel_entries;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_inspections;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_checklist;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
