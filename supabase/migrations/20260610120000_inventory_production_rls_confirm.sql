-- Confirmación idempotente: inventario de equipos en producción (tablas + RLS autenticado).
-- Aplica si 20260609180000 no llegó al proyecto remoto.

CREATE TABLE IF NOT EXISTS public.inventory_equipment (
  id          TEXT PRIMARY KEY,
  sede        TEXT,
  category    TEXT,
  body        JSONB NOT NULL,
  user_id     UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_maintenance (
  id            TEXT PRIMARY KEY,
  equipment_id  TEXT NOT NULL,
  sede          TEXT,
  body          JSONB NOT NULL,
  user_id       UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_equipment_sede ON public.inventory_equipment (sede);
CREATE INDEX IF NOT EXISTS idx_inventory_equipment_category ON public.inventory_equipment (category);
CREATE INDEX IF NOT EXISTS idx_inventory_maintenance_equipment ON public.inventory_maintenance (equipment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_maintenance_sede ON public.inventory_maintenance (sede);

COMMENT ON TABLE public.inventory_equipment IS 'Inventario — equipos médicos y operativos (migra desde data:inventory KV)';

ALTER TABLE public.inventory_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_equipment_select ON public.inventory_equipment;
DROP POLICY IF EXISTS inventory_equipment_write ON public.inventory_equipment;
DROP POLICY IF EXISTS inventory_equipment_insert ON public.inventory_equipment;
DROP POLICY IF EXISTS inventory_equipment_update ON public.inventory_equipment;
DROP POLICY IF EXISTS inventory_equipment_delete ON public.inventory_equipment;
CREATE POLICY inventory_equipment_select ON public.inventory_equipment
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY inventory_equipment_insert ON public.inventory_equipment
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY inventory_equipment_update ON public.inventory_equipment
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY inventory_equipment_delete ON public.inventory_equipment
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS inventory_maintenance_select ON public.inventory_maintenance;
DROP POLICY IF EXISTS inventory_maintenance_write ON public.inventory_maintenance;
DROP POLICY IF EXISTS inventory_maintenance_insert ON public.inventory_maintenance;
DROP POLICY IF EXISTS inventory_maintenance_update ON public.inventory_maintenance;
DROP POLICY IF EXISTS inventory_maintenance_delete ON public.inventory_maintenance;
CREATE POLICY inventory_maintenance_select ON public.inventory_maintenance
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY inventory_maintenance_insert ON public.inventory_maintenance
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY inventory_maintenance_update ON public.inventory_maintenance
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY inventory_maintenance_delete ON public.inventory_maintenance
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

ALTER TABLE public.inventory_equipment REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_maintenance REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_equipment'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_equipment;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_maintenance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_maintenance;
  END IF;
END $$;
