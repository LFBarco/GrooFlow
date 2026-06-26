import { describe, expect, it } from 'vitest';

import { createEmptyDataset } from '../domain/dataset';
import type { CanonicalMovement, ReconciliationDataset } from '../domain/types';
import { buildAuditRows, computeAuditSummary, filterAuditRows } from './auditQueries';

function mov(partial: Partial<CanonicalMovement> & Pick<CanonicalMovement, 'id' | 'sourceType' | 'side' | 'amount'>): CanonicalMovement {
  return {
    batchId: 'b1',
    sessionId: 's1',
    transactionDate: '2026-01-15',
    currency: 'PEN',
    operationNumber: '',
    operationNumberRaw: '',
    paymentMethod: 'yape',
    workflowStatus: 'pending',
    ruleCodes: [],
    metadata: {},
    ...partial,
  } as CanonicalMovement;
}

describe('auditQueries', () => {
  it('resume contadores de auditoría', () => {
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
          matchedMovementId: 's1',
          operationNumber: '111',
        }),
        mov({
          id: 's1',
          sourceType: 'sales_erp',
          side: 'sales_application',
          amount: 50,
          workflowStatus: 'reconciled',
          matchedMovementId: 'b1',
          operationNumber: '111',
          documentNumber: 'B001',
        }),
        mov({
          id: 'b2',
          sourceType: 'bcp_bank',
          side: 'bank_or_gateway',
          amount: 80,
          ruleCodes: ['RULE-002'],
        }),
      ],
      matches: [
        {
          id: 'm1',
          sessionId: sid,
          bankMovementId: 'b1',
          salesMovementId: 's1',
          confidence: 0.98,
          matchStrategy: 'operation_number',
          ruleCode: 'RULE-001',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const summary = computeAuditSummary(dataset, sid);
    expect(summary.reconciledPairs).toBe(1);
    expect(summary.orphanBank).toBe(1);
    expect(summary.byStrategy.operation_number).toBe(1);
  });

  it('filtra por banco sin venta', () => {
    const sid = 's1';
    const dataset: ReconciliationDataset = {
      ...createEmptyDataset(),
      activeSessionId: sid,
      movements: [
        mov({
          id: 'x1',
          sourceType: 'bcp_bank',
          side: 'bank_or_gateway',
          amount: 10,
          ruleCodes: ['RULE-002'],
        }),
        mov({
          id: 'x2',
          sourceType: 'sales_erp',
          side: 'sales_application',
          amount: 20,
          ruleCodes: ['RULE-003'],
        }),
      ],
      matches: [],
    };
    const rows = buildAuditRows(dataset, sid);
    const filtered = filterAuditRows(rows, { status: 'orphan_bank' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.bank?.id).toBe('x1');
  });
});
