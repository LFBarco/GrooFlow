import { describe, expect, it } from 'vitest';

import { createEmptyDataset } from '../domain/dataset';
import type { CanonicalMovement, ReconciliationDataset } from '../domain/types';
import {
  applyGroupMatchToMovements,
  buildMatchFromCandidate,
  findMatchCandidates,
} from './matchingEngine';
import { applyPostMatchRules } from './rulesEngine';

function mov(
  partial: Partial<CanonicalMovement> & Pick<CanonicalMovement, 'id' | 'sourceType' | 'side' | 'amount'>
): CanonicalMovement {
  return {
    batchId: 'b1',
    sessionId: 's1',
    transactionDate: '2026-07-04',
    currency: 'PEN',
    operationNumber: '',
    operationNumberRaw: '',
    paymentMethod: 'mercado_pago',
    workflowStatus: 'pending',
    ruleCodes: [],
    metadata: {},
    ...partial,
  } as CanonicalMovement;
}

describe('rulesEngine grouped reconciliation', () => {
  it('no marca RULE-005 cuando banco = suma de ventas agrupadas', () => {
    const bank = mov({
      id: 'b-mp',
      sourceType: 'mercado_pago',
      side: 'bank_or_gateway',
      amount: 55,
      operationNumber: '3938867',
      operationNumberRaw: '166413938867',
    });
    const sales1 = mov({
      id: 's-a',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 20,
      operationNumber: '3938867',
      operationNumberRaw: '166413938867',
    });
    const sales2 = mov({
      id: 's-b',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 35,
      operationNumber: '3938867',
      operationNumberRaw: '166413938867',
    });

    const candidate = findMatchCandidates([bank], [sales1, sales2])[0]!;
    const match = buildMatchFromCandidate(candidate, 's1');
    const applied = applyGroupMatchToMovements(bank, candidate.sales, match);

    const dataset: ReconciliationDataset = {
      ...createEmptyDataset(),
      activeSessionId: 's1',
      movements: [applied.bank, ...applied.sales],
      matches: [match],
    };

    const result = applyPostMatchRules(dataset, 's1');
    for (const m of result.movements) {
      expect(m.ruleCodes).not.toContain('RULE-005');
      expect(m.workflowStatus).toBe('reconciled');
    }
  });
});
