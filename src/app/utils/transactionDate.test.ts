import { describe, expect, it } from 'vitest';
import { formatDateInputValue, parseTransactionDate } from './transactionDate';

describe('parseTransactionDate', () => {
  it('interpreta yyyy-MM-dd como medianoche local (sin desfase UTC)', () => {
    const d = parseTransactionDate('2026-01-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
    expect(formatDateInputValue(d)).toBe('2026-01-01');
  });

  it('interpreta dd/MM/yyyy como día/mes/año (formato latinoamericano)', () => {
    const d = parseTransactionDate('19/05/2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(19);
  });

  it('no invierte día y mes en fechas ambiguas (05/03/2026 = 5 marzo)', () => {
    const d = parseTransactionDate('05/03/2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(5);
  });

  it('acepta dd-MM-yyyy y dd.MM.yyyy', () => {
    expect(parseTransactionDate('19-05-2026').getDate()).toBe(19);
    expect(parseTransactionDate('19.05.2026').getMonth()).toBe(4);
  });

  it('normaliza Date existente al inicio del día local', () => {
    const raw = new Date(2026, 0, 1, 15, 30);
    const d = parseTransactionDate(raw);
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});
