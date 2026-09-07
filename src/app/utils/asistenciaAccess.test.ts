import { describe, expect, it } from 'vitest';

import { DEFAULT_ROLES } from '../components/users/types';
import type { User } from '../types';
import {
  canConfigureAsistencia,
  isEncargadoSedeAsistencia,
  isRrhhAsistenciaRole,
} from './asistenciaAccess';

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

  const encargadoUser: User = {
    id: 'u-enc',
    name: 'Encargado',
    initials: 'ES',
    role: 'encargado_sede',
    status: 'active',
    sedes: ['Principal'],
  };

  it('permite configurar a admin y gerencia (manager)', () => {
    expect(
      canConfigureAsistencia({ ...managerUser, role: 'admin' }, DEFAULT_ROLES)
    ).toBe(true);
    expect(canConfigureAsistencia(managerUser, DEFAULT_ROLES)).toBe(true);
  });

  it('permite configurar a rol con permiso Recursos Humanos', () => {
    const rrhhRole = {
      id: 'analista_rrhh',
      name: 'Analista RRHH',
      description: '',
      color: '',
      bgColor: '',
      borderColor: '',
      isSystem: false,
      permissions: { 'Recursos Humanos': true, Asistencia: true },
    };
    expect(isRrhhAsistenciaRole({ ...operatorUser, role: 'analista_rrhh' }, rrhhRole)).toBe(true);
    expect(
      canConfigureAsistencia({ ...operatorUser, role: 'analista_rrhh' }, [...DEFAULT_ROLES, rrhhRole])
    ).toBe(true);
  });

  it('niega configurar a encargado de sede (solo operativa + dashboard)', () => {
    expect(isEncargadoSedeAsistencia(encargadoUser)).toBe(true);
    expect(canConfigureAsistencia(encargadoUser, DEFAULT_ROLES)).toBe(false);
  });

  it('niega configurar a operador sin RRHH/gerencia/admin', () => {
    expect(canConfigureAsistencia(operatorUser, DEFAULT_ROLES)).toBe(false);
  });
});
