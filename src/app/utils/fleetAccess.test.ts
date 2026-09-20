import { describe, expect, it } from 'vitest';

import { canConfigureFleet } from './fleetAccess';
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
