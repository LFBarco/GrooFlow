import type { Role } from '../components/users/types';
import type { User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';
import { isAdminAppUser } from '../services/repository/userProfileSync';
import { hasMenuAction, type MenuActionsMap } from './menuActions';
import { roleRecordHasModuleAccess } from './rolePermissions';

/** Roles de app con permiso para configurar sede / organigrama en Asistencia. */
const ASISTENCIA_CONFIG_APP_ROLES = new Set(['super_admin', 'admin', 'manager']);

const RRHH_ROLE_HINTS = ['rrhh', 'recursos humanos', 'recurso humano', 'human resources'];

function resolveUserRoleRecord(
  user: User,
  rolesOrRecord?: Role[] | Role | null
): Role | undefined {
  if (!rolesOrRecord) return undefined;
  if (Array.isArray(rolesOrRecord)) {
    return rolesOrRecord.find((r) => r.id === user.role);
  }
  return rolesOrRecord.id === user.role ? rolesOrRecord : undefined;
}

const GERENCIA_ROLE_HINTS = ['gerencia', 'gerente', 'manager'];

function roleTextBlob(user: User, roleRecord?: Role | null): string {
  return [user.role, user.roleLabel, user.nivelNombre, user.jobTitle, roleRecord?.id, roleRecord?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Encargado / supervisor de sede: ve operativa y dashboard, no configuración. */
export function isEncargadoSedeAsistencia(user: User | null | undefined): boolean {
  if (!user) return false;
  const roleId = String(user.role || '').trim().toLowerCase();
  if (roleId === 'encargado_sede') return true;
  return /encargado|supervisor\s*sede|jefe\s*de\s*sede|jefe\s*sede/.test(roleTextBlob(user));
}

export function isRrhhAsistenciaRole(
  user: User,
  roleRecord?: Role | null
): boolean {
  const blob = roleTextBlob(user, roleRecord);
  if (RRHH_ROLE_HINTS.some((h) => blob.includes(h))) return true;
  return Boolean(roleRecord && roleRecordHasModuleAccess(roleRecord, 'Recursos Humanos'));
}

function isGerenciaAsistenciaRole(user: User, roleRecord?: Role | null): boolean {
  const roleId = String(user.role || '').trim().toLowerCase();
  if (roleId === 'manager') return true;
  const blob = roleTextBlob(user, roleRecord);
  return GERENCIA_ROLE_HINTS.some((h) => blob.includes(h));
}

/**
 * Puede editar sede, personal y organigrama en el módulo Asistencia.
 * Requiere rol autorizado Y (si hay mapa de menú) acción `configurar`.
 * Encargado de sede: no (solo Hoy + Marcaciones).
 */
export function canConfigureAsistencia(
  user: User | null | undefined,
  rolesOrRecord?: Role[] | Role | null,
  options?: { menuActions?: MenuActionsMap | null; isSuperAdmin?: boolean }
): boolean {
  if (!user) return false;
  if (isEncargadoSedeAsistencia(user)) return false;

  if (options?.isSuperAdmin) return true;

  // Perfil de menú: sin «configurar» no edita/mueve (solo operativa).
  if (options?.menuActions != null) {
    if (!hasMenuAction(options.menuActions, 'Asistencia', 'configurar', { isSuperAdmin: false })) {
      return false;
    }
  }

  if (isAdminAppUser(user)) return true;

  const email = user.email?.trim().toLowerCase();
  if (email && getSuperAdminEmails().has(email)) return true;

  const roleId = String(user.role || '').trim().toLowerCase();
  if (ASISTENCIA_CONFIG_APP_ROLES.has(roleId)) return true;

  const roleRecord = resolveUserRoleRecord(user, rolesOrRecord);
  if (isGerenciaAsistenciaRole(user, roleRecord)) return true;
  if (isRrhhAsistenciaRole(user, roleRecord)) return true;

  // Si el menú ya otorgó configurar, permitir aunque el rol no esté en la lista.
  if (
    options?.menuActions != null &&
    hasMenuAction(options.menuActions, 'Asistencia', 'configurar', { isSuperAdmin: false })
  ) {
    return true;
  }

  return false;
}
