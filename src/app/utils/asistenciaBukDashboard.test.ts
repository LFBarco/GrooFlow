import { describe, expect, it } from 'vitest';

import type { BukAsistenciaRecord } from '../types/asistencia';
import { mergeAsistenciaSettings } from './asistenciaData';
import { buildBukDashboardSummary } from './asistenciaBukDashboard';

describe('asistenciaBukDashboard', () => {
  it('resume llegadas por sede y fecha', () => {
    const settings = mergeAsistenciaSettings({
      sedeProfiles: [
        { sedeName: '50.- La Molina', bukRecintoCode: 'Petmax · Petmax Principal' },
      ],
    });
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '111',
        nombre: 'ANDREA',
        apellido_paterno: 'CERVAN',
        apellido_materno: 'RAMIREZ',
        codigo_recinto: 'Petmax',
        nombre_recinto: 'Petmax Principal',
        especialidad: 'ASISTENTE VETERINARIO',
        dia_entrada: '15/06/2026',
        entrada_format: '2026/06/15 08:06:00',
      },
      {
        id: 2,
        trab_id: 2,
        rut_trabajador: '222',
        nombre: 'LUIS',
        apellido_paterno: 'BARCO',
        codigo_recinto: 'Petmax',
        nombre_recinto: 'Petmax Principal',
        especialidad: 'COUNTER',
        dia_entrada: '15/06/2026',
        entrada_format: '',
      },
    ];
    const summary = buildBukDashboardSummary({
      records,
      sedeName: '50.- La Molina',
      settings,
      date: new Date('2026-06-15T12:00:00'),
    });
    expect(summary.total).toBe(2);
    expect(summary.arrived).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.rows[0]?.nombre).toBe('ANDREA');
    expect(summary.rows[0]?.apellidos).toBe('CERVAN RAMIREZ');
    expect(summary.rows[0]?.entradaHora).toBe('08:06');
  });
});
