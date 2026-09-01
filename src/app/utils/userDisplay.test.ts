import { describe, expect, it } from 'vitest';
import { getUserRoleLabel, resolveGrooflowMediaUrl } from './userDisplay';
import type { User } from '../types';

describe('userDisplay', () => {
  it('prefers nivel from Gestión over RBAC role name', () => {
    const user: User = {
      id: '1',
      name: 'Anais Villegas',
      initials: 'AV',
      role: 'groomer',
      nivelNombre: 'Contabilidad',
      roleLabel: 'Contabilidad',
    };
    expect(getUserRoleLabel(user, [{ id: 'groomer', name: 'Groomer', permissions: {} as never }])).toBe(
      'Contabilidad',
    );
  });

  it('resolves uploads to gestion origin on vercel host', () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: { location: { hostname: 'grooflow.vercel.app' } },
      configurable: true,
    });
    expect(resolveGrooflowMediaUrl('/uploads/usuarios/a.jpg')).toBe(
      'https://gestionveterinariagroomers.com/uploads/usuarios/a.jpg',
    );
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
  });
});
