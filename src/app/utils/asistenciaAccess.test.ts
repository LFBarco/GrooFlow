import { describe, expect, it } from 'vitest';

import { DEFAULT_ROLES } from '../components/users/types';
import type { User } from '../types';
import { canConfigureAsistencia, isJefeLikeRole } from './asistenciaAccess';

describe('asistenciaAccess', () => {
  const managerUser: User = {
    id: 'u-mgr',
    name: 'Gerencia',
    initials: 'GE',
    role: 'manager',
    status: 'active',
    sedes: ['Principal'],
  };

  const operatorUser: User = {
    id: 'u-op',
    name: 'Operador',
    initials: 'OP',
    role: 'groomer',
    status: 'active',
    sedes: ['Principal'],
  };

  it('permite configurar a admin y gerencia (manager)', () => {
    expect(
      canConfigureAsistencia(
        { ...managerUser, role: 'admin' },
        DEFAULT_ROLES
      )
    ).toBe(true);
    expect(canConfigureAsistencia(managerUser, DEFAULT_ROLES)).toBe(true);
  });

  it('permite configurar a rol personalizado tipo jefe con Asistencia', () => {
    const jefeRole = {
      id: 'jefe_area',
      name: 'Jefe de área',
      description: '',
      color: '',
      bgColor: '',
      borderColor: '',
      isSystem: false,
      permissions: { Asistencia: true },
    };
    expect(isJefeLikeRole(jefeRole)).toBe(true);
    expect(
      canConfigureAsistencia({ ...operatorUser, role: 'jefe_area' }, [...DEFAULT_ROLES, jefeRole])
    ).toBe(true);
  });

  it('niega configurar a operador sin rol de jefatura', () => {
    expect(canConfigureAsistencia(operatorUser, DEFAULT_ROLES)).toBe(false);
  });
});
