/**
 * ACL de Caja Chica: nivel Gestión + rol RBAC GrooFlow.
 *
 * Reglas de negocio:
 * 1. Responsable: solo su fondo.
 * 2. Auditoría, Jefes, Gerencia, Contabilidad (+ admin): ven todos los fondos (según sedes).
 * 3. Auditoría (+ admin): aprueba gastos, confirma dotación y refuerzo.
 */
import type { Role } from '../components/users/types';
import type { User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';

const VIEW_ALL_ROLE_IDS = new Set(['auditoria', 'admin', 'super_admin', 'manager']);

/** Niveles / cargos de Gestión que ven todos los fondos asignados. */
const VIEW_ALL_NIVEL_HINTS = [
  'auditor',
  'auditoria',
  'contabilidad',
  'contador',
  'jefes',
  'jefe',
  'gerencia',
  'gerente',
  'manager',
];

/** Quién aprueba / dotación / refuerzo (más estricto que “ver todos”). */
const AUDIT_ROLE_IDS = new Set(['auditoria', 'admin', 'super_admin']);
const AUDIT_NIVEL_HINTS = ['auditor', 'auditoria'];

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolveRoleRecord(user: User, roles?: Role[] | null): Role | undefined {
  if (!roles?.length || !user.role) return undefined;
  return roles.find((r) => r.id === user.role);
}

export function pettyCashIdentityBlob(user: User, roles?: Role[] | null): string {
  const roleRecord = resolveRoleRecord(user, roles);
  return stripAccents(
    [user.role, user.roleLabel, user.nivelNombre, user.jobTitle, roleRecord?.id, roleRecord?.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  );
}

function matchesAnyHint(blob: string, hints: string[]): boolean {
  return hints.some((h) => blob.includes(stripAccents(h)));
}

function isPrivilegedEmail(user: User): boolean {
  const email = (user.email || '').trim().toLowerCase();
  return !!(email && getSuperAdminEmails().has(email));
}

/**
 * Puede ver / seleccionar fondos de otros responsables.
 * Incluye Contabilidad, Jefes y Gerencia por nivel de Gestión.
 */
export function canViewAllPettyCashFunds(
  user: User | null | undefined,
  roles?: Role[] | null
): boolean {
  if (!user) return false;
  if (isPrivilegedEmail(user)) return true;

  const roleId = String(user.role || '').trim().toLowerCase();
  if (VIEW_ALL_ROLE_IDS.has(roleId)) return true;

  const blob = pettyCashIdentityBlob(user, roles);
  if (matchesAnyHint(blob, VIEW_ALL_NIVEL_HINTS)) return true;

  const roleRecord = resolveRoleRecord(user, roles);
  const p = roleRecord?.permissions;
  if (p?.['Auditoría'] === true && p?.['Caja Chica'] === true) return true;
  if (p && Object.keys(p).length > 0 && Object.values(p).every((v) => v === true)) return true;

  return false;
}

/**
 * Aprueba/rechaza, confirma dotación y registra refuerzo.
 * Contabilidad/Jefes/Gerencia ven fondos pero no aprueban (salvo rol RBAC auditoría).
 */
export function canAuditPettyCashFunds(
  user: User | null | undefined,
  roles?: Role[] | null
): boolean {
  if (!user) return false;
  if (isPrivilegedEmail(user)) return true;

  const roleId = String(user.role || '').trim().toLowerCase();
  if (AUDIT_ROLE_IDS.has(roleId)) return true;
  const norm = roleId.replace(/\s+/g, '_');
  if (norm === 'superadministrador' || norm === 'superadmin') return true;

  const blob = pettyCashIdentityBlob(user, roles);
  if (matchesAnyHint(blob, AUDIT_NIVEL_HINTS)) return true;

  const roleRecord = resolveRoleRecord(user, roles);
  const p = roleRecord?.permissions;
  if (p?.['Auditoría'] === true && p?.['Caja Chica'] === true) return true;
  if (p && Object.keys(p).length > 0 && Object.values(p).every((v) => v === true)) return true;

  return false;
}

/** Filtra movimientos visibles según custodio (responsable) o sedes (elevado). */
export function filterPettyCashTransactionsForViewer<
  T extends { custodianId?: string; userId?: string; location?: string },
>(
  transactions: T[],
  viewer: User,
  options: {
    roles?: Role[] | null;
    canSeeSede: (sede: string) => boolean;
  }
): T[] {
  const elevated = canViewAllPettyCashFunds(viewer, options.roles);
  if (!elevated) {
    const vid = String(viewer.id);
    return transactions.filter((t) => {
      const cid = t.custodianId != null ? String(t.custodianId) : '';
      const uid = t.userId != null ? String(t.userId) : '';
      return cid === vid || uid === vid;
    });
  }
  return transactions.filter((t) => !t.location || options.canSeeSede(t.location));
}
