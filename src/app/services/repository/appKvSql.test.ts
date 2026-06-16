import { describe, expect, it } from 'vitest';

import { mergeSystemSettingsSqlAndKv } from './appKvSql';

describe('mergeSystemSettingsSqlAndKv', () => {
  it('conserva personal de asistencia desde KV aunque SQL no lo tenga', () => {
    const sql = {
      businessName: 'GrooFlow',
      asistencia: {
        buk: { enabled: true },
        requirements: [],
      },
    };
    const kv = {
      businessName: 'GrooFlow',
      asistencia: {
        staff: [
          {
            id: 's1',
            sedeName: 'SAN ISIDRO',
            fullName: 'Luis Barco',
            cargoLabel: 'Recepcionista',
            area: 'administracion' as const,
            expectedTime: '08:00',
            isCritical: true,
          },
        ],
        requirements: [],
      },
    };
    const merged = mergeSystemSettingsSqlAndKv(sql, kv);
    expect(merged.asistencia?.staff).toHaveLength(1);
    expect(merged.asistencia?.staff?.[0]?.fullName).toBe('Luis Barco');
  });

  it('prioriza SQL sobre KV desactualizado al editar personal', () => {
    const sql = {
      asistencia: {
        staff: [
          {
            id: 's1',
            sedeName: '50.- La Molina',
            fullName: 'Farah del Rio',
            cargoLabel: 'Recepcionista',
            area: 'administracion' as const,
            expectedTime: '08:00',
            isCritical: false,
            rut: '44784524',
          },
        ],
        sedeProfiles: [
          {
            sedeName: '50.- La Molina',
            bukRecintoCode: 'Petmax · Petmax Principal',
          },
        ],
        requirements: [],
        sedeMappings: [
          { sedeName: '50.- La Molina', bukRecintoCode: 'Petmax · Petmax Principal' },
        ],
      },
    };
    const kv = {
      asistencia: {
        staff: [
          {
            id: 's1',
            sedeName: '50.- La Molina',
            fullName: 'Farah del Rio',
            cargoLabel: 'Recepcionista',
            area: 'administracion' as const,
            expectedTime: '08:00',
            isCritical: false,
          },
        ],
        sedeProfiles: [],
        requirements: [],
        sedeMappings: [],
      },
    };
    const merged = mergeSystemSettingsSqlAndKv(sql, kv);
    expect(merged.asistencia?.staff?.[0]?.rut).toBe('44784524');
    expect(merged.asistencia?.sedeProfiles?.[0]?.bukRecintoCode).toBe(
      'Petmax · Petmax Principal'
    );
  });
});
