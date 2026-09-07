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
  it('organigrama-first: no duplica usuario vinculado por email', () => {
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
    expect(options[0]?.id).toBe('asist-staff_ou54xkg');
    expect(options[0]?.userId).toBe('19');
    expect(options[0]?.asistenciaStaffId).toBe('staff_ou54xkg');
  });

  it('includeAsistencia false: solo usuarios de Gestión', () => {
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
    expect(options[0]?.id).toBe('user-19');
  });

  it('deduplica por DNI / bukEmployeeId', () => {
    const users = [
      baseUser({
        id: '7',
        name: 'Maria Lopez',
        documentNumber: '44784524',
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
            cargoLabel: 'Médico',
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
    expect(options[0]?.bukEmployeeId).toBe(12);
    expect(options[0]?.documentNumber).toBe('44784524');
    expect(options[0]?.userId).toBe('7');
  });
});

describe('resolveStaffOptionKey', () => {
  it('resuelve por asistenciaStaffId o userId', () => {
    const options = [
      {
        id: 'asist-s1',
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
    expect(resolveStaffOptionKey({ asistenciaStaffId: 's1' }, options)).toBe('asist-s1');
    expect(resolveStaffOptionKey({ userId: '9' }, options)).toBe('asist-s1');
    expect(resolveStaffOptionKey({}, options)).toBe('manual');
  });
});
