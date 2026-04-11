-- GrooFlow: columna concept en transacciones (subcategoría + concepto en el flujo de caja)
-- Ejecutar en SQL Editor o: supabase db push

-- Si la tabla aún no existe, usar el bloque completo de BACKEND_MIGRATION.md (incluye concept).
-- Si transactions ya existe sin concept:

ALTER TABLE IF EXISTS public.transactions
  ADD COLUMN IF NOT EXISTS concept TEXT;

COMMENT ON COLUMN public.transactions.subcategory IS 'Subcategoría (ej. Agua) o concepto legado si concept es NULL';
COMMENT ON COLUMN public.transactions.concept IS 'Concepto/fila (ej. Benavides); si NULL, usar subcategory como fila';
