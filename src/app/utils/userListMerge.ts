import type { User } from '../types';
import { getSuperAdminEmails } from '../config/superAdmins';

/** Prefiere fila de Auth real (UUID) frente a ids sintéticos usr-… / local-… */
function pickBetterRow(a: User, b: User): User {
  const idSynth = (id: string) =>
    id.startsWith('usr-') || id.startsWith('local-') || id === 'guest-pending' || id === 'guest-sync';
  const aBad = idSynth(String(a.id));
  const bBad = idSynth(String(b.id));
  if (aBad && !bBad) return b;
  if (!aBad && bBad) return a;
  const uuidLike = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
  if (uuidLike(String(b.id)) && !uuidLike(String(a.id))) return b;
  if (uuidLike(String(a.id)) && !uuidLike(String(b.id))) return a;
  return String(b.id).length >= String(a.id).length ? b : a;
}

/**
 * Un correo → una fila. Evita duplicados visibles y conflictos KV/Auth.
 */
export function dedupeUsersByEmail(users: User[]): User[] {
  const map = new Map<string, User>();
  for (const u of users) {
    const key = (u.email || '').trim().toLowerCase();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, u);
      continue;
    }
    map.set(key, pickBetterRow(prev, u));
  }
  return Array.from(map.values());
}

export function applySuperAdminRoleFromConfig(users: User[]): User[] {
  const privileged = getSuperAdminEmails();
  return users.map((u) => {
    const email = (u.email || '').toLowerCase();
    if (!privileged.has(email)) return u;
    return {
      ...u,
      role: 'super_admin' as const,
      allSedes: true,
      status: 'active' as const,
    };
  });
}

/**
 * Alinea lista KV con Supabase Auth (mismo email puede tener id usr-… en KV y UUID en Auth).
 */
export function mergeAuthUserIntoUsers(
  list: User[],
  authUser: { id: string; email?: string | null; user_metadata?: { name?: string } }
): User[] {
  const privileged = getSuperAdminEmails();
  const emailRaw = (authUser.email || '').trim();
  const emailLower = emailRaw.toLowerCase();
  if (!emailLower) return list;

  const isPrivileged = privileged.has(emailLower);
  const byId = list.findIndex((u) => u.id === authUser.id);
  if (byId >= 0) {
    return list.map((u, i) =>
      i === byId
        ? ({
            ...u,
            email: emailRaw || u.email,
            name: u.name || authUser.user_metadata?.name || u.name,
            ...(isPrivileged
              ? { role: 'super_admin' as const, allSedes: true, status: 'active' as const }
              : {}),
          } as User)
        : u
    );
  }

  const byEmail = list.findIndex((u) => (u.email || '').toLowerCase() === emailLower);
  if (byEmail >= 0) {
    return list.map((u, i) =>
      i === byEmail
        ? ({
            ...u,
            id: authUser.id,
            email: emailRaw || u.email,
            name: u.name || authUser.user_metadata?.name || u.name,
            ...(isPrivileged
              ? { role: 'super_admin' as const, allSedes: true, status: 'active' as const }
              : {}),
          } as User)
        : u
    );
  }

  const row: User = {
    id: authUser.id,
    email: emailRaw,
    name: authUser.user_metadata?.name || emailRaw.split('@')[0],
    initials: (authUser.user_metadata?.name || emailRaw).slice(0, 2).toUpperCase(),
    role: isPrivileged ? 'super_admin' : 'manager',
    status: 'active',
    lastLogin: new Date().toISOString(),
    ...(isPrivileged ? { allSedes: true } : {}),
  };
  return [...list, row];
}

export function resolveCurrentUserRow(nextUsers: User[], sessionEmail: string | undefined | null): User | null {
  const em = (sessionEmail || '').trim().toLowerCase();
  if (!em) return null;
  return nextUsers.find((u) => (u.email || '').toLowerCase() === em) ?? null;
}
