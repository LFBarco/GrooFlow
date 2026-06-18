import { describe, expect, it } from 'vitest';

import type { AsistenciaStaffMember, BukAsistenciaRecord } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import {
  isNightBukRecord,
  normalizeStaffShift,
  recordMatchesStaffShift,
  staffMatchesShiftFilter,
} from './asistenciaShift';
import { buildLiveSedeSummary, staffForSede } from './asistenciaStaff';

describe('asistenciaShift', () => {
  const dayStaff: AsistenciaStaffMember = {
    id: 'day',
    sedeName: 'Principal',
    fullName: 'Ana Día',
    cargoLabel: 'Recepcionista',
    area: 'administracion',
    expectedTime: '08:00',
    shift: 'day',
    isCritical: false,
    rut: '111',
  };

  const nightStaff: AsistenciaStaffMember = {
    id: 'night',
    sedeName: 'Principal',
    fullName: 'Luis Noche',
    cargoLabel: 'Recepcionista',
    area: 'administracion',
    expectedTime: '20:00',
    shift: 'night',
    isCritical: false,
    rut: '222',
  };

  const dayRecord: BukAsistenciaRecord = {
    id: 1,
    trab_id: 1,
    rut_trabajador: '111',
    nombre: 'Ana',
    apellido_paterno: 'Día',
    codigo_recinto: 'PRIN',
    dia_entrada: '10/06/2026',
    entrada_format: '08:05',
    turno_noche: false,
  };

  const nightRecord: BukAsistenciaRecord = {
    id: 2,
    trab_id: 2,
    rut_trabajador: '222',
    nombre: 'Luis',
    apellido_paterno: 'Noche',
    codigo_recinto: 'PRIN',
    dia_entrada: '10/06/2026',
    entrada_format: '20:10',
    turno_noche: true,
  };

  it('filtra personal por turno', () => {
    const settings = mergeAsistenciaSettings({
      staff: [dayStaff, nightStaff],
      sedeProfiles: [{ sedeName: 'Principal', bukRecintoCode: 'PRIN' }],
    });
    expect(staffForSede(settings, 'Principal', 'day')).toHaveLength(1);
    expect(staffForSede(settings, 'Principal', 'night')).toHaveLength(1);
    expect(staffForSede(settings, 'Principal', 'all')).toHaveLength(2);
  });

  it('cruza Buk según turno_noche', () => {
    expect(recordMatchesStaffShift(dayRecord, dayStaff)).toBe(true);
    expect(recordMatchesStaffShift(nightRecord, nightStaff)).toBe(true);
    expect(recordMatchesStaffShift(nightRecord, dayStaff)).toBe(false);
    expect(recordMatchesStaffShift(dayRecord, nightStaff)).toBe(false);
    expect(isNightBukRecord(nightRecord)).toBe(true);
  });

  it('organigrama en vivo respeta filtro de turno', () => {
    const settings = mergeAsistenciaSettings({
      staff: [dayStaff, nightStaff],
      sedeProfiles: [{ sedeName: 'Principal', bukRecintoCode: 'PRIN' }],
    });
    const date = new Date('2026-06-10T12:00:00');

    const nightView = buildLiveSedeSummary({
      sedeName: 'Principal',
      settings,
      records: [dayRecord, nightRecord],
      date,
      shiftFilter: 'night',
    });
    expect(nightView.workingCount).toBe(1);
    expect(nightView.areas[0]?.staff[0]?.staff.fullName).toBe('Luis Noche');

    const dayView = buildLiveSedeSummary({
      sedeName: 'Principal',
      settings,
      records: [dayRecord, nightRecord],
      date,
      shiftFilter: 'day',
    });
    expect(dayView.workingCount).toBe(1);
    expect(dayView.areas[0]?.staff[0]?.staff.fullName).toBe('Ana Día');
  });

  it('staff sin shift explícito se trata como día', () => {
    const legacy = { ...dayStaff, shift: undefined };
    expect(staffMatchesShiftFilter(legacy, 'day')).toBe(true);
    expect(staffMatchesShiftFilter(legacy, 'night')).toBe(false);
  });

  it('migra cargo legacy Gerente a Encargado de sede', () => {
    const legacy = normalizeStaffShift({
      id: 'x',
      sedeName: 'P',
      fullName: 'A',
      cargoLabel: 'Gerente',
      area: 'administracion',
      expectedTime: '08:00',
      isCritical: false,
    });
    expect(legacy.cargoLabel).toBe('Encargado de sede');
  });
});
