-- Asistencia SQL (parity con grooflow-backend MySQL).
-- Blob settings:asistencia sigue en app_kv; tablas para staff, requisitos, snapshots y contexto.

CREATE TABLE IF NOT EXISTS public.asistencia_meta (
  id TEXT PRIMARY KEY DEFAULT 'default',
  buk JSONB,
  area_keywords JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asistencia_staff (
  id TEXT PRIMARY KEY,
  sede_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  cargo_label TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'administracion',
  rut TEXT,
  usuario_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  is_manager BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asistencia_requirements (
  id TEXT PRIMARY KEY,
  sede_name TEXT NOT NULL,
  area_group TEXT NOT NULL DEFAULT 'global',
  cargo_label TEXT NOT NULL DEFAULT '',
  required_count INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asistencia_sede_profiles (
  sede_name TEXT PRIMARY KEY,
  buk_recinto_code TEXT,
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asistencia_sede_mappings (
  sede_name TEXT PRIMARY KEY,
  buk_recinto_code TEXT NOT NULL,
  buk_recinto_name TEXT,
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asistencia_snapshots (
  id TEXT PRIMARY KEY,
  date_ymd TEXT NOT NULL,
  sede_name TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  working_count INT NOT NULL DEFAULT 0,
  absent_count INT NOT NULL DEFAULT 0,
  late_count INT NOT NULL DEFAULT 0,
  critical_absent_count INT NOT NULL DEFAULT 0,
  total_required INT NOT NULL DEFAULT 0,
  total_present INT NOT NULL DEFAULT 0,
  buk_records_on_date INT NOT NULL DEFAULT 0,
  body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date_ymd, sede_name)
);

CREATE TABLE IF NOT EXISTS public.asistencia_operational (
  id TEXT PRIMARY KEY DEFAULT 'current',
  date_ymd TEXT NOT NULL,
  cache_fetched_at BIGINT,
  buk_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  body JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asistencia_staff_sede ON public.asistencia_staff (sede_name);
CREATE INDEX IF NOT EXISTS idx_asistencia_staff_rut ON public.asistencia_staff (rut);
CREATE INDEX IF NOT EXISTS idx_asistencia_req_sede ON public.asistencia_requirements (sede_name);
CREATE INDEX IF NOT EXISTS idx_asistencia_snap_date ON public.asistencia_snapshots (date_ymd);

ALTER TABLE public.asistencia_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_sede_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_sede_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_operational ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Lectura autenticada; escritura para autenticados (alineado a app_kv compartido).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asistencia_staff' AND policyname = 'asistencia_staff_select'
  ) THEN
    CREATE POLICY asistencia_staff_select ON public.asistencia_staff FOR SELECT TO authenticated USING (true);
    CREATE POLICY asistencia_staff_write ON public.asistencia_staff FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asistencia_requirements' AND policyname = 'asistencia_requirements_select'
  ) THEN
    CREATE POLICY asistencia_requirements_select ON public.asistencia_requirements FOR SELECT TO authenticated USING (true);
    CREATE POLICY asistencia_requirements_write ON public.asistencia_requirements FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asistencia_sede_profiles' AND policyname = 'asistencia_profiles_select'
  ) THEN
    CREATE POLICY asistencia_profiles_select ON public.asistencia_sede_profiles FOR SELECT TO authenticated USING (true);
    CREATE POLICY asistencia_profiles_write ON public.asistencia_sede_profiles FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asistencia_sede_mappings' AND policyname = 'asistencia_mappings_select'
  ) THEN
    CREATE POLICY asistencia_mappings_select ON public.asistencia_sede_mappings FOR SELECT TO authenticated USING (true);
    CREATE POLICY asistencia_mappings_write ON public.asistencia_sede_mappings FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asistencia_snapshots' AND policyname = 'asistencia_snapshots_select'
  ) THEN
    CREATE POLICY asistencia_snapshots_select ON public.asistencia_snapshots FOR SELECT TO authenticated USING (true);
    CREATE POLICY asistencia_snapshots_write ON public.asistencia_snapshots FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asistencia_meta' AND policyname = 'asistencia_meta_select'
  ) THEN
    CREATE POLICY asistencia_meta_select ON public.asistencia_meta FOR SELECT TO authenticated USING (true);
    CREATE POLICY asistencia_meta_write ON public.asistencia_meta FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'asistencia_operational' AND policyname = 'asistencia_operational_select'
  ) THEN
    CREATE POLICY asistencia_operational_select ON public.asistencia_operational FOR SELECT TO authenticated USING (true);
    CREATE POLICY asistencia_operational_write ON public.asistencia_operational FOR ALL TO authenticated
      USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

COMMENT ON TABLE public.asistencia_staff IS 'Personal organigrama Asistencia (sync desde settings:asistencia)';
COMMENT ON TABLE public.asistencia_snapshots IS 'Snapshots diarios de dotación por sede';
