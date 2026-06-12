import { describe, expect, it } from 'vitest';
import { dedupeUsersByEmail } from './userListMerge';
import {
  sanitizeUserExtraForSql,
  sanitizeUsersForCloud,
} from './sanitizeUsersForCloud';
import type { User } from '../types';

describe('sanitizeUsersForCloud', () => {
  it('quita tempPassword del objeto usuario', () => {
    const users: User[] = [
      {
        id: '1',
        name: 'A',
        role: 'manager',
        initials: 'A',
        status: 'active',
        tempPassword: 'secret',
      },
    ];
    const out = sanitizeUsersForCloud(users);
    expect(out[0].tempPassword).toBeUndefined();
  });

  it('sanitizeUserExtraForSql quita campos sensibles del JSONB', () => {
    const extra = sanitizeUserExtraForSql({
      pettyCashFundEnabled: true,
      tempPassword: 'x',
      password: 'y',
    });
    expect(extra).toEqual({ pettyCashFundEnabled: true });
  });
});

describe('dedupeUsersByEmail', () => {
  it('conserva usuarios sin email por id', () => {
    const users: User[] = [
      { id: 'local-1', name: 'Sin mail', role: 'manager', initials: 'SM', status: 'active' },
      { id: 'u1', name: 'Ana', role: 'manager', initials: 'AN', email: 'a@x.com', status: 'active' },
    ];
    const out = dedupeUsersByEmail(users);
    expect(out).toHaveLength(2);
    expect(out.some((u) => u.id === 'local-1')).toBe(true);
  });
});
