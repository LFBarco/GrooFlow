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
});
