import type { Role } from '../components/users/types';
import type { User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';
import { isAdminAppUser } from '../services/repository/userProfileSync';
import { roleRecordHasModuleAccess } from './rolePermissions';

/** Roles de app con permiso para configurar personal y sede en Asistencia. */
const ASISTENCIA_CONFIG_APP_ROLES = new Set([
  'super_admin',
  'admin',
  'manager',
  'encargado_sede',
]);

const JEFE_ROLE_HINTS = ['jefe', 'gerencia', 'gerente', 'encargado', 'supervisor', 'manager'];

export function isJefeLikeRole(role: Role | undefined | null): boolean {
  if (!role) return false;
  const hay = `${role.id} ${role.name}`.toLowerCase();
  return JEFE_ROLE_HINTS.some((hint) => hay.includes(hint));
}

/**
 * Puede editar sede, personal y organigrama en el módulo Asistencia
 * (no implica acceso al módulo Configuración global).
 */
export function canConfigureAsistencia(
  user: User | null | undefined,
  roles?: Role[] | null
): boolean {
  if (!user) return false;
  if (isAdminAppUser(user)) return true;

  const email = user.email?.trim().toLowerCase();
  if (email && getSuperAdminEmails().has(email)) return true;

  const roleId = String(user.role || '').trim().toLowerCase();
  if (ASISTENCIA_CONFIG_APP_ROLES.has(roleId)) return true;

  const roleRecord = roles?.find((r) => r.id === user.role);
  if (roleRecord && isJefeLikeRole(roleRecord) && roleRecordHasModuleAccess(roleRecord, 'Asistencia')) {
    return true;
  }

  return false;
}
