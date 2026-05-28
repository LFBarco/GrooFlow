import { describe, expect, it } from 'vitest';
import { getWeekOpeningBreakdown } from './pettyCashWeekOpening';
import type { PettyCashFundDelivery, PettyCashWeekClosure } from '../types';

const CUST = 'user-iris';

describe('getWeekOpeningBreakdown', () => {
  it('apertura de periodo sin cierre previo: arrastre config + dotación pendiente', () => {
    const b = getWeekOpeningBreakdown(CUST, '2026-W01', [], [], 800, {
      suggested: 54.05,
      consumed: false,
      availableSuggested: 54.05,
    });
    expect(b.isPeriodOpeningWeek).toBe(true);
    expect(b.carryFromPrevious).toBe(54.05);
    expect(b.fundDeliveryAmount).toBe(0);
    expect(b.openingTotal).toBe(54.05);
    expect(b.deliveryPending).toBe(true);
    expect(b.requiresFundDelivery).toBe(true);
  });

  it('apertura de periodo con dotación confirmada: arrastre + fondo fijo', () => {
    const deliveries: PettyCashFundDelivery[] = [
      {
        id: 'd0',
        custodianId: CUST,
        weekNumber: '2026-W01',
        configuredAmount: 800,
        deliveredAmount: 800,
        openingCarryAmount: 54.05,
        isPeriodOpening: true,
        deliveredAt: '2026-01-02',
        deliveredByUserId: 'aud-1',
      },
    ];
    const b = getWeekOpeningBreakdown(CUST, '2026-W01', [], deliveries, 800, {
      suggested: 54.05,
      consumed: false,
      availableSuggested: 54.05,
    });
    expect(b.openingTotal).toBe(854.05);
    expect(b.deliveryPending).toBe(false);
  });

  it('semana 2 tras cierre con arrastre: solo arrastre hasta dotación', () => {
    const closures: PettyCashWeekClosure[] = [
      {
        id: 'c1',
        custodianId: CUST,
        weekNumber: '2026-W01',
        closedAt: '2026-01-10',
        openingFund: 854.05,
        expensesTotal: 774.05,
        closingBalance: 80,
        carriedForward: 80,
      },
    ];
    const b = getWeekOpeningBreakdown(CUST, '2026-W02', closures, [], 800);
    expect(b.carryFromPrevious).toBe(80);
    expect(b.fundDeliveryAmount).toBe(0);
    expect(b.openingTotal).toBe(80);
    expect(b.deliveryPending).toBe(true);
    expect(b.requiresFundDelivery).toBe(true);
  });

  it('semana 2 con dotación confirmada: arrastre + entrega', () => {
    const closures: PettyCashWeekClosure[] = [
      {
        id: 'c1',
        custodianId: CUST,
        weekNumber: '2026-W01',
        closedAt: '2026-01-10',
        openingFund: 500,
        expensesTotal: 420,
        closingBalance: 80,
        carriedForward: 80,
      },
    ];
    const deliveries: PettyCashFundDelivery[] = [
      {
        id: 'd1',
        custodianId: CUST,
        weekNumber: '2026-W02',
        configuredAmount: 500,
        deliveredAmount: 500,
        deliveredAt: '2026-01-12',
        deliveredByUserId: 'aud-1',
      },
    ];
    const b = getWeekOpeningBreakdown(CUST, '2026-W02', closures, deliveries, 500);
    expect(b.openingTotal).toBe(580);
    expect(b.deliveryPending).toBe(false);
  });

  it('cierre con saldo 0: semana siguiente pendiente de dotación sin arrastre', () => {
    const closures: PettyCashWeekClosure[] = [
      {
        id: 'c1',
        custodianId: CUST,
        weekNumber: '2026-W01',
        closedAt: '2026-01-10',
        openingFund: 500,
        expensesTotal: 500,
        closingBalance: 0,
        carriedForward: 0,
      },
    ];
    const b = getWeekOpeningBreakdown(CUST, '2026-W02', closures, [], 500);
    expect(b.carryFromPrevious).toBe(0);
    expect(b.openingTotal).toBe(0);
    expect(b.deliveryPending).toBe(true);
  });
});
