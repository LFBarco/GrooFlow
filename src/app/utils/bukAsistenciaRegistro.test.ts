import { describe, expect, it } from 'vitest';

import { matchesBukRecintoConfig } from './asistenciaData';
import {
  aggregateRegistroAsistenciaPunches,
  formatCtrlitDate,
  incrementalAsistenciaDateRange,
  normalizeBukAsistenciaRecord,
} from './bukAsistenciaRegistro';
import { resolveSedeNameFromBukRecinto } from './asistenciaSedeOperativa';
import type { AsistenciaSettings, BukAsistenciaRecord } from '../types/asistencia';

describe('bukAsistenciaRegistro', () => {
  it('formatea fechas Ctrlit DD-MM-YYYY e incremental (semana)', () => {
    const d = new Date(2026, 8, 23); // 23-09-2026
    expect(formatCtrlitDate(d)).toBe('23-09-2026');
    const win = incrementalAsistenciaDateRange(d, 7);
    expect(win.desde).toBe('16-09-2026');
    expect(win.hasta).toBe('23-09-2026');
  });

  it('normaliza obra_id desde id_recinto y rellena codigo_recinto', () => {
    const n = normalizeBukAsistenciaRecord({
      id: 1,
      trab_id: 1,
      rut_trabajador: '74619638',
      nombre: 'Ana',
      id_recinto: 24734,
    });
    expect(n.obra_id).toBe(24734);
    expect(n.codigo_recinto).toBe('24734');
  });

  it('agrega punches de obtenerRegistroAsistencia a jornada diaria', () => {
    const records = aggregateRegistroAsistenciaPunches([
      {
        obra_id: 24734,
        DNI: '74619638',
        ano: 2026,
        mes: 9,
        dia: 23,
        hora: 8,
        minutos: 5,
        segundos: 0,
        sentido: 'entrada',
      },
      {
        obra_id: 24734,
        DNI: '74619638',
        ano: 2026,
        mes: 9,
        dia: 23,
        hora: 17,
        minutos: 30,
        segundos: 0,
        sentido: 'salida',
      },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].obra_id).toBe(24734);
    expect(records[0].rut_trabajador).toBe('74619638');
    expect(records[0].entrada).toContain('08:05');
    expect(records[0].salida).toContain('17:30');
  });
});

describe('matchesBukRecintoConfig obra_id', () => {
  const record: BukAsistenciaRecord = {
    id: 1,
    trab_id: 1,
    rut_trabajador: '1',
    nombre: 'X',
    obra_id: 24734,
    id_recinto: 24734,
    codigo_recinto: '24734',
    nombre_recinto: 'La Molina',
  };

  it('matchea por obra_id numérico', () => {
    expect(matchesBukRecintoConfig('24734', record)).toBe(true);
    expect(matchesBukRecintoConfig('obra:24734', record)).toBe(true);
    expect(matchesBukRecintoConfig('99999', record)).toBe(false);
  });
});

describe('resolveSedeNameFromBukRecinto por huellero', () => {
  it('ubica sede por obra_id configurado', () => {
    const settings: AsistenciaSettings = {
      requirements: [],
      sedeProfiles: [{ sedeName: 'La Molina', bukRecintoCode: '24734' }],
      sedeMappings: [],
      staff: [],
    };
    const record: BukAsistenciaRecord = {
      id: 1,
      trab_id: 1,
      rut_trabajador: '74619638',
      nombre: 'Iris',
      obra_id: 24734,
      id_recinto: 24734,
      codigo_recinto: '24734',
      entrada: '2026-09-23T12:00:00Z',
      dia_entrada: '23/09/2026',
    };
    expect(resolveSedeNameFromBukRecinto(record, settings)).toBe('La Molina');
  });

  it('prioriza ID dispositivo huellero sobre obra_id', () => {
    const settings: AsistenciaSettings = {
      requirements: [],
      sedeProfiles: [{ sedeName: 'Otra', bukRecintoCode: '24734' }],
      sedeMappings: [],
      staff: [],
      dispositivoSedeMappings: [{ dispositivoId: 'UDP3244900226', sedeName: 'La Molina' }],
    };
    const record: BukAsistenciaRecord = {
      id: 1,
      trab_id: 1,
      rut_trabajador: '74619638',
      nombre: 'Iris',
      obra_id: 24734,
      dispositivo: 'UDP3244900226',
      entrada: '2026-09-23T12:00:00Z',
      dia_entrada: '23/09/2026',
    };
    expect(resolveSedeNameFromBukRecinto(record, settings)).toBe('La Molina');
  });
});
