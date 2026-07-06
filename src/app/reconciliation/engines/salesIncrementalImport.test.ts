import { describe, expect, it } from 'vitest';

import { createEmptyDataset } from '../domain/dataset';
import type { CanonicalMovement, ReconciliationDataset } from '../domain/types';
import { mergeSalesMovementsIncremental } from './salesIncrementalImport';
import { prepareSessionForPartialMatching, runReconciliationEngine } from './reconciliationRunner';

function mov(
  partial: Partial<CanonicalMovement> & Pick<CanonicalMovement, 'id' | 'sourceType' | 'side' | 'amount'>
): CanonicalMovement {
  return {
    batchId: 'b1',
    sessionId: 's1',
    transactionDate: '2026-01-15',
    currency: 'PEN',
    operationNumber: '1111111',
    operationNumberRaw: '1111111',
    paymentMethod: 'yape',
    workflowStatus: 'normalized',
    ruleCodes: [],
    metadata: { erpOpCodeSlot: 1 },
    documentNumber: 'B006-0001',
    ...partial,
  } as CanonicalMovement;
}

describe('salesIncrementalImport', () => {
  it('omite ventas conciliadas sin cambios', () => {
    const dataset: ReconciliationDataset = {
      ...createEmptyDataset(),
      activeSessionId: 's1',
      movements: [
        mov({
          id: 's1',
          sourceType: 'sales_erp',
          side: 'sales_application',
          amount: 50,
          workflowStatus: 'reconciled',
          matchId: 'm1',
          matchedMovementId: 'b1',
        }),
      ],
      matches: [],
    };

    const result = mergeSalesMovementsIncremental(dataset, 's1', 'batch2', [
      {
        sourceType: 'sales_erp',
        side: 'sales_application',
        transactionDate: '2026-01-15',
        amount: 50,
        currency: 'PEN',
        operationNumber: '1111111',
        operationNumberRaw: '1111111',
        paymentMethod: 'yape',
        documentNumber: 'B006-0001',
        metadata: { erpOpCodeSlot: 1 },
      },
    ]);

    expect(result.stats).toEqual({ added: 0, updated: 0, unchanged: 1, needsReview: 0 });
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.id).toBe('s1');
  });

  it('marca en revisión si el ERP cambia código op. de venta conciliada', () => {
    const dataset: ReconciliationDataset = {
      ...createEmptyDataset(),
      activeSessionId: 's1',
      movements: [
        mov({
          id: 'bank1',
          sourceType: 'bcp_bank',
          side: 'bank_or_gateway',
          amount: 50,
          workflowStatus: 'reconciled',
          matchId: 'm1',
          matchedMovementId: 's1',
        }),
        mov({
          id: 's1',
          sourceType: 'sales_erp',
          side: 'sales_application',
          amount: 50,
          workflowStatus: 'reconciled',
          matchId: 'm1',
          matchedMovementId: 'bank1',
        }),
      ],
      matches: [
        {
          id: 'm1',
          sessionId: 's1',
          bankMovementId: 'bank1',
          salesMovementId: 's1',
          confidence: 0.99,
          matchStrategy: 'operation_number',
          ruleCode: 'RULE-001',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const result = mergeSalesMovementsIncremental(dataset, 's1', 'batch2', [
      {
        sourceType: 'sales_erp',
        side: 'sales_application',
        transactionDate: '2026-01-15',
        amount: 50,
        currency: 'PEN',
        operationNumber: '2222222',
        operationNumberRaw: '2222222',
        paymentMethod: 'yape',
        documentNumber: 'B006-0001',
        metadata: { erpOpCodeSlot: 1 },
      },
    ]);

    expect(result.stats.needsReview).toBe(1);
    const sales = result.movements.find((m) => m.id === 's1');
    const bank = result.movements.find((m) => m.id === 'bank1');
    expect(sales?.workflowStatus).toBe('in_review');
    expect(bank?.workflowStatus).toBe('normalized');
    expect(result.newAlerts).toHaveLength(1);
  });
});

describe('partial reconciliation engine', () => {
  it('conserva cruces conciliados al re-ejecutar motor', () => {
    const sid = 's1';
    const dataset: ReconciliationDataset = {
      ...createEmptyDataset(),
      activeSessionId: sid,
      movements: [
        mov({
          id: 'b1',
          sourceType: 'mercado_pago',
          side: 'bank_or_gateway',
          amount: 50,
          workflowStatus: 'reconciled',
          matchId: 'm1',
          matchedMovementId: 's1',
        }),
        mov({
          id: 's1',
          sourceType: 'sales_erp',
          side: 'sales_application',
          amount: 50,
          workflowStatus: 'reconciled',
          matchId: 'm1',
          matchedMovementId: 'b1',
        }),
        mov({
          id: 'b2',
          sourceType: 'mercado_pago',
          side: 'bank_or_gateway',
          amount: 80,
          operationNumber: '3333333',
          operationNumberRaw: '3333333',
          paymentMethod: 'mercado_pago',
        }),
        mov({
          id: 's2',
          sourceType: 'sales_erp',
          side: 'sales_application',
          amount: 80,
          operationNumber: '3333333',
          operationNumberRaw: '3333333',
          documentNumber: 'B006-0002',
          paymentMethod: 'mercado_pago',
        }),
      ],
      matches: [
        {
          id: 'm1',
          sessionId: sid,
          bankMovementId: 'b1',
          salesMovementId: 's1',
          confidence: 0.99,
          matchStrategy: 'operation_number',
          ruleCode: 'RULE-001',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const prepared = prepareSessionForPartialMatching(dataset, sid);
    expect(prepared.matches).toHaveLength(1);

    const result = runReconciliationEngine(dataset, sid);
    expect(result.matches.some((m) => m.id === 'm1')).toBe(true);
    expect(result.movements.find((m) => m.id === 'b1')?.workflowStatus).toBe('reconciled');
    expect(result.movements.find((m) => m.id === 's2')?.workflowStatus).toBe('reconciled');
  });
});
