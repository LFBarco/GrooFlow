import { describe, expect, it } from 'vitest';

import type { User } from '../types';
import type { AsistenciaStaffMember } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import {
  diagnoseSedeStaff,
  findStaffMatch,
  normalizeStaffDocKey,
  syncBukRecintoCodeInSettings,
  syncStaffFromCollaborators,
  syncStaffFromUsers,
} from './asistenciaStaffSync';

function baseStaff(partial: Partial<AsistenciaStaffMember> & Pick<AsistenciaStaffMember, 'id' | 'fullName'>): AsistenciaStaffMember {
  return {
    sedeName: 'Petmax',
    cargoLabel: 'Colaborador',
    area: 'administracion',
    expectedTime: '08:00',
    isCritical: false,
    ...partial,
  };
}

function baseUser(partial: Partial<User> & Pick<User, 'id' | 'name'>): User {
  return {
    initials: 'XX',
    email: `${partial.id}@test.local`,
    role: 'staff',
    status: 'active',
    sedes: ['Petmax'],
    ...partial,
  };
}

describe('normalizeStaffDocKey', () => {
  it('deja solo dígitos', () => {
    expect(normalizeStaffDocKey('12.345.678-9')).toBe('123456789');
    expect(normalizeStaffDocKey('  00123  ')).toBe('00123');
  });
});

describe('findStaffMatch', () => {
  const staff = [
    baseStaff({ id: 'a', fullName: 'Ana Pérez', usuarioId: 'u1', rut: '11.111.111-1' }),
    baseStaff({ id: 'b', fullName: 'Bruno Díaz', email: 'bruno@x.com', sedeName: 'Petmax' }),
    baseStaff({ id: 'c', fullName: 'Carla Ruiz', sedeName: 'Petmax' }),
  ];

  it('prioriza usuarioId', () => {
    expect(
      findStaffMatch(staff, {
        usuarioId: 'u1',
        documentNumber: '999',
        fullName: 'Otro',
        sedeName: 'Petmax',
      })?.id
    ).toBe('a');
  });

  it('cruza por RUT aunque el nombre difiera', () => {
    expect(
      findStaffMatch(staff, {
        documentNumber: '111111111',
        fullName: 'Ana P.',
        sedeName: 'Otra',
      })?.id
    ).toBe('a');
  });

  it('cruza por email+sede', () => {
    expect(
      findStaffMatch(staff, {
        email: 'bruno@x.com',
        fullName: 'Bruno',
        sedeName: 'Petmax',
      })?.id
    ).toBe('b');
  });

  it('cruza por nombre+sede como último recurso', () => {
    expect(
      findStaffMatch(staff, {
        fullName: 'Carla  Ruiz',
        sedeName: 'Petmax',
      })?.id
    ).toBe('c');
  });
});

describe('syncStaffFromCollaborators', () => {
  it('importa por centro de costo a la sede objetivo sin duplicar RUT', () => {
    const settings = mergeAsistenciaSettings({
      staff: [
        {
          id: 'old',
          sedeName: 'Benavides',
          fullName: 'Luis Antiguo',
          cargoLabel: 'Recepción',
          area: 'administracion',
          expectedTime: '08:00',
          isCritical: false,
          rut: '12345678',
        },
      ],
      costCenterSedeMappings: [{ costCenterCode: '101010', sedeName: 'Benavides' }],
    });
    const employees = [
      {
        bukId: 99,
        fullName: 'Luis Nuevo',
        documentNumber: '12.345.678',
        cargo: 'Recepcionista',
        costCenter: '101010',
        orgAreaParentName: 'Administración',
      },
      {
        bukId: 100,
        fullName: 'Otra Sede',
        documentNumber: '999',
        costCenter: '505050',
        sede: 'La Molina',
      },
    ];
    const result = syncStaffFromCollaborators({
      employees,
      settings,
      sedeNames: ['Benavides'],
      visibleSedes: ['Benavides', 'La Molina'],
    });
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.settings.staff).toHaveLength(1);
    expect(result.settings.staff[0]?.fullName).toBe('Luis Nuevo');
    expect(result.settings.staff[0]?.bukEmployeeId).toBe(99);
    expect(result.settings.staff[0]?.source).toBe('buk_pe');
    expect(result.settings.staff[0]?.homeCostCenterCode).toBe('101010');
  });

  it('agrega colaborador nuevo con id buk_', () => {
    const settings = mergeAsistenciaSettings({ staff: [] });
    const result = syncStaffFromCollaborators({
      employees: [
        {
          bukId: 42,
          fullName: 'Ana Pérez',
          documentNumber: '87654321',
          cargo: 'Veterinaria',
          costCenter: '101010',
          orgAreaParentName: 'Médica',
        },
      ],
      sedeNames: ['Benavides'],
      settings,
      visibleSedes: ['Benavides'],
    });
    expect(result.added).toBe(1);
    expect(result.settings.staff[0]?.id).toBe('buk_42');
    expect(result.settings.staff[0]?.area).toBe('medica');
  });
});

