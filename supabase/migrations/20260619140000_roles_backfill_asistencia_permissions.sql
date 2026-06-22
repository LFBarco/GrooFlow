-- Roles guardados antes de añadir Asistencia / Inventario: rellenar claves omitidas
-- según plantilla Gerente (manager) sin pisar true/false explícitos.

UPDATE public.roles r
SET permissions = r.permissions
  || jsonb_build_object(
    'Asistencia', COALESCE((r.permissions->>'Asistencia')::boolean, true),
    'Gestión de Inventario', COALESCE((r.permissions->>'Gestión de Inventario')::boolean, true)
  ),
  updated_at = now()
WHERE r.id = 'manager'
  AND (
    r.permissions->>'Asistencia' IS NULL
    OR r.permissions->>'Gestión de Inventario' IS NULL
  );

-- Otros roles plantilla con defaults distintos
UPDATE public.roles r
SET permissions = r.permissions
  || jsonb_build_object('Asistencia', COALESCE((r.permissions->>'Asistencia')::boolean, false)),
  updated_at = now()
WHERE r.id IN ('auditoria', 'groomer')
  AND r.permissions->>'Asistencia' IS NULL;
