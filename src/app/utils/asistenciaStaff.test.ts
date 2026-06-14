import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { buildLiveSedeSummary } from './asistenciaStaff';

describe('asistenciaStaff', () => {
  it('marca ausente si no hay cruce Buk y trabajando si sigue en sede', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: 'SAN ISIDRO',
      fullName: 'Luis Barco',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: true,
      matchArea: 'COUNTER',
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [{ sedeName: 'SAN ISIDRO', bukRecintoCode: 'SANISIDRO' }],
    });

    const absent = buildLiveSedeSummary({
      sedeName: 'SAN ISIDRO',
      settings,
      records: [],
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(absent.absentCount).toBe(1);
    expect(absent.isOperational).toBe(false);

    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '111',
        nombre: 'Luis',
        apellido_paterno: 'Barco',
        codigo_recinto: 'SANISIDRO',
        area: 'COUNTER',
        dia_entrada: '10/06/2026',
        entrada: '2026-06-10T08:05:00Z',
        entrada_format: '08:05',
        salida: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: 'SAN ISIDRO',
      settings,
      records,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(live.workingCount).toBe(1);
    expect(live.isOperational).toBe(true);
    expect(live.areas[0].staff[0]?.status).toBe('trabajando');
  });
});