describe('syncStaffFromUsers', () => {
  it('no duplica si ya existe el mismo RUT', () => {
    const settings = mergeAsistenciaSettings({
      staff: [baseStaff({ id: 's1', fullName: 'Luis Antiguo', rut: '12345678', sedeName: 'Petmax' })],
    });
    const users = [
      baseUser({
        id: 'u-luis',
        name: 'Luis Nuevo',
        documentNumber: '12.345.678',
        jobTitle: 'Recepcionista',
        sedes: ['Petmax'],
      }),
    ];
    const result = syncStaffFromUsers({ users, settings, sedeNames: ['Petmax'] });
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.settings.staff).toHaveLength(1);
    expect(result.settings.staff[0]?.fullName).toBe('Luis Nuevo');
    expect(result.settings.staff[0]?.usuarioId).toBe('u-luis');
    expect(result.settings.staff[0]?.cargoLabel).toBe('Recepcionista');
  });

  it('agrega solo si no hay match', () => {
    const settings = mergeAsistenciaSettings({ staff: [] });
    const users = [
      baseUser({ id: 'u2', name: 'Nueva Persona', documentNumber: '87654321', sedes: ['Petmax'] }),
    ];
    const result = syncStaffFromUsers({ users, settings, sedeNames: ['Petmax'] });
    expect(result.added).toBe(1);
    expect(result.settings.staff[0]?.rut).toBeTruthy();
    expect(normalizeStaffDocKey(result.settings.staff[0]?.rut)).toBe('87654321');
  });
});

describe('diagnoseSedeStaff', () => {
  it('detecta sin RUT y nombres duplicados', () => {
    const staff = [
      baseStaff({ id: '1', fullName: 'Ana Pérez' }),
      baseStaff({ id: '2', fullName: 'Ana Perez', rut: '111' }),
      baseStaff({ id: '3', fullName: 'Solo Uno', rut: '222' }),
    ];
    const d = diagnoseSedeStaff(staff);
    expect(d.withoutRut).toHaveLength(1);
    expect(d.duplicateNameGroups).toHaveLength(1);
    expect(d.duplicateNameGroups[0]?.members).toHaveLength(2);
  });

  it('detecta RUT duplicado', () => {
    const staff = [
      baseStaff({ id: '1', fullName: 'A', rut: '11.1' }),
      baseStaff({ id: '2', fullName: 'B', rut: '111' }),
    ];
    const d = diagnoseSedeStaff(staff);
    expect(d.duplicateRutGroups).toHaveLength(1);
  });
});

describe('syncBukRecintoCodeInSettings', () => {
  it('alinea perfil y mapeo', () => {
    const settings = mergeAsistenciaSettings({
      sedeProfiles: [{ sedeName: 'Petmax', scheduleStart: '08:00', scheduleEnd: '18:00' }],
      sedeMappings: [],
    });
    const next = syncBukRecintoCodeInSettings(settings, 'Petmax', 'PETMAX');
    expect(next.sedeProfiles?.find((p) => p.sedeName === 'Petmax')?.bukRecintoCode).toBe('PETMAX');
    expect(next.sedeMappings?.find((m) => m.sedeName === 'Petmax')?.bukRecintoCode).toBe('PETMAX');
  });

  it('limpia código en ambos lados', () => {
    const settings = mergeAsistenciaSettings({
      sedeProfiles: [
        { sedeName: 'Petmax', scheduleStart: '08:00', scheduleEnd: '18:00', bukRecintoCode: 'X' },
      ],
      sedeMappings: [{ sedeName: 'Petmax', bukRecintoCode: 'X' }],
    });
    const next = syncBukRecintoCodeInSettings(settings, 'Petmax', undefined);
    expect(next.sedeProfiles?.find((p) => p.sedeName === 'Petmax')?.bukRecintoCode).toBeUndefined();
    expect(next.sedeMappings?.some((m) => m.sedeName === 'Petmax')).toBe(false);
  });
});
