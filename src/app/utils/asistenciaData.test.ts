import { describe, expect, it } from 'vitest';

import type { BukAsistenciaRecord } from '../types/asistencia';
import {
  buildAsistenciaDaySummary,
  buildDefaultRequirementsForSede,
  defaultAsistenciaSettings,
  formatBukEntradaDisplay,
  hasBukEntradaMarcada,
  mergeAsistenciaSettings,
  parseBukEntradaFormatMinutes,
} from './asistenciaData';

describe('asistenciaData', () => {
  it('calcula cobertura por cargo y sede', () => {
    const settings = mergeAsistenciaSettings({
      requirements: buildDefaultRequirementsForSede('Petmax Principal', 'Petmax'),
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '111',
        nombre: 'Ana',
        apellido_paterno: 'Vet',
        codigo_recinto: 'Petmax',
        nombre_recinto: 'Petmax Principal',
        area: 'MEDICOS VETERINARIOS',
        especialidad: 'MEDICO VETERINARIO',
        dia_entrada: '14/06/2026',
        entrada: '2026-06-14T12:00:00Z',
        entrada_format: '12:00',
        salida: null,
      },
    ];
    const summary = buildAsistenciaDaySummary({
      date: new Date('2026-06-14T12:00:00'),
      records,
      settings,
    });
    expect(summary.sedes).toHaveLength(1);
    const medico = summary.sedes[0].byArea.medica.find((c) =>
      c.requirement.cargoLabel.includes('Médico')
    );
    expect(medico?.presentCount).toBe(1);
    expect(medico?.status).toBe('partial');
  });

  it('merge conserva defaults', () => {
    expect(mergeAsistenciaSettings(null).requirements).toEqual(defaultAsistenciaSettings().requirements);
  });

  it('parsea entrada_format Buk con fecha y hora', () => {
    expect(parseBukEntradaFormatMinutes('2026/06/15 08:02:00')).toBe(8 * 60 + 2);
    expect(formatBukEntradaDisplay('2026/06/15 08:02:00')).toBe('08:02');
    expect(hasBukEntradaMarcada({ id: 1, trab_id: 1, rut_trabajador: '1', nombre: 'X', entrada_format: '2026/06/15 08:02:00' })).toBe(true);
    expect(hasBukEntradaMarcada({ id: 1, trab_id: 1, rut_trabajador: '1', nombre: 'X', entrada_format: '-' })).toBe(false);
  });
});
