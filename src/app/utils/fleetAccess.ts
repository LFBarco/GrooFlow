import type { Role } from '../components/users/types';
import type { User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';
import { isAdminAppUser } from '../services/repository/userProfileSync';
import { roleRecordHasModuleAccess } from './rolePermissions';

/** Roles con acceso a Configuración de Flota (plantilla checklist + historial global). */
const FLEET_CONFIG_APP_ROLES = new Set(['super_admin', 'admin', 'manager']);

const RRHH_ROLE_HINTS = ['rrhh', 'recursos humanos', 'recurso humano', 'human resources'];
const GERENCIA_ROLE_HINTS = ['gerencia', 'gerente', 'manager'];
const AUDITORIA_ROLE_HINTS = ['auditoria', 'auditoría', 'auditor'];
const ENCARGADO_SEDE_HINTS = [
  'encargado de sede',
  'encargado sede',
  'encargado_sede',
  'supervisor sede',
  'jefe de sede',
  'jefe sede',
];

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
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

function isAuditoriaFleetRole(user: User, roleRecord?: Role | null): boolean {
  const roleId = String(user.role || '').trim().toLowerCase();
  if (roleId === 'auditoria' || roleId === 'auditor') return true;
  const blob = roleTextBlob(user, roleRecord);
  return AUDITORIA_ROLE_HINTS.some((h) => blob.includes(h.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

function isEncargadoSedeFleetRole(user: User, roleRecord?: Role | null): boolean {
  const roleId = String(user.role || '').trim().toLowerCase();
  if (roleId === 'encargado_sede') return true;
  const blob = roleTextBlob(user, roleRecord);
  return ENCARGADO_SEDE_HINTS.some((h) => blob.includes(h));
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

/**
 * Ver historial de inspecciones por vehículo:
 * admin, configuración flota, Auditoría, Gerencia y Encargado de sede.
 */
export function canViewFleetInspectionHistory(
  user: User | null | undefined,
  rolesOrRecord?: Role[] | Role | null
): boolean {
  if (!user) return false;
  if (canConfigureFleet(user, rolesOrRecord)) return true;
  const roleRecord = resolveUserRoleRecord(user, rolesOrRecord);
  if (isGerenciaFleetRole(user, roleRecord)) return true;
  if (isAuditoriaFleetRole(user, roleRecord)) return true;
  if (isEncargadoSedeFleetRole(user, roleRecord)) return true;
  return false;
}

/** Borrar inspecciones del historial: solo administrador de sistema. */
export function canDeleteFleetInspections(user: User | null | undefined): boolean {
  if (!user) return false;
  return isAdminAppUser(user);
}
