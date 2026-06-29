import { describe, expect, it } from 'vitest';

import type { CanonicalMovement } from '../domain/types';
import { applyMatchToMovements, findMatchCandidates } from './matchingEngine';

function mov(partial: Partial<CanonicalMovement> & Pick<CanonicalMovement, 'id' | 'sourceType' | 'side' | 'amount' | 'operationNumber'>): CanonicalMovement {
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
    expect(candidates[0]?.sales.id).toBe('s2');
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
