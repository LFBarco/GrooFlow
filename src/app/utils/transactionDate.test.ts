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

  it('normaliza Date existente al inicio del día local', () => {
    const raw = new Date(2026, 0, 1, 15, 30);
    const d = parseTransactionDate(raw);
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});
