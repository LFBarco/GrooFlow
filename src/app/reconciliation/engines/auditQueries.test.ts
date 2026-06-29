import { describe, expect, it } from 'vitest';

import { createEmptyDataset } from '../domain/dataset';
import type { CanonicalMovement, ReconciliationDataset } from '../domain/types';
import { buildAuditRows, computeAuditSummary, filterAuditRows } from './auditQueries';

function mov(
  partial: Partial<CanonicalMovement> & Pick<CanonicalMovement, 'id' | 'sourceType' | 'side' | 'amount'>
): CanonicalMovement {
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

  it('filtra por banco sin venta sin depender de ruleCodes', () => {
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
          workflowStatus: 'normalized',
        }),
        mov({
          id: 'x2',
          sourceType: 'sales_erp',
          side: 'sales_application',
          amount: 20,
          workflowStatus: 'normalized',
        }),
      ],
      matches: [],
    };
    const rows = buildAuditRows(dataset, sid);
    expect(rows.find((r) => r.bank?.id === 'x1')?.status).toBe('orphan_bank');
    expect(rows.find((r) => r.sales?.id === 'x2')?.status).toBe('orphan_sales');

    const filteredBank = filterAuditRows(rows, { status: 'orphan_bank' });
    expect(filteredBank).toHaveLength(1);
    expect(filteredBank[0]?.bank?.id).toBe('x1');

    const filteredSales = filterAuditRows(rows, { status: 'orphan_sales' });
    expect(filteredSales).toHaveLength(1);
    expect(filteredSales[0]?.sales?.id).toBe('x2');
  });

  it('filtra por fuente y conciliados', () => {
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
          operationNumber: '999',
        }),
        mov({
          id: 's1',
          sourceType: 'sales_erp',
          side: 'sales_application',
          amount: 50,
          workflowStatus: 'reconciled',
          operationNumber: '999',
        }),
        mov({
          id: 'b2',
          sourceType: 'bcp_bank',
          side: 'bank_or_gateway',
          amount: 80,
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
    const rows = buildAuditRows(dataset, sid);
    const mpOnly = filterAuditRows(rows, { status: 'reconciled', source: 'mercado_pago' });
    expect(mpOnly).toHaveLength(1);
    expect(mpOnly[0]?.bank?.sourceType).toBe('mercado_pago');

    const bcpOnly = filterAuditRows(rows, { status: 'all', source: 'bcp_bank' });
    expect(bcpOnly).toHaveLength(1);
    expect(bcpOnly[0]?.bank?.id).toBe('b2');
  });

  it('filtra por búsqueda de número de operación', () => {
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
          operationNumber: '02525188',
          operationNumberRaw: '02525188',
        }),
        mov({
          id: 'b2',
          sourceType: 'bcp_bank',
          side: 'bank_or_gateway',
          amount: 80,
          operationNumber: '1111111',
        }),
      ],
      matches: [],
    };
    const rows = buildAuditRows(dataset, sid);
    const found = filterAuditRows(rows, { status: 'all', search: '2525188' });
    expect(found).toHaveLength(1);
    expect(found[0]?.bank?.id).toBe('b1');
  });
});
