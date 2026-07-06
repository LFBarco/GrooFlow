import { describe, expect, it } from 'vitest';

import type { CanonicalMovement } from '../domain/types';
import {
  applyGroupMatchToMovements,
  applyMatchToMovements,
  buildMatchFromCandidate,
  findMatchCandidates,
} from './matchingEngine';

function mov(
  partial: Partial<CanonicalMovement> &
    Pick<CanonicalMovement, 'id' | 'sourceType' | 'side' | 'amount' | 'operationNumber'>
): CanonicalMovement {
  return {
    batchId: 'b1',
    sessionId: 's1',
    transactionDate: '2026-06-26',
    currency: 'PEN',
    operationNumberRaw: partial.operationNumber,
    paymentMethod: 'yape',
    workflowStatus: 'pending',
    ruleCodes: [],
    metadata: {},
    ...partial,
  } as CanonicalMovement;
}

describe('matchingEngine', () => {
  it('empareja por número de operación y monto', () => {
    const bank = mov({
      id: 'b1',
      sourceType: 'bcp_bank',
      side: 'bank_or_gateway',
      amount: 50,
      operationNumber: '1234567',
      paymentMethod: 'yape',
    });
    const sales = mov({
      id: 's1',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 50,
      operationNumber: '1234567',
      paymentMethod: 'yape',
    });
    const candidates = findMatchCandidates([bank], [sales]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.strategy).toBe('operation_number');
    expect(candidates[0]?.sales).toHaveLength(1);
  });

  it('agrupa varias ventas ERP con el mismo N° de operación cuando la suma cuadra', () => {
    const bank = mov({
      id: 'b-mp',
      sourceType: 'mercado_pago',
      side: 'bank_or_gateway',
      amount: 55,
      operationNumber: '3938867',
      operationNumberRaw: '166413938867',
      paymentMethod: 'mercado_pago',
      transactionDate: '2026-07-04',
    });
    const sales1 = mov({
      id: 's-a',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 20,
      operationNumber: '3938867',
      operationNumberRaw: '166413938867',
      paymentMethod: 'mercado_pago',
      transactionDate: '2026-07-05',
      documentNumber: 'B004-00115955',
    });
    const sales2 = mov({
      id: 's-b',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 35,
      operationNumber: '3938867',
      operationNumberRaw: '166413938867',
      paymentMethod: 'mercado_pago',
      transactionDate: '2026-07-05',
      documentNumber: 'B004-00115956',
    });

    const candidates = findMatchCandidates([bank], [sales1, sales2]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.strategy).toBe('operation_number_grouped');
    expect(candidates[0]?.sales.map((s) => s.id).sort()).toEqual(['s-a', 's-b']);

    const match = buildMatchFromCandidate(candidates[0]!, 's1');
    expect(match.salesMovementIds).toEqual(['s-a', 's-b']);

    const applied = applyGroupMatchToMovements(bank, candidates[0]!.sales, match);
    expect(applied.bank.workflowStatus).toBe('reconciled');
    expect(applied.sales.every((s) => s.workflowStatus === 'reconciled')).toBe(true);
  });

  it('no agrupa si la suma ERP excede el abono bancario', () => {
    const bank = mov({
      id: 'b-mp2',
      sourceType: 'mercado_pago',
      side: 'bank_or_gateway',
      amount: 50,
      operationNumber: '1111111',
      paymentMethod: 'mercado_pago',
    });
    const sales1 = mov({
      id: 's1',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 30,
      operationNumber: '1111111',
      paymentMethod: 'mercado_pago',
    });
    const sales2 = mov({
      id: 's2',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 30,
      operationNumber: '1111111',
      paymentMethod: 'mercado_pago',
    });
    const candidates = findMatchCandidates([bank], [sales1, sales2]);
    expect(candidates.some((c) => c.strategy === 'operation_number_grouped')).toBe(false);
  });

  it('empareja Cod. Op. Pago 2 por últimos 7 dígitos del N° operación', () => {
    const bank = mov({
      id: 'b2',
      sourceType: 'mercado_pago',
      side: 'bank_or_gateway',
      amount: 80,
      operationNumber: '3210123',
      operationNumberRaw: '9876543210123',
      paymentMethod: 'mercado_pago',
    });
    const sales = mov({
      id: 's2',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 0,
      operationNumber: '3210123',
      operationNumberRaw: '9876543210123',
      paymentMethod: 'unknown',
      metadata: { erpOpCodeSlot: 2, erpAmountFromBank: true },
    });
    const candidates = findMatchCandidates([bank], [sales]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.sales[0]?.id).toBe('s2');
  });

  it('no empareja si el N° operación (7 dígitos) no coincide', () => {
    const bank = mov({
      id: 'b3',
      sourceType: 'mercado_pago',
      side: 'bank_or_gateway',
      amount: 60,
      operationNumber: '8941125',
      paymentMethod: 'mercado_pago',
    });
    const sales = mov({
      id: 's3',
      sourceType: 'sales_erp',
      side: 'sales_application',
      amount: 60,
      operationNumber: '9302607',
      paymentMethod: 'mercado_pago',
    });
    expect(findMatchCandidates([bank], [sales])).toHaveLength(0);
    const applied = applyMatchToMovements(bank, sales, {
      id: 'm',
      sessionId: 's1',
      bankMovementId: 'b3',
      salesMovementId: 's3',
      confidence: 1,
      matchStrategy: 'operation_number',
      ruleCode: 'RULE-001',
      createdAt: '',
    });
    expect(applied.bank.workflowStatus).toBe('pending');
    expect(applied.sales.workflowStatus).toBe('pending');
  });
});
