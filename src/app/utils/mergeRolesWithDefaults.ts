import type { Role } from '../components/users/types';
import { DEFAULT_ROLES, SYSTEM_MODULES } from '../components/users/types';

/** Solo claves del catálogo actual; valores por defecto false si faltan. */
function normalizePermissions(perms: Record<string, boolean> | undefined): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const m of SYSTEM_MODULES) {
        out[m] = perms?.[m] === true;
    }
    return out;
}

/** Asegura que roles de sistema nuevos existan y que todos tengan las claves de módulo actuales. */
export function mergeRolesWithDefaults(loaded: Role[] | undefined | null): Role[] {
    const base = Array.isArray(loaded) ? [...loaded] : [];
    for (const dr of DEFAULT_ROLES) {
        if (!base.some((r) => r.id === dr.id)) base.push(dr);
    }
    return base.map((r) => ({
        ...r,
        permissions: normalizePermissions(r.permissions),
    }));
}
