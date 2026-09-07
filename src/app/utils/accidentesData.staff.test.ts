import { describe, expect, it } from 'vitest';

import type { User } from '../types';
import { buildStaffOptions, resolveStaffOptionKey } from './accidentesData';

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
  it('Gestión-first: una ficha con cargo de Gestión y ids de Asistencia', () => {
    const users = [
      baseUser({
        id: '19',
        name: 'Alanies Del Alcazar',
        email: 'alaniesa.groomers@gmail.com',
        jobTitle: 'Groomer Senior',
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
    expect(options[0]?.userId).toBe('19');
    expect(options[0]?.asistenciaStaffId).toBe('staff_ou54xkg');
    expect(options[0]?.jobTitle).toBe('Groomer Senior');
  });

  it('includeAsistencia false: solo usuarios de Gestión', () => {
    const users = [
      baseUser({
        id: '19',
        name: 'Alanies Del Alcazar',
        email: 'alaniesa.groomers@gmail.com',
        jobTitle: 'Counter',
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
    expect(options[0]?.id).toBe('user-19');
    expect(options[0]?.jobTitle).toBe('Counter');
    expect(options[0]?.asistenciaStaffId).toBeUndefined();
  });

  it('deduplica por DNI / usuario y prioriza cargo Gestión', () => {
    const users = [
      baseUser({
        id: '7',
        name: 'Maria Lopez',
        documentNumber: '44784524',
        jobTitle: 'Médico veterinario',
      }),
    ];
    const options = buildStaffOptions({
      users,
      visibleSedes: ['Benavides'],
      asistencia: {
        staff: [
          {
            id: 'buk_12',
            sedeName: 'Benavides',
            fullName: 'Maria Lopez',
            cargoLabel: 'Médico Buk',
            area: 'medica',
            expectedTime: '08:00',
            rut: '44784524',
            bukEmployeeId: 12,
            usuarioId: '7',
            isCritical: false,
          },
        ],
      },
    });
    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe('user-7');
    expect(options[0]?.bukEmployeeId).toBe(12);
    expect(options[0]?.documentNumber).toBe('44784524');
    expect(options[0]?.userId).toBe('7');
    expect(options[0]?.jobTitle).toBe('Médico veterinario');
  });
});

describe('resolveStaffOptionKey', () => {
  it('resuelve por userId o asistenciaStaffId', () => {
    const options = [
      {
        id: 'user-9',
        asistenciaStaffId: 's1',
        userId: '9',
        label: 'Ana',
        name: 'Ana',
        jobTitle: 'Counter',
        workArea: 'Administración',
        contractType: 'Planta',
        homeSede: 'Benavides',
        seniorityMonths: 0,
      },
    ];
    expect(resolveStaffOptionKey({ asistenciaStaffId: 's1' }, options)).toBe('user-9');
    expect(resolveStaffOptionKey({ userId: '9' }, options)).toBe('user-9');
    expect(resolveStaffOptionKey({}, options)).toBe('manual');
  });
});
