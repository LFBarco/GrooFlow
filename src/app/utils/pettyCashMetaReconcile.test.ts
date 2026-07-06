import { describe, expect, it } from 'vitest';

import type { PettyCashTransaction, User } from '../types';
import { FUND_DELIVERY_CATEGORY } from './pettyCashAudit';
import { getPettyCashWeekBalance } from './pettyCashBalance';
import { findFundDeliveryForWeek, isWeekClosed } from './pettyCashWeekOpening';
import {
  mergePettyCashMetaPayloads,
  reconcilePettyCashMeta,
} from './pettyCashMetaReconcile';

const IRIS_ID = 'iris-quintero';

const irisUser: User = {
  id: IRIS_ID,
  name: 'Iris Quintero',
  email: 'iris@example.com',
  role: 'user',
  status: 'active',
  pettyCashFundLimit: 800,
};

function fundDeliveryTx(overrides: Partial<PettyCashTransaction> = {}): PettyCashTransaction {
  return {
    id: 'fd-800',
    date: new Date('2026-01-02'),
    description: FUND_DELIVERY_CATEGORY,
    amount: 800,
    type: 'income',
    incomeSubtype: 'fund_delivery',
    category: FUND_DELIVERY_CATEGORY,
    requester: 'Admin',
    custodianId: IRIS_ID,
    status: 'approved',
    weekNumber: '2026-W01',
    ...overrides,
  };
}

function expenseTx(id: string, amount: number): PettyCashTransaction {
  return {
    id,
    date: new Date('2026-01-05'),
    description: 'Gasto operativo',
    amount,
    type: 'expense',
    category: 'Suministros',
    requester: 'Iris',
    custodianId: IRIS_ID,
    status: 'approved',
    weekNumber: '2026-W01',
  };
}

describe('pettyCashMetaReconcile', () => {
  it('reconstruye dotación desde transacción fund_delivery cuando falta meta', () => {
    const transactions = [fundDeliveryTx(), expenseTx('e1', 100)];
    const out = reconcilePettyCashMeta({
      meta: { weekClosures: [], weekPreClosures: [], fundDeliveries: [] },
      transactions,
      users: [irisUser],
      globalFundLimit: 1000,
    });
    const delivery = findFundDeliveryForWeek(IRIS_ID, '2026-W01', out.fundDeliveries);
    expect(delivery).toBeDefined();
    expect(delivery?.deliveredAmount).toBe(800);
    expect(delivery?.id).toMatch(/^recon-fd-/);
  });

  it('caso Iris W01: meta vacío con +800 y gastos no deja saldo negativo', () => {
    const expenses = [
      expenseTx('e1', 120.4),
      expenseTx('e2', 89),
      expenseTx('e3', 150),
      expenseTx('e4', 80),
      expenseTx('e5', 100),
      expenseTx('e6', 50),
      expenseTx('e7', 50),
      expenseTx('e8', 50),
      expenseTx('e9', 50),
      expenseTx('e10', 50),
      expenseTx('e11', 50),
    ];
    const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
    expect(totalExpenses).toBe(839.4);

    const w02Activity: PettyCashTransaction = {
      id: 'w02-e1',
      date: new Date('2026-01-12'),
      description: 'Gasto semana 2',
      amount: 20,
      type: 'expense',
      category: 'Suministros',
      requester: 'Iris',
      custodianId: IRIS_ID,
      status: 'approved',
      weekNumber: '2026-W02',
    };

    const transactions = [fundDeliveryTx(), ...expenses, w02Activity];
    const out = reconcilePettyCashMeta({
      meta: { weekClosures: [], weekPreClosures: [], fundDeliveries: [] },
      transactions,
      users: [irisUser],
      globalFundLimit: 1000,
    });

    expect(findFundDeliveryForWeek(IRIS_ID, '2026-W01', out.fundDeliveries)).toBeDefined();
    expect(isWeekClosed(IRIS_ID, '2026-W01', out.weekClosures)).toBe(true);

    const balance = getPettyCashWeekBalance(
      transactions,
      IRIS_ID,
      '2026-W01',
      out.weekClosures,
      800,
      out.fundDeliveries,
      { suggested: 0, consumed: false, availableSuggested: 0 }
    );
    expect(balance).not.toBeCloseTo(-839.4, 2);
    expect(balance).toBeCloseTo(-39.4, 2);
  });

  it('merge une KV y SQL sin perder registros distintos por semana', () => {
    const kv = {
      weekClosures: [],
      weekPreClosures: [],
      fundDeliveries: [
        {
          id: 'd-kv',
          custodianId: 'u1',
          weekNumber: '2026-W01',
          configuredAmount: 500,
          deliveredAmount: 500,
          deliveredAt: '2026-01-01',
          deliveredByUserId: 'a',
        },
      ],
    };
    const sql = {
      weekClosures: [
        {
          id: 'c-sql',
          custodianId: 'u1',
          weekNumber: '2026-W01',
          closedAt: '2026-01-08',
          openingFund: 500,
          expensesTotal: 100,
          closingBalance: 400,
          carriedForward: 400,
        },
      ],
      weekPreClosures: [],
      fundDeliveries: [],
    };
    const merged = mergePettyCashMetaPayloads(kv, sql);
    expect(merged.fundDeliveries).toHaveLength(1);
    expect(merged.weekClosures).toHaveLength(1);
    expect(merged.fundDeliveries[0]?.id).toBe('d-kv');
    expect(merged.weekClosures[0]?.id).toBe('c-sql');
  });

  it('no duplica dotación si ya existe en meta', () => {
    const existing = {
      id: 'd-real',
      custodianId: IRIS_ID,
      weekNumber: '2026-W01',
      configuredAmount: 800,
      deliveredAmount: 800,
      deliveredAt: '2026-01-02',
      deliveredByUserId: 'admin',
    };
    const transactions = [fundDeliveryTx()];
    const out = reconcilePettyCashMeta({
      meta: {
        weekClosures: [],
        weekPreClosures: [],
        fundDeliveries: [existing],
      },
      transactions,
      users: [irisUser],
      globalFundLimit: 1000,
    });
    expect(out.fundDeliveries).toHaveLength(1);
    expect(out.fundDeliveries[0]?.id).toBe('d-real');
  });
});
