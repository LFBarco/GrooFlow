import type { Role } from '../components/users/types';
import { DEFAULT_ROLES, SYSTEM_MODULES } from '../components/users/types';

/**
 * Solo persiste permisos explícitos (true/false) del almacenamiento.
 * Los módulos **omitidos** quedan fuera del objeto para que `roleHasModuleAccess`
 * pueda aplicar compatibilidad (`Finanzas` → hijos, `Compras` / `Requerimientos` → Productos).
 * Rellenar todo con `false` rompía datos legados que solo tenían `Finanzas: true`
 * (ej. no veían Flujo de Caja en preview/prod con roles viejos).
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

/** Asegura que roles de sistema nuevos existan y que todos tengan las claves de módulo actuales. */
export function mergeRolesWithDefaults(loaded: Role[] | undefined | null): Role[] {
    const hasLoaded = Array.isArray(loaded) && loaded.length > 0;
    // Primera carga (sin datos guardados): usar catálogo completo por defecto.
    const base = hasLoaded ? [...loaded] : [...DEFAULT_ROLES];
    // Cargas siguientes: reinyectar SOLO roles de sistema, no roles editables.
    for (const dr of DEFAULT_ROLES.filter((r) => r.isSystem)) {
        if (!base.some((r) => r.id === dr.id)) base.push(dr);
    }
    return base.map((r) => ({
        ...r,
        permissions: normalizePermissions(r.permissions),
    }));
}
