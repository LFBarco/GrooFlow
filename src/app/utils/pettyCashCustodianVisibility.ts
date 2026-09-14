import type { User } from '../types';
import type { Role } from '../components/users/types';
import { userHasGlobalSedeAccess } from './roleAccess';
import {
  canViewAllPettyCashFunds,
  type PettyCashMenuPermissions,
} from './pettyCashAccess';
import { userHasPettyCashFund } from './pettyCashFund';

/**
 * Puede elegir otros responsables de caja chica (no solo a sí mismo).
 * Auditoría, Contabilidad, Jefes, Gerencia (+ admin).
 */
export function canSelectMultiplePettyCashCustodians(
  user: User | null | undefined,
  roles?: Role[] | null,
  menuPermissions?: PettyCashMenuPermissions
): boolean {
  return canViewAllPettyCashFunds(user, roles, menuPermissions);
}

/** Sedes asignadas al usuario respecto a un catálogo habilitado (nombres normalizados). */
export function userAssignedSedeNames(user: User, enabledCatalog: string[]): string[] {
  const raw = (user.sedes?.length ? user.sedes : user.location ? [user.location] : [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  if (userHasGlobalSedeAccess(user)) {
    return enabledCatalog.length > 0 ? [...enabledCatalog] : raw;
  }
  if (!enabledCatalog.length) return raw;
  return raw.filter((s) => enabledCatalog.includes(s));
}

/**
 * Lista de usuarios que pueden aparecer como "Responsable de Caja Chica".
 * - Quien no tiene permiso elevado: solo él mismo.
 * - Quien sí: responsables con fondo activo cuya sede intersecta con el viewer.
 * - Elevado sin sedes asignadas: todos los fondos (p. ej. Contabilidad).
 */
export function filterPettyCashCustodianUsersForViewer(
  allUsers: User[],
  viewer: User,
  viewerVisibleSedes: string[],
  viewerSeesAllSedes: boolean,
  roles?: Role[] | null,
  menuPermissions?: PettyCashMenuPermissions
): User[] {
  const canPick = canSelectMultiplePettyCashCustodians(viewer, roles, menuPermissions);
  const self = allUsers.find((u) => u.id === viewer.id) ?? viewer;

  if (!canPick) {
    return [self];
  }

  const catalog = viewerVisibleSedes.length > 0 ? viewerVisibleSedes : [];
  const treatAsAllSedes = viewerSeesAllSedes || viewerVisibleSedes.length === 0;

  return allUsers.filter((u) => {
    const hasFund = userHasPettyCashFund(u);
    if (!hasFund) return false;
    if (treatAsAllSedes) return true;
    const custodianSedes = userAssignedSedeNames(u, catalog);
    return custodianSedes.some((s) => viewerVisibleSedes.includes(s));
  });
}
