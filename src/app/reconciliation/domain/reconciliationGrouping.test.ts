import { describe, expect, it } from 'vitest';

import type { CanonicalMovement } from './types';
import {
  bankSalesAmountsMatch,
  resolveSalesGroupForMatch,
  salesGroupTotal,
  salesLinkedToBank,
} from './reconciliationGrouping';

function mov(
  partial: Partial<CanonicalMovement> & Pick<CanonicalMovement, 'id' | 'sourceType' | 'side' | 'amount'>
): CanonicalMovement {
  return {
    batchId: 'b1',
    sessionId: 's1',
    transactionDate: '2026-07-04',
    currency: 'PEN',
    operationNumber: '3938867',
    operationNumberRaw: '166413938867',
    paymentMethod: 'mercado_pago',
    workflowStatus: 'reconciled',
    ruleCodes: [],
    metadata: {},
    ...partial,
  } as CanonicalMovement;
}

describe('reconciliationGrouping', () => {
  it('suma ventas ERP vinculadas al mismo banco', () => {
    const bank = mov({
      id: 'b1',
      sourceType: 'mercado_pago',
      side: 'bank_or_gateway',
      amount: 55,
      matchId: 'm1',
    });
    const sales1 = mov({
      id: 's-a',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 20,
      matchedMovementId: 'b1',
      matchId: 'm1',
    });
    const sales2 = mov({
      id: 's-b',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 35,
      matchedMovementId: 'b1',
      matchId: 'm1',
    });

    const linked = salesLinkedToBank([bank, sales1, sales2], 'b1');
    expect(linked.map((s) => s.id).sort()).toEqual(['s-a', 's-b']);
    expect(salesGroupTotal(linked)).toBe(55);
    expect(bankSalesAmountsMatch(bank, linked)).toBe(true);
  });

  it('resuelve grupo desde salesMovementIds del match', () => {
    const bank = mov({
      id: 'b1',
      sourceType: 'mercado_pago',
      side: 'bank_or_gateway',
      amount: 55,
    });
    const sales1 = mov({
      id: 's-a',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 20,
    });
    const sales2 = mov({
      id: 's-b',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 35,
    });

    const group = resolveSalesGroupForMatch([bank, sales1, sales2], bank, ['s-a', 's-b']);
    expect(group?.map((s) => s.id).sort()).toEqual(['s-a', 's-b']);
  });
});
