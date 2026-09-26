import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffMember } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { applyBukTurnosToAsistenciaStaff } from './asistenciaBukTurnos';

describe('asistenciaBukTurnos', () => {
  const baseStaff = (partial: Partial<AsistenciaStaffMember>): AsistenciaStaffMember => ({
    id: 's1',
    sedeName: 'SAN ISIDRO',
    fullName: 'Alberling Rivas',
    cargoLabel: 'Enfermero',
    area: 'medica',
    expectedTime: '08:00',
    shift: 'day',
    isCritical: false,
    rut: '12345678',
    ...partial,
  });

  it('aplica turno noche 19:00-08:00 y no pisa si hay override manual', () => {
    const settings = mergeAsistenciaSettings({
      staff: [
        baseStaff({}),
        baseStaff({
          id: 's2',
          rut: '87654321',
          fullName: 'Manual Override',
          shift: 'day',
          expectedTime: '09:00',
          shiftManualOverride: true,
        }),
      ],
    });

    const result = applyBukTurnosToAsistenciaStaff(settings, [
      {
        dni: '12345678',
        nombreTurno: 'Turno Noche Clínica',
        horarioTurno: '19:00-08:00',
        idTurno: 'N1',
      },
      {
        dni: '87654321',
        nombreTurno: 'Turno Noche Clínica',
        horarioTurno: '19:00-08:00',
        idTurno: 'N1',
      },
    ]);

    expect(result.matched).toBe(2);
    expect(result.updated).toBe(2);
    const auto = result.settings.staff.find((s) => s.id === 's1')!;
    expect(auto.shift).toBe('night');
    expect(auto.expectedTimeNight).toBe('19:00');
    expect(auto.bukTurnoNombre).toBe('Turno Noche Clínica');
    expect(auto.bukTurnoHorario).toBe('19:00-08:00');

    const manual = result.settings.staff.find((s) => s.id === 's2')!;
    expect(manual.shift).toBe('day');
    expect(manual.expectedTime).toBe('09:00');
    expect(manual.bukTurnoNombre).toBe('Turno Noche Clínica');
  });

  it('infiere diurno 08:00-19:00', () => {
    const settings = mergeAsistenciaSettings({
      staff: [baseStaff({})],
    });
    const result = applyBukTurnosToAsistenciaStaff(settings, [
      {
        DNI: '12.345.678-9',
        nombreTurno: 'Diurno',
        horarioTurno: '08:00-19:00',
        idTurno: 'D1',
      },
    ]);
    const s = result.settings.staff[0]!;
    expect(s.shift).toBe('day');
    expect(s.expectedTime).toBe('08:00');
  });
});
