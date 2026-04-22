-- GrooFlow — Tabla KV para la Edge Function `server` (supabase/functions/server/kv_store.tsx)
-- Idempotente: seguro si `app_kv` ya existe (p. ej. por 20260412010000).

CREATE TABLE IF NOT EXISTS public.app_kv (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_kv IS 'Almacén clave/JSON (blobs data:* / settings:*) usado por la función Edge server.';

-- Si existía la tabla legacy de Figma/Make, copiar filas a app_kv (sin pisar claves ya presentes con datos distintos: prioriza destino)
DO $mig$
BEGIN
  IF to_regclass('public.kv_store_674cc941') IS NOT NULL THEN
    INSERT INTO public.app_kv (key, value, updated_at)
    SELECT s.key, s.value, NOW()
    FROM public.kv_store_674cc941 AS s
    ON CONFLICT (key) DO UPDATE
    SET
      value = EXCLUDED.value,
      updated_at = NOW()
    WHERE public.app_kv.value IS DISTINCT FROM EXCLUDED.value;
  END IF;
END
$mig$;
