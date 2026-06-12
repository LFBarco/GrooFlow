import type { User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';

/** Super-admins configurados pueden entrar aunque estén marcados inactive en KV/SQL. */
export function isUserSessionBlocked(user: User | null | undefined): boolean {
  if (!user || user.status !== 'inactive') return false;
  const email = user.email?.trim().toLowerCase();
  if (email && getSuperAdminEmails().has(email)) return false;
  return true;
}

/** Política mínima de contraseña (cliente y Edge Functions). */
export function validatePasswordClient(password: string): string | null {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra.';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un número.';
  }
  return null;
}

/** Actualiza lastLogin de la fila en sesión dentro de la lista de usuarios. */
export function stampLastLoginInList(
  users: User[],
  authUserId: string,
  at: string = new Date().toISOString()
): User[] {
  if (!authUserId) return users;
  return users.map((u) => (u.id === authUserId ? { ...u, lastLogin: at } : u));
}
