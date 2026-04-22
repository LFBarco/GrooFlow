import type { User } from '../types';
import type { Role } from '../components/users/types';
import { getSuperAdminEmails } from '../config/superAdmins';
import { canApprovePettyCashMovements } from './pettyCashAudit';

/**
 * Puede elegir otros responsables de caja chica (no solo a sí mismo).
 * Auditoría, administrador (admin), super admin y gerencia (manager).
 */
export function canSelectMultiplePettyCashCustodians(
  user: User | null | undefined,
  roles?: Role[] | null
): boolean {
  if (!user?.role) return false;
  const roleId = String(user.role).trim();
  if (['auditoria', 'admin', 'super_admin', 'manager'].includes(roleId)) return true;
  const em = (user.email || '').trim().toLowerCase();
  if (em && getSuperAdminEmails().has(em)) return true;
  /** Rol personalizado con permisos de auditoría de caja (misma regla que consola). */
  if (canApprovePettyCashMovements(user, roles)) return true;
  return false;
}

/** Sedes asignadas al usuario respecto a un catálogo habilitado (nombres normalizados). */
export function userAssignedSedeNames(user: User, enabledCatalog: string[]): string[] {
  const raw = (user.sedes?.length ? user.sedes : user.location ? [user.location] : [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  if (user.allSedes === true || user.role === 'super_admin') {
    return enabledCatalog.length > 0 ? [...enabledCatalog] : raw;
  }
  if (!enabledCatalog.length) return raw;
  return raw.filter((s) => enabledCatalog.includes(s));
}

/**
 * Lista de usuarios que pueden aparecer como "Responsable de Caja Chica".
 * - Quien no tiene permiso elevado: solo él mismo.
 * - Quien sí: responsables con fondo (`pettyCashLimit > 0`) cuya sede intersecta con `viewerVisibleSedes`,
 *   o todos si `viewerSeesAllSedes` (super / todas las sedes).
 */
export function filterPettyCashCustodianUsersForViewer(
  allUsers: User[],
  viewer: User,
  viewerVisibleSedes: string[],
  viewerSeesAllSedes: boolean,
  roles?: Role[] | null
): User[] {
  const canPick = canSelectMultiplePettyCashCustodians(viewer, roles);
  const self = allUsers.find((u) => u.id === viewer.id) ?? viewer;

  if (!canPick) {
    return [self];
  }

  const catalog = viewerVisibleSedes.length > 0 ? viewerVisibleSedes : ['Principal'];

  return allUsers.filter((u) => {
    const hasFund = (u.pettyCashLimit ?? 0) > 0;
    if (!hasFund) return false;
    if (viewerSeesAllSedes) return true;
    const custodianSedes = userAssignedSedeNames(u, catalog);
    if (!viewerVisibleSedes.length) return u.id === viewer.id;
    return custodianSedes.some((s) => viewerVisibleSedes.includes(s));
  });
}
