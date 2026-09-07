import { describe, expect, it } from 'vitest';

import type { BukAsistenciaRecord } from '../types/asistencia';
import {
  bukRecordMergeKey,
  mergeBukAsistenciaRecords,
  pruneBukRecordsToHotWindow,
} from './bukAsistenciaCache';

describe('bukAsistenciaCache', () => {
  it('fusiona por id y actualiza marcaciones', () => {
    const a: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '111',
        nombre: 'Ana',
        dia_entrada: '15/06/2026',
        entrada_format: '08:00',
      },
    ];
    const b: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '111',
        nombre: 'Ana',
        dia_entrada: '15/06/2026',
        entrada_format: '2026/06/15 08:10:00',
      },
      {
        id: 2,
        trab_id: 2,
        rut_trabajador: '222',
        nombre: 'Luis',
        dia_entrada: '15/06/2026',
        entrada_format: '08:15',
      },
    ];
    const merged = mergeBukAsistenciaRecords(a, b);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.id === 1)?.entrada_format).toBe('2026/06/15 08:10:00');
  });

  it('usa clave estable por id', () => {
    expect(bukRecordMergeKey({ id: 99, trab_id: 1, rut_trabajador: '1', nombre: 'X' })).toBe('id:99');
  });

  it('no expira por TTL: poda solo working set caliente', () => {
    const now = new Date('2026-09-05T12:00:00').getTime();
    const records: BukAsistenciaRecord[] = [
      {
        id: 1,
        trab_id: 1,
        rut_trabajador: '1',
        nombre: 'Old',
        dia_entrada: '01/01/2025',
      },
      {
        id: 2,
        trab_id: 2,
        rut_trabajador: '2',
        nombre: 'New',
        dia_entrada: '01/09/2026',
      },
    ];
    const pruned = pruneBukRecordsToHotWindow(records, 90, now);
    expect(pruned.some((r) => r.id === 2)).toBe(true);
    expect(pruned.every((r) => r.id !== 1)).toBe(true);
  });
});
