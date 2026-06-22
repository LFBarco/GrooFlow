import type { Role } from '../components/users/types';
import { DEFAULT_ROLES, SYSTEM_MODULES } from '../components/users/types';

const DEFAULT_BY_ID = new Map(DEFAULT_ROLES.map((r) => [r.id, r]));

/**
 * Solo persiste permisos explícitos (true/false) del almacenamiento.
 * Los módulos **omitidos** quedan fuera del objeto para que `roleHasModuleAccess`
 * pueda aplicar compatibilidad (`Finanzas` → hijos, `Compras` / `Requerimientos` → Productos).
 */
function normalizePermissions(perms: Record<string, boolean> | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const m of SYSTEM_MODULES) {
    const v = perms?.[m];
    if (v === true) out[m] = true;
    else if (v === false) out[m] = false;
  }
  return out;
}

/**
 * Rellena módulos nuevos omitidos en roles plantilla (manager, groomer, …).
 * Si el admin marcó explícitamente false, se respeta; si la clave no existía, usa DEFAULT_ROLES.
 */
function mergeRolePermissionsWithDefaults(role: Role): Record<string, boolean> {
  const template = DEFAULT_BY_ID.get(role.id);
  const loaded = role.permissions ?? {};
  const out: Record<string, boolean> = {};

  for (const m of SYSTEM_MODULES) {
    const v = loaded[m];
    if (v === true || v === false) {
      out[m] = v;
      continue;
    }
    const fromTemplate = template?.permissions[m];
    if (fromTemplate === true || fromTemplate === false) {
      out[m] = fromTemplate;
    }
  }
  return out;
}

/** Asegura que roles de sistema nuevos existan y que todos tengan las claves de módulo actuales. */
export function mergeRolesWithDefaults(loaded: Role[] | undefined | null): Role[] {
  const hasLoaded = Array.isArray(loaded) && loaded.length > 0;
  const base = hasLoaded ? [...loaded] : [...DEFAULT_ROLES];
  for (const dr of DEFAULT_ROLES.filter((r) => r.isSystem)) {
    if (!base.some((r) => r.id === dr.id)) base.push(dr);
  }
  return base.map((r) => {
    const template = DEFAULT_BY_ID.get(r.id);
    const permissions = template
      ? mergeRolePermissionsWithDefaults(r)
      : normalizePermissions(r.permissions);
    return { ...r, permissions };
  });
}
