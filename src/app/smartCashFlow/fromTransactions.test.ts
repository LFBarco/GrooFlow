import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import type { ConfigStructure } from '../data/initialData';
import {
  aggregateHistoricalByCategoryRow,
  countCalendarMonthsInclusive,
  scheduleLinesFromHistoricalTransactions,
  realizedTotalsInHorizon,
  splitAmountEvenlyAcrossParts,
} from './fromTransactions';

const miniConfig: ConfigStructure = {
  Ingresos: { type: 'income', concepts: [{ id: 'p', name: 'POS', flexibility: 'flexible' }] },
  Planilla: {
    type: 'expense',
    concepts: [
      { id: 'b', name: 'Base', flexibility: 'fixed', defaultDay: 30 },
      { id: 'f', name: 'Honorarios', flexibility: 'flexible', defaultDay: 15 },
    ],
  },
};

describe('fromTransactions', () => {
  it('splitAmountEvenlyAcrossParts mantiene suma exacta en centavos', () => {
    const p = splitAmountEvenlyAcrossParts(10.03, 3);
    expect(p.length).toBe(3);
    const cents = Math.round(p.reduce((a, x) => a + x, 0) * 100);
    expect(cents).toBe(1003);
  });

  it('countCalendarMonthsInclusive cuenta bien', () => {
    expect(countCalendarMonthsInclusive('2026-01-15', '2026-03-10')).toBe(3);
  });

  it('infer flexibility fixed desde plan de conceptos', () => {
    const txs: Transaction[] = [
      {
        id: '1',
        amount: 100,
        type: 'expense',
        category: 'Planilla',
        concept: 'Base',
        description: '',
        date: new Date('2026-01-10'),
      },
    ];
    const agg = aggregateHistoricalByCategoryRow(
      txs,
      '2026-01-01',
      '2026-01-31',
      'all',
      miniConfig
    );
    expect(agg).toHaveLength(1);
    expect(agg[0].flexibility).toBe('fixed');
    expect(agg[0].total).toBe(100);
  });

  it('lump_at_start pone todo en la primera fecha del horizonte', () => {
    const txs: Transaction[] = [
      {
        id: '1',
        amount: 200,
        type: 'income',
        category: 'Ingresos',
        concept: 'POS',
        description: '',
        date: new Date('2026-01-05'),
      },
    ];
    const lines = scheduleLinesFromHistoricalTransactions({
      transactions: txs,
      config: miniConfig,
      histStart: '2026-01-01',
      histEnd: '2026-01-31',
      horizonStart: '2026-02-01',
      horizonEnd: '2026-02-28',
      kindFilter: 'all',
      distribution: 'lump_at_start',
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('inflow');
    expect(lines[0].date).toBe('2026-02-01');
    expect(lines[0].amount).toBe(200);
  });

  it('month_avg replica por mes natural del horizonte', () => {
    const txs: Transaction[] = [
      {
        id: '1',
        amount: 900,
        type: 'expense',
        category: 'Planilla',
        concept: 'Honorarios',
        description: '',
        date: new Date('2026-01-12'),
      },
    ];
    const lines = scheduleLinesFromHistoricalTransactions({
      transactions: txs,
      config: miniConfig,
      histStart: '2026-01-01',
      histEnd: '2026-01-31',
      horizonStart: '2026-02-01',
      horizonEnd: '2026-04-30',
      kindFilter: 'expense',
      distribution: 'month_avg_per_horizon_month',
    });
    /** 900 en 1 mes histórico ⇒ 900/mes; 3 meses en horizonte → 3 líneas que suman 2700 */
    expect(lines.length).toBeGreaterThanOrEqual(3);
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    expect(sum).toBeCloseTo(2700, 8);
    expect(lines.every((l) => l.kind === 'outflow')).toBe(true);
  });

  it('realizedTotalsInHorizon incluye sólo movimientos en rango', () => {
    const txs: Transaction[] = [
      {
        id: 'a',
        amount: 50,
        type: 'income',
        category: 'Ingresos',
        description: '',
        date: new Date('2026-02-05'),
      },
      {
        id: 'b',
        amount: 30,
        type: 'expense',
        category: 'X',
        description: '',
        date: new Date('2026-02-06'),
      },
      {
        id: 'c',
        amount: 999,
        type: 'expense',
        category: 'X',
        description: '',
        date: new Date('2026-01-01'),
      },
    ];
    const r = realizedTotalsInHorizon(txs, '2026-02-01', '2026-02-28');
    expect(r.income).toBe(50);
    expect(r.expense).toBe(30);
    expect(r.net).toBe(20);
  });
});
