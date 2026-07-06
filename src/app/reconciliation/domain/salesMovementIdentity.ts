import type { CanonicalMovement } from './types';

/** Clave estable: comprobante + fecha pago + monto + slot código operación. */
export function salesMovementBusinessKey(
  m: Pick<CanonicalMovement, 'documentNumber' | 'transactionDate' | 'amount' | 'metadata'>
): string {
  const doc = (m.documentNumber ?? '').trim().toUpperCase();
  const slot = Number(m.metadata?.erpOpCodeSlot ?? 1);
  const amount = Math.round((Number(m.amount) || 0) * 100) / 100;
  return `${doc}|${m.transactionDate}|${amount}|${slot}`;
}

/** Campos que, si cambian en el ERP, pueden invalidar un cruce previo. */
export function salesMovementCriticalFingerprint(
  m: Pick<
    CanonicalMovement,
    'operationNumber' | 'operationNumberRaw' | 'paymentMethod' | 'amount' | 'transactionDate'
  >
): string {
  const amount = Math.round((Number(m.amount) || 0) * 100) / 100;
  return [
    m.operationNumber ?? '',
    m.operationNumberRaw ?? '',
    m.paymentMethod,
    amount,
    m.transactionDate,
  ].join('|');
}

export function isLockedReconciledMovement(m: CanonicalMovement): boolean {
  return m.workflowStatus === 'reconciled' && Boolean(m.matchId) && Boolean(m.matchedMovementId);
}
