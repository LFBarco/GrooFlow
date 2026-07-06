import { describe, expect, it } from 'vitest';

import { createEmptyDataset } from '../domain/dataset';
import type { CanonicalMovement, ReconciliationBatch } from '../domain/types';
import {
  deleteAllBatchesForSourceInSession,
  deleteReconciliationBatch,
} from './reconciliationRunner';

function movement(id: string, batchId: string, source: CanonicalMovement['sourceType']): CanonicalMovement {
  return {
    id,
    batchId,
    sessionId: 'rs1',
    sourceType: source,
    operationNumber: '1234567',
    amount: 100,
    currency: 'PEN',
    transactionDate: '2026-06-26',
    workflowStatus: 'normalized',
    ruleCodes: [],
    metadata: {},
  };
}

function batch(id: string, source: ReconciliationBatch['sourceType']): ReconciliationBatch {
  return {
    id,
    sessionId: 'rs1',
    sourceType: source,
    fileName: `${source}.xlsx`,
    importedAt: '2026-06-26T10:00:00.000Z',
    recordCount: 1,
    status: 'completed',
    errors: [],
  };
}

describe('deleteReconciliationBatch', () => {
  it('elimina movimientos del lote y recalcula', () => {
    const base = createEmptyDataset();
    const dataset = {
      ...base,
      activeSessionId: 'rs1',
      sessions: [{ id: 'rs1', label: '2026-06-26', createdAt: '' }],
      batches: [batch('b1', 'sales_erp'), batch('b2', 'mercado_pago')],
      movements: [movement('m1', 'b1', 'sales_erp'), movement('m2', 'b2', 'mercado_pago')],
    };
    const next = deleteReconciliationBatch(dataset, 'b1');
    expect(next.batches).toHaveLength(1);
    expect(next.movements).toHaveLength(1);
    expect(next.movements[0]?.batchId).toBe('b2');
  });
});

describe('deleteAllBatchesForSourceInSession', () => {
  it('elimina todos los lotes de una fuente en la sesión', () => {
    const base = createEmptyDataset();
    const dataset = {
      ...base,
      activeSessionId: 'rs1',
      sessions: [{ id: 'rs1', label: '2026-06-26', createdAt: '' }],
      batches: [batch('b1', 'sales_erp'), batch('b2', 'sales_erp'), batch('b3', 'bcp_bank')],
      movements: [
        movement('m1', 'b1', 'sales_erp'),
        movement('m2', 'b2', 'sales_erp'),
        movement('m3', 'b3', 'bcp_bank'),
      ],
    };
    const next = deleteAllBatchesForSourceInSession(dataset, 'rs1', 'sales_erp');
    expect(next.batches.map((b) => b.id)).toEqual(['b3']);
    expect(next.movements).toHaveLength(1);
    expect(next.movements[0]?.sourceType).toBe('bcp_bank');
  });
});
