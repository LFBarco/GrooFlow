import { describe, expect, it } from 'vitest';

import type { User } from '../types';
import { buildStaffOptions } from './accidentesData';

const baseUser = (overrides: Partial<User> & Pick<User, 'id' | 'name'>): User => ({
  id: overrides.id,
  name: overrides.name,
  initials: 'AA',
  role: 'groomer',
  email: overrides.email,
  location: overrides.location ?? 'Benavides',
  sedes: overrides.sedes ?? ['Benavides'],
  status: overrides.status ?? 'active',
  ...overrides,
});

describe('buildStaffOptions', () => {
  it('no duplica usuario de Gestión con asistencia del mismo correo', () => {
    const users = [
      baseUser({
        id: '19',
        name: 'Alanies Del Alcazar',
        email: 'alaniesa.groomers@gmail.com',
      }),
    ];
    const options = buildStaffOptions({
      users,
      visibleSedes: ['Benavides'],
      asistencia: {
        staff: [
          {
            id: 'staff_ou54xkg',
            sedeName: 'Benavides',
            fullName: 'Alanies Del Alcazar',
            cargoLabel: 'groomer',
            area: 'administracion',
            expectedTime: '08:00',
            email: 'alaniesa.groomers@gmail.com',
            isCritical: false,
          },
        ],
      },
    });
    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe('user-19');
  });

  it('entrega-uniformes: solo usuarios de Gestión', () => {
    const users = [
      baseUser({
        id: '19',
        name: 'Alanies Del Alcazar',
        email: 'alaniesa.groomers@gmail.com',
      }),
    ];
    const options = buildStaffOptions({
      users,
      visibleSedes: ['Benavides'],
      includeAsistencia: false,
      asistencia: {
        staff: [
          {
            id: 'staff_ou54xkg',
            sedeName: 'Benavides',
            fullName: 'Alanies Del Alcazar',
            cargoLabel: 'groomer',
            area: 'administracion',
            expectedTime: '08:00',
            email: 'alaniesa.groomers@gmail.com',
            isCritical: false,
          },
        ],
      },
    });
    expect(options).toHaveLength(1);
  });
});
