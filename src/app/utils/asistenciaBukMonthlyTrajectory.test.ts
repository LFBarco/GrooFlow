import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import {
  buildBukMonthlyTrajectory,
  buildMonthDayHeaders,
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

  it('arma headers 1-Set + inicial del día', () => {
    // Sept 2026: día 1 = martes → M
    const headers = buildMonthDayHeaders(2026, 8, 30);
    expect(headers[0]).toEqual({ day: 1, label: '1-Set', weekdayLetter: 'M' });
    expect(headers[5]).toEqual({ day: 6, label: '6-Set', weekdayLetter: 'D' });
  });

  it('✓ solo con entrada + salida; ausente si falta una', () => {
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
        salida: '2026-06-05T17:00:00',
        salida_format: '17:00',
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
        salida: '2026-06-06T18:00:00',
        salida_format: '18:00',
      },
      {
        id: 3,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Ana',
        apellido_paterno: 'Pérez',
        apellido_materno: 'López',
        codigo_recinto: 'SANISIDRO',
        dia_entrada: '07/06/2026',
        entrada: '2026-06-07T08:00:00',
        entrada_format: '08:00',
        // sin salida → ausente
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
    expect(traj.dayHeaders[0]?.label).toBe('1-Jun');
    expect(traj.rows).toHaveLength(1);
    const row = traj.rows[0]!;
    expect(row.fullName).toMatch(/Ana/i);
    expect(row.days[4]).toBe('present'); // día 5
    expect(row.days[5]).toBe('present'); // día 6
    expect(row.days[6]).toBe('absent'); // día 7 solo entrada
    expect(row.days[15]).toBe('future');
    expect(row.lateMinutesTotal).toBe(50);
  });

  it('marca ✓ si entrada y salida vienen en registros distintos del mismo día', () => {
    const records: BukAsistenciaRecord[] = [
      {
        id: 10,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Alberling',
        apellido_paterno: 'Rivas',
        dia_entrada: '17/09/2026',
        entrada: '2026-09-17T08:10:00',
        entrada_format: '08:10',
      },
      {
        id: 11,
        trab_id: 1,
        rut_trabajador: '11111111-1',
        nombre: 'Alberling',
        apellido_paterno: 'Rivas',
        dia_entrada: '17/09/2026',
        salida: '2026-09-17T19:05:00',
        salida_format: '19:05',
      },
    ];
    const traj = buildBukMonthlyTrajectory({
      records,
      settings: mergeAsistenciaSettings({
        staff: [
          {
            ...staff,
            fullName: 'Alberling Rivas',
            rut: '11111111-1',
          },
        ],
        sedeProfiles: settings.sedeProfiles,
      }),
      sedeName: 'SAN ISIDRO',
      date: new Date(2026, 8, 20, 12, 0, 0),
      today: new Date(2026, 8, 25, 12, 0, 0),
    });
    expect(traj.rows[0]?.days[16]).toBe('present');
  });

  it('formatea minutos tarde', () => {
    expect(formatLateMinutesLabel(0)).toBe('0 min');
    expect(formatLateMinutesLabel(45)).toBe('45 min');
    expect(formatLateMinutesLabel(90)).toBe('1 h 30 min');
  });
});
