import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import {
  buildBukMonthlyTrajectory,
  formatLateMinutesLabel,
} from './asistenciaBukMonthlyTrajectory';

describe('asistenciaBukMonthlyTrajectory', () => {
  const staff: AsistenciaStaffMember = {
    id: 's1',
    sedeName: 'SAN ISIDRO',
    fullName: 'Ana Pérez López',
    cargoLabel: 'Recepcionista',
    area: 'administracion',
    expectedTime: '08:00',
    isCritical: false,
    rut: '11111111-1',
  };

  const settings = mergeAsistenciaSettings({
    staff: [staff],
    sedeProfiles: [
      {
        sedeName: 'SAN ISIDRO',
        bukRecintoCode: 'SANISIDRO',
        scheduleStart: '08:00',
        scheduleToleranceMinutes: 10,
      },
    ],
  });

  it('arma grilla del mes con check/ausente y minutos tarde', () => {
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Ana',
        apellido_paterno: 'Pérez',
        apellido_materno: 'López',
        codigo_recinto: 'SANISIDRO',
        dia_entrada: '05/06/2026',
        entrada: '2026-06-05T08:05:00',
        entrada_format: '08:05',
      },
      {
        id: 2,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Ana',
        apellido_paterno: 'Pérez',
        apellido_materno: 'López',
        codigo_recinto: 'SANISIDRO',
        dia_entrada: '06/06/2026',
        entrada: '2026-06-06T09:00:00',
        entrada_format: '09:00',
      },
    ];

    const traj = buildBukMonthlyTrajectory({
      records,
      settings,
      sedeName: 'SAN ISIDRO',
      date: new Date(2026, 5, 15, 12, 0, 0),
      today: new Date(2026, 5, 15, 12, 0, 0),
    });

    expect(traj.daysInMonth).toBe(30);
    expect(traj.rows).toHaveLength(1);
    const row = traj.rows[0]!;
    expect(row.fullName).toMatch(/Ana/i);
    expect(row.days[4]).toBe('present'); // día 5
    expect(row.days[5]).toBe('present'); // día 6
    expect(row.days[6]).toBe('absent'); // día 7 sin marca
    expect(row.days[15]).toBe('future'); // día 16 > hoy 15
    // 09:00 vs 08:00+10 = 50 min tarde
    expect(row.lateMinutesTotal).toBe(50);
  });

  it('formatea minutos tarde', () => {
    expect(formatLateMinutesLabel(0)).toBe('0 min');
    expect(formatLateMinutesLabel(45)).toBe('45 min');
    expect(formatLateMinutesLabel(90)).toBe('1 h 30 min');
  });
});
