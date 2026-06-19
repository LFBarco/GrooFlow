import { describe, expect, it } from 'vitest';

import type { User } from '../../types';
import { mergeUserWithSqlProfile, mapSqlRoleToAppRole } from './userProfileSync';

describe('mergeUserWithSqlProfile', () => {
  const baseUser: User = {
    id: 'u1',
    name: 'Encargado Sede',
    initials: 'ES',
    role: 'encargado_sede',
    email: 'encargado@test.com',
    sedes: ['Principal'],
    status: 'active',
  };

  it('preserva rol custom de app_users aunque el perfil SQL sea manager', () => {
    const merged = mergeUserWithSqlProfile(baseUser, {
      role: 'manager',
      status: 'active',
      sedes: ['Principal'],
      all_sedes: false,
    });
    expect(merged.role).toBe('encargado_sede');
  });

  it('aplica sedes y estado inactivo del perfil SQL', () => {
    const merged = mergeUserWithSqlProfile(baseUser, {
      role: 'manager',
      status: 'inactive',
      sedes: ['Norte', 'Sur'],
      all_sedes: true,
    });
    expect(merged.status).toBe('inactive');
    expect(merged.sedes).toEqual(['Norte', 'Sur']);
    expect(merged.allSedes).toBe(true);
  });

  it('mantiene super admin activo aunque el perfil SQL diga inactive', () => {
    const superUser: User = {
      ...baseUser,
      email: 'luisfrancisco.barco@gmail.com',
      role: 'super_admin',
      allSedes: true,
    };
    const merged = mergeUserWithSqlProfile(superUser, {
      role: 'manager',
      status: 'inactive',
      sedes: [],
      all_sedes: false,
    });
    expect(merged.status).toBe('active');
    expect(merged.role).toBe('super_admin');
    expect(merged.allSedes).toBe(true);
  });
});

describe('mapSqlRoleToAppRole', () => {
  it('conserva auditoria como fallback desde analyst', () => {
    expect(mapSqlRoleToAppRole('analyst', 'auditoria')).toBe('auditoria');
  });
});
