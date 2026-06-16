import { describe, expect, it } from 'vitest';

import type { BukAsistenciaRecord } from '../types/asistencia';
import {
  BUK_ASISTENCIA_CACHE_TTL_MS,
  bukRecordMergeKey,
  mergeBukAsistenciaRecords,
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

  it('ttl de cache es 48 horas', () => {
    expect(BUK_ASISTENCIA_CACHE_TTL_MS).toBe(48 * 60 * 60 * 1000);
  });
});
