import { describe, expect, it } from 'vitest';
import type { PettyCashFundDelivery, PettyCashWeekClosure, User } from '../types';
import {
  canReopenPettyCashWeekClosure,
  evaluatePettyCashWeekReopen,
  listLaterWeekClosures,
  removePettyCashWeekClosure,
} from './pettyCashWeekReopen';

function user(partial: Partial<User> & Pick<User, 'id' | 'name' | 'role'>): User {
  return {
    initials: 'XX',
    email: `${partial.id}@test.local`,
    status: 'active',
    ...partial,
  };
}

const CUST = 'cust-1';

const closures: PettyCashWeekClosure[] = [
  {
    id: 'c1',
    custodianId: CUST,
    weekNumber: '2026-W10',
    closedAt: '2026-03-10',
    openingFund: 500,
    expensesTotal: 100,
    closingBalance: 400,
    carriedForward: 400,
  },
  {
    id: 'c2',
    custodianId: CUST,
    weekNumber: '2026-W11',
    closedAt: '2026-03-17',
    openingFund: 1200,
    expensesTotal: 200,
    closingBalance: 1000,
    carriedForward: 1000,
  },
];

describe('pettyCashWeekReopen', () => {
  it('solo admin / super_admin pueden reabrir', () => {
    expect(canReopenPettyCashWeekClosure(user({ id: '1', name: 'A', role: 'admin' }))).toBe(true);
    expect(canReopenPettyCashWeekClosure(user({ id: '2', name: 'S', role: 'super_admin' }))).toBe(
      true
    );
    expect(
      canReopenPettyCashWeekClosure(user({ id: '3', name: 'Aud', role: 'auditoria' }))
    ).toBe(false);
    expect(canReopenPettyCashWeekClosure(user({ id: '4', name: 'R', role: 'groomer' }))).toBe(
      false
    );
  });

  it('lista cierres posteriores del mismo responsable', () => {
    const later = listLaterWeekClosures(CUST, '2026-W10', closures);
    expect(later.map((c) => c.weekNumber)).toEqual(['2026-W11']);
  });

  it('bloquea si hay semana posterior cerrada', () => {
    const r = evaluatePettyCashWeekReopen({
      user: user({ id: 'a', name: 'Admin', role: 'admin' }),
      custodianId: CUST,
      weekKey: '2026-W10',
      closures,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('later_closed');
      expect(r.laterWeeks).toContain('2026-W11');
    }
  });

  it('permite reabrir la semana más reciente cerrada', () => {
    const r = evaluatePettyCashWeekReopen({
      user: user({ id: 'a', name: 'Admin', role: 'admin' }),
      custodianId: CUST,
      weekKey: '2026-W11',
      closures,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.nextWeekHasDelivery).toBe(false);
    }
  });

  it('advierte si la semana siguiente tiene dotación', () => {
    const deliveries: PettyCashFundDelivery[] = [
      {
        id: 'd1',
        custodianId: CUST,
        weekNumber: '2026-W12',
        configuredAmount: 800,
        deliveredAmount: 800,
        deliveredAt: '2026-03-18',
        deliveredByUserId: 'aud',
      },
    ];
    const r = evaluatePettyCashWeekReopen({
      user: user({ id: 'a', name: 'Admin', role: 'admin' }),
      custodianId: CUST,
      weekKey: '2026-W11',
      closures,
      deliveries,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.nextWeekHasDelivery).toBe(true);
      expect(r.warning).toMatch(/dotación/i);
    }
  });

  it('quita el cierre indicado', () => {
    const next = removePettyCashWeekClosure(closures, CUST, '2026-W11');
    expect(next).toHaveLength(1);
    expect(next[0].weekNumber).toBe('2026-W10');
  });
});
