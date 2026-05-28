import { describe, expect, it } from 'vitest';
import { runCashFlowProjection } from './projectEngine';

describe('runCashFlowProjection', () => {
  it('cubre fijos y flexibles en orden con suficiente caja', () => {
    const r = runCashFlowProjection({
      startDate: '2026-02-01',
      endDate: '2026-02-03',
      openingBalance: 1000,
      inflows: [],
      outflows: [
        {
          id: 'fix-a',
          amount: 200,
          dueDate: '2026-02-01',
          flexibility: 'fixed',
        },
        {
          id: 'flex-b',
          amount: 150,
          dueDate: '2026-02-01',
          flexibility: 'flexible',
          priorityRank: 1,
        },
      ],
    });
    expect(r.days).toHaveLength(3);
    expect(r.days[0].closingBalance).toBe(650);
    expect(r.days[1].openingBalance).toBe(650);
    expect(r.unresolvedFlex).toHaveLength(0);
    const shortfall = r.alerts.filter((a) => a.kind === 'SHORTFALL_PENDING_FLEX_END');
    expect(shortfall).toHaveLength(0);
  });

  it('aplaza flexible sin caja suficiente y lo paga al día siguiente si ingresa efectivo', () => {
    const r = runCashFlowProjection({
      startDate: '2026-02-01',
      endDate: '2026-02-02',
      openingBalance: 100,
      inflows: [
        { id: 'i1', amount: 200, date: '2026-02-02' },
      ],
      outflows: [
        { id: 'flex-a', amount: 250, dueDate: '2026-02-01', flexibility: 'flexible', priorityRank: 10 },
      ],
    });
    expect(r.days[0].closingBalance).toBe(100);
    const deferredDay1 = r.days[0].ledger.some((l) => l.kind === 'flex_deferred');
    expect(deferredDay1).toBe(true);
    expect(r.alerts.some((a) => a.kind === 'FLEX_DEFERRED')).toBe(true);
    expect(r.days[1].closingBalance).toBe(50);
    expect(r.unresolvedFlex).toHaveLength(0);
  });

  it('prioridad: mismo día sólo puede pagarse el más prioritario cuando el efectivo es insuficiente', () => {
    const r = runCashFlowProjection({
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      openingBalance: 100,
      inflows: [],
      outflows: [
        {
          id: 'lowPri',
          amount: 80,
          dueDate: '2026-03-01',
          flexibility: 'flexible',
          priorityRank: 10,
        },
        {
          id: 'highPri',
          amount: 90,
          dueDate: '2026-03-01',
          flexibility: 'flexible',
          priorityRank: 1,
        },
      ],
    });
    expect(r.days[0].closingBalance).toBe(10); // solo paga highPri (90); lowPri aplazado
    const paid = r.days[0].ledger.filter((l) => l.kind === 'flex_paid').map((l) => l.sourceId);
    expect(paid).toEqual(['highPri']);
    expect(r.unresolvedFlex).toHaveLength(1);
    expect(r.unresolvedFlex[0].outflow.id).toBe('lowPri');
    expect(r.alerts.some((a) => a.kind === 'SHORTFALL_PENDING_FLEX_END')).toBe(true);
  });

  it('emisión alerta cuando fijos llevan saldo negativo', () => {
    const r = runCashFlowProjection({
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      openingBalance: 50,
      inflows: [],
      outflows: [
        { id: 'heavy', amount: 200, dueDate: '2026-04-01', flexibility: 'fixed' },
      ],
    });
    expect(r.days[0].closingBalance).toBe(-150);
    expect(r.alerts.some((a) => a.kind === 'NEGATIVE_AFTER_FIXED')).toBe(true);
  });
});
