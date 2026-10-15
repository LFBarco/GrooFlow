import { describe, expect, it } from 'vitest';

import {
  canConfigureFleet,
  canDeleteFleetInspections,
  canViewFleetInspectionHistory,
} from './fleetAccess';
import { isChoferCargoLabel, userToChoferOption } from './fleetChoferOptions';
import type { User } from '../types';
import { DEFAULT_ROLES } from '../components/users/types';

const baseUser = (partial: Partial<User> & Pick<User, 'id' | 'name' | 'role'>): User =>
  ({
    email: `${partial.id}@test.local`,
    initials: 'T',
    status: 'active',
    ...partial,
  }) as User;

describe('fleetAccess', () => {
  it('admin y manager pueden configurar flota', () => {
    expect(canConfigureFleet(baseUser({ id: '1', name: 'A', role: 'admin' }), DEFAULT_ROLES)).toBe(
      true
    );
    expect(canConfigureFleet(baseUser({ id: '2', name: 'M', role: 'manager' }), DEFAULT_ROLES)).toBe(
      true
    );
  });

  it('operador sin rol admin no configura', () => {
    expect(
      canConfigureFleet(baseUser({ id: '3', name: 'O', role: 'operator' }), DEFAULT_ROLES)
    ).toBe(false);
  });

  it('Auditoría, Gerencia y Encargado de sede ven historial aunque no configuren plantilla', () => {
    const auditoria = baseUser({
      id: '41',
      name: 'Barbara',
      role: 'groomer',
      nivelNombre: 'Auditoria',
    });
    const gerencia = baseUser({ id: 'g1', name: 'G', role: 'groomer', nivelNombre: 'Gerencia' });
    const encargado = baseUser({
      id: 'e1',
      name: 'E',
      role: 'groomer',
      nivelNombre: 'Encargado de Sede',
    });
    const operador = baseUser({ id: 'o1', name: 'O', role: 'operator', nivelNombre: 'Operador' });

    expect(canConfigureFleet(auditoria, DEFAULT_ROLES)).toBe(false);
    expect(canViewFleetInspectionHistory(auditoria, DEFAULT_ROLES)).toBe(true);
    expect(canViewFleetInspectionHistory(gerencia, DEFAULT_ROLES)).toBe(true);
    expect(canViewFleetInspectionHistory(encargado, DEFAULT_ROLES)).toBe(true);
    expect(canViewFleetInspectionHistory(operador, DEFAULT_ROLES)).toBe(false);
  });

  it('solo admin de sistema puede borrar inspecciones', () => {
    expect(canDeleteFleetInspections(baseUser({ id: '1', name: 'A', role: 'admin' }))).toBe(true);
    expect(canDeleteFleetInspections(baseUser({ id: '2', name: 'S', role: 'super_admin' }))).toBe(
      true
    );
    expect(
      canDeleteFleetInspections(
        baseUser({ id: '41', name: 'Barbara', role: 'groomer', nivelNombre: 'Auditoria' })
      )
    ).toBe(false);
    expect(
      canDeleteFleetInspections(
        baseUser({ id: 'm', name: 'M', role: 'manager', nivelNombre: 'Gerencia' })
      )
    ).toBe(false);
  });
});

describe('fleetChoferOptions', () => {
  it('detecta cargo chofer', () => {
    expect(isChoferCargoLabel('Chofer')).toBe(true);
    expect(isChoferCargoLabel('Conductor de flota')).toBe(true);
    expect(isChoferCargoLabel('Médico veterinario')).toBe(false);
  });

  it('filtra usuarios por jobTitle chofer', () => {
    const ok = userToChoferOption(
      baseUser({ id: 'u1', name: 'Juan Pérez', role: 'operator', jobTitle: 'Chofer' })
    );
    expect(ok?.fullName).toBe('Juan Pérez');
    const no = userToChoferOption(
      baseUser({ id: 'u2', name: 'Ana', role: 'operator', jobTitle: 'Recepcionista' })
    );
    expect(no).toBeNull();
  });
});
