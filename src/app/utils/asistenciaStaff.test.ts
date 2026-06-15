import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { buildLiveSedeSummary, diagnoseStaffBukMatch } from './asistenciaStaff';

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

  it('cruza sede La Molina por nombre de recinto Buk', () => {
    const settings = mergeAsistenciaSettings({
      staff: [
        {
          id: 's1',
          sedeName: 'La Molina',
          fullName: 'Ana Pérez',
          cargoLabel: 'Recepcionista',
          area: 'administracion',
          expectedTime: '08:00',
          isCritical: false,
          rut: '11111111-1',
        },
      ],
      sedeProfiles: [{ sedeName: 'La Molina', scheduleStart: '08:00', scheduleEnd: '18:00' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Ana',
        apellido_paterno: 'Pérez',
        codigo_recinto: 'MOLINA01',
        nombre_recinto: 'Clínica La Molina',
        dia_entrada: '10/06/2026',
        entrada_format: '08:15',
        entrada: '2026-06-10T08:15:00Z',
        salida: null,
      },
    ];
    const live = buildLiveSedeSummary({
      sedeName: 'La Molina',
      settings,
      records,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(live.workingCount).toBe(1);
    expect(live.absentCount).toBe(0);
  });

  it('diagnostica ausente por código recinto incorrecto', () => {
    const staff: AsistenciaStaffMember = {
      id: 's1',
      sedeName: 'La Molina',
      fullName: 'Ana',
      cargoLabel: 'Recepcionista',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
    };
    const settings = mergeAsistenciaSettings({
      staff: [staff],
      sedeProfiles: [{ sedeName: 'La Molina', bukRecintoCode: 'CODIGO_MAL' }],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '111',
        nombre: 'Pedro',
        apellido_paterno: 'Sur',
        codigo_recinto: 'SUR_ONLY',
        nombre_recinto: 'Petmax Sur',
        dia_entrada: '10/06/2026',
        entrada_format: '08:00',
        entrada: '2026-06-10T08:00:00Z',
      },
    ];
    const hint = diagnoseStaffBukMatch({
      staff,
      records,
      sedeName: 'La Molina',
      settings,
      date: new Date('2026-06-10T12:00:00'),
    });
    expect(hint).toBeDefined();
    expect(hint).toMatch(/ninguna coincide|Recintos en Buk|SUR_ONLY/);
  });
});
