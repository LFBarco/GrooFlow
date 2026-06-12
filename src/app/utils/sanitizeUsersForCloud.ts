import type { User } from '../types';

/** No persistir contraseñas temporales ni campos sensibles en KV/SQL. */
export function sanitizeUsersForCloud(users: User[]): User[] {
  return users.map((u) => {
    const { tempPassword: _removed, ...rest } = u;
    return rest as User;
  });
}

/** Limpia `extra` JSONB antes de escribir SQL (legacy con tempPassword embebido). */
export function sanitizeUserExtraForSql(extra: Record<string, unknown>): Record<string, unknown> {
  const { tempPassword: _removed, password: _pwd, ...safe } = extra;
  return safe;
}
