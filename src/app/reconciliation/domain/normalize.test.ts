import { describe, expect, it } from 'vitest';

import { normalizeOperationNumber, parseImportAmount, parseImportDate } from './normalize';

describe('reconciliation normalize', () => {
  it('normaliza N° operación a 7 dígitos con ceros', () => {
    expect(normalizeOperationNumber('123')).toEqual({ normalized: '0000123', raw: '123' });
    expect(normalizeOperationNumber('12345678901')).toEqual({
      normalized: '5678901',
      raw: '12345678901',
    });
  });

  it('parsea montos', () => {
    expect(parseImportAmount('50,00')).toBe(50);
    expect(parseImportAmount(40)).toBe(40);
    expect(parseImportAmount('S/212.00')).toBe(212);
    expect(parseImportAmount('S/0.00')).toBe(0);
  });

  it('parsea fechas dd/mm/yyyy', () => {
    expect(parseImportDate('26/06/2026')).toBe('2026-06-26');
    expect(parseImportDate('2026-06-26')).toBe('2026-06-26');
  });
});
