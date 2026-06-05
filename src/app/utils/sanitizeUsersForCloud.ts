import type { User } from '../types';

/** No persistir contraseñas temporales ni campos sensibles en KV/SQL. */
export function sanitizeUsersForCloud(users: User[]): User[] {
  return users.map((u) => {
    const { tempPassword: _removed, ...rest } = u;
    return rest as User;
  });
}
