import { describe, expect, it } from 'vitest';

import {
  isLockedReconciledMovement,
  salesMovementBusinessKey,
  salesMovementCriticalFingerprint,
} from './salesMovementIdentity';
import type { CanonicalMovement } from './types';

function base(partial: Partial<CanonicalMovement>): CanonicalMovement {
  return {
    id: 'mv1',
    batchId: 'b1',
    sessionId: 's1',
    sourceType: 'sales_erp',
    side: 'sales_application',
    transactionDate: '2026-01-15',
    amount: 100,
    currency: 'PEN',
    operationNumber: '1234567',
    operationNumberRaw: '1234567',
    paymentMethod: 'yape',
    workflowStatus: 'reconciled',
    matchId: 'rm1',
    matchedMovementId: 'b1',
    ruleCodes: [],
    metadata: { erpOpCodeSlot: 1 },
    documentNumber: 'B006-0001',
    ...partial,
  } as CanonicalMovement;
}

describe('salesMovementIdentity', () => {
  it('genera clave por comprobante, fecha, monto y slot', () => {
    const m = base({});
    expect(salesMovementBusinessKey(m)).toBe('B006-0001|2026-01-15|100|1');
  });

  it('detecta conciliado bloqueado', () => {
    expect(isLockedReconciledMovement(base({}))).toBe(true);
    expect(isLockedReconciledMovement(base({ workflowStatus: 'normalized' }))).toBe(false);
  });

  it('detecta cambio en código de operación', () => {
    const a = base({});
    const b = base({ operationNumber: '9999999', operationNumberRaw: '9999999' });
    expect(salesMovementCriticalFingerprint(a)).not.toBe(salesMovementCriticalFingerprint(b));
  });
});
