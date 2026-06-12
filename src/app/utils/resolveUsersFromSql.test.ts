import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { User } from '../types';
import { resolveUsersFromSql } from '../services/repository/businessDomainsSql';
import type { SqlLoadResult } from '../services/repository/sqlDomainUtils';

const kvUsers: User[] = [
  { id: 'u1', name: 'Ana', role: 'manager', initials: 'AN', email: 'ana@x.com', status: 'active' },
  { id: 'u2', name: 'Bob', role: 'admin', initials: 'BO', email: 'bob@x.com', status: 'active' },
];

function sqlLoad(users: User[]): () => Promise<SqlLoadResult<User>> {
  return () => Promise.resolve({ ok: true, data: users, empty: users.length === 0 });
}

describe('resolveUsersFromSql', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND', 'supabase');
    vi.stubEnv('VITE_PRODUCTION_SQL', 'true');
  });

  it('no-admin conserva lista KV y solo actualiza su fila desde SQL', async () => {
    const selfSql: User = {
      id: 'u1',
      name: 'Ana SQL',
      role: 'manager',
      initials: 'AN',
      email: 'ana@x.com',
      status: 'active',
      sedes: ['Centro'],
    };
    const result = await resolveUsersFromSql(
      kvUsers,
      sqlLoad([selfSql]),
      async () => true,
      'u1',
      false
    );
    expect(result).toHaveLength(2);
    expect(result.find((u) => u.id === 'u1')?.name).toBe('Ana SQL');
    expect(result.find((u) => u.id === 'u2')?.name).toBe('Bob');
  });

  it('no-admin no reduce lista cuando SQL solo devuelve fila propia', async () => {
    const result = await resolveUsersFromSql(
      kvUsers,
      sqlLoad([{ ...kvUsers[0], sedes: ['Norte'] }]),
      async () => true,
      'u1',
      false
    );
    expect(result.map((u) => u.id).sort()).toEqual(['u1', 'u2']);
  });

  it('admin fusiona SQL con usuarios KV que aún no están en SQL', async () => {
    const sqlOnly: User[] = [
      { id: 'x9', name: 'Solo SQL', role: 'manager', initials: 'SS', email: 's@x.com', status: 'active' },
    ];
    const result = await resolveUsersFromSql(kvUsers, sqlLoad(sqlOnly), async () => true, 'u1', true);
    expect(result.map((u) => u.id).sort()).toEqual(['u1', 'u2', 'x9']);
  });
});
