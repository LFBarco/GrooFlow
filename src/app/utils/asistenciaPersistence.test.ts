import { describe, expect, it } from 'vitest';

import { mergeSystemSettings } from '../data/initialData';
import {
  patchAsistenciaSettings,
  resolveAsistenciaSettings,
  stripAsistenciaForSystemKv,
} from './asistenciaPersistence';

describe('patchAsistenciaSettings', () => {
  it('no borra personal si el parche trae staff vacío (props desactualizadas)', () => {
    const current = mergeSystemSettings({
      asistencia: {
        staff: [
          {
            id: 's1',
            sedeName: '50.- La Molina',
            fullName: 'Farah',
            cargoLabel: 'Recepcionista',
            area: 'administracion',
            expectedTime: '08:00',
            isCritical: false,
          },
        ],
        requirements: [],
      },
    }).asistencia!;

    const patched = patchAsistenciaSettings(current, {
      buk: { enabled: true },
      staff: [],
    });

    expect(patched.staff).toHaveLength(1);
    expect(patched.buk?.enabled).toBe(true);
  });
});

describe('stripAsistenciaForSystemKv', () => {
  it('excluye asistencia del blob settings:system', () => {
    const settings = mergeSystemSettings({
      businessName: 'Petmax',
      asistencia: { staff: [{ id: '1' } as never], requirements: [] },
    });
    const stripped = stripAsistenciaForSystemKv(settings);
    expect(stripped.businessName).toBe('Petmax');
    expect(stripped.asistencia).toBeUndefined();
  });
});

describe('resolveAsistenciaSettings', () => {
  it('conserva personal legacy si la clave dedicada aún no existe', () => {
    const legacy = {
      staff: [
        {
          id: 's1',
          sedeName: '50.- La Molina',
          fullName: 'Luis',
          cargoLabel: 'Recepcionista',
          area: 'administracion' as const,
          expectedTime: '08:00',
          isCritical: false,
        },
      ],
      requirements: [],
    };
    const resolved = resolveAsistenciaSettings(null, legacy);
    expect(resolved.staff).toHaveLength(1);
    expect(resolved.staff?.[0]?.fullName).toBe('Luis');
  });

  it('prioriza sede dedicada sobre legacy', () => {
    const legacy = {
      sedeProfiles: [{ sedeName: 'Vieja', bukRecintoCode: 'X' }],
      requirements: [],
    };
    const dedicated = {
      sedeProfiles: [{ sedeName: '50.- La Molina', bukRecintoCode: 'Petmax · Petmax Principal' }],
      requirements: [],
    };
    const resolved = resolveAsistenciaSettings(dedicated, legacy);
    expect(resolved.sedeProfiles?.find((p) => p.sedeName === '50.- La Molina')?.bukRecintoCode).toBe(
      'Petmax · Petmax Principal'
    );
  });
});
