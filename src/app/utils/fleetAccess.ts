import type { Role } from '../components/users/types';
import type { User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';
import { isAdminAppUser } from '../services/repository/userProfileSync';
import { roleRecordHasModuleAccess } from './rolePermissions';

/** Roles con acceso a Configuración de Flota (plantilla checklist + historial global). */
const FLEET_CONFIG_APP_ROLES = new Set(['super_admin', 'admin', 'manager']);

const RRHH_ROLE_HINTS = ['rrhh', 'recursos humanos', 'recurso humano', 'human resources'];
const GERENCIA_ROLE_HINTS = ['gerencia', 'gerente', 'manager'];

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

function roleTextBlob(user: User, roleRecord?: Role | null): string {
  return [user.role, user.roleLabel, user.nivelNombre, user.jobTitle, roleRecord?.id, roleRecord?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isRrhhFleetRole(user: User, roleRecord?: Role | null): boolean {
  const blob = roleTextBlob(user, roleRecord);
  if (RRHH_ROLE_HINTS.some((h) => blob.includes(h))) return true;
  return Boolean(roleRecord && roleRecordHasModuleAccess(roleRecord, 'Recursos Humanos'));
}

function isGerenciaFleetRole(user: User, roleRecord?: Role | null): boolean {
  const roleId = String(user.role || '').trim().toLowerCase();
  if (roleId === 'manager') return true;
  const blob = roleTextBlob(user, roleRecord);
  return GERENCIA_ROLE_HINTS.some((h) => blob.includes(h));
}

/**
 * Configuración Flota: plantilla de checklist e historial global de inspecciones.
 * Admin / gerencia / RRHH (no operadores de campo).
 */
export function canConfigureFleet(
  user: User | null | undefined,
  rolesOrRecord?: Role[] | Role | null
): boolean {
  if (!user) return false;
  if (isAdminAppUser(user)) return true;

  const email = user.email?.trim().toLowerCase();
  if (email && getSuperAdminEmails().has(email)) return true;

  const roleId = String(user.role || '').trim().toLowerCase();
  if (FLEET_CONFIG_APP_ROLES.has(roleId)) return true;

  const roleRecord = resolveUserRoleRecord(user, rolesOrRecord);
  if (isGerenciaFleetRole(user, roleRecord)) return true;
  if (isRrhhFleetRole(user, roleRecord)) return true;

  return false;
}
