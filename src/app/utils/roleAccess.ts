import type { User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';

/**
 * Usuario con capacidad de ver/operar sobre todas las sedes (catálogo global)
 * o con privilegio equivalente a administrador del sistema.
 * Alinea con `isSuperAdmin` en App: admin, super_admin, emails de superadmin, allSedes.
 */
export function userHasGlobalSedeAccess(
  user: User | null | undefined
): boolean {
  if (!user) return false;
  if (user.allSedes === true) return true;
  const r = String(user.role || '').trim();
  if (r === 'admin' || r === 'super_admin') return true;
  const em = (user.email || '').trim().toLowerCase();
  if (em && getSuperAdminEmails().has(em)) return true;
  return false;
}
