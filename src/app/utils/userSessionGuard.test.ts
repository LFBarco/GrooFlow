import { describe, expect, it } from 'vitest';
import {
  isUserSessionBlocked,
  stampLastLoginInList,
  validatePasswordClient,
} from './userSessionGuard';
import type { User } from '../types';

describe('userSessionGuard', () => {
  it('bloquea inactive salvo super-admin configurado', () => {
    const inactive: User = {
      id: '1',
      name: 'X',
      role: 'manager',
      initials: 'X',
      email: 'x@test.com',
      status: 'inactive',
    };
    expect(isUserSessionBlocked(inactive)).toBe(true);
    expect(isUserSessionBlocked({ ...inactive, status: 'active' })).toBe(false);
  });

  it('valida contraseña mínima', () => {
    expect(validatePasswordClient('abc')).toMatch(/8 caracteres/);
    expect(validatePasswordClient('abcdefgh')).toMatch(/número/);
    expect(validatePasswordClient('12345678')).toMatch(/letra/);
    expect(validatePasswordClient('Abcdef12')).toBeNull();
  });

  it('stampa lastLogin solo en fila propia', () => {
    const users: User[] = [
      { id: 'u1', name: 'A', role: 'manager', initials: 'A', status: 'active' },
      { id: 'u2', name: 'B', role: 'manager', initials: 'B', status: 'active' },
    ];
    const out = stampLastLoginInList(users, 'u1', '2026-01-01T00:00:00.000Z');
    expect(out[0].lastLogin).toBe('2026-01-01T00:00:00.000Z');
    expect(out[1].lastLogin).toBeUndefined();
  });
});
