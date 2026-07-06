import { amountsEqual, salesMovementNeedsBankAmount } from './normalize';
import type { CanonicalMovement } from './types';

const BANK_SOURCES = new Set(['bcp_bank', 'mercado_pago', 'niubiz']);

export function isBankMovement(m: CanonicalMovement): boolean {
  return m.side === 'bank_or_gateway' || BANK_SOURCES.has(m.sourceType);
}

export function isSalesMovement(m: CanonicalMovement): boolean {
  return m.sourceType === 'sales_erp' || m.side === 'sales_application';
}

/** Ventas ERP vinculadas a un abono bancario (mismo matchId o matchedMovementId). */
export function salesLinkedToBank(
  movements: CanonicalMovement[],
  bankId: string
): CanonicalMovement[] {
  const bank = movements.find((m) => m.id === bankId);
  if (!bank) return [];

  const matchId = bank.matchId;
  return movements.filter((m) => {
    if (!isSalesMovement(m)) return false;
    if (m.matchedMovementId === bankId) return true;
    if (matchId && m.matchId === matchId) return true;
    return false;
  });
}

export function salesAmountForGroupSum(sales: CanonicalMovement): number {
  if (salesMovementNeedsBankAmount(sales)) return 0;
  return Math.max(0, Number(sales.amount) || 0);
}

export function salesGroupTotal(salesGroup: CanonicalMovement[]): number {
  return (
    Math.round(salesGroup.reduce((acc, s) => acc + salesAmountForGroupSum(s), 0) * 100) / 100
  );
}

export function isGroupedBankReconciliation(
  bank: CanonicalMovement,
  movements: CanonicalMovement[]
): boolean {
  return salesLinkedToBank(movements, bank.id).length > 1;
}

export function bankSalesAmountsMatch(
  bank: CanonicalMovement,
  salesGroup: CanonicalMovement[],
  tolerance = 0.05
): boolean {
  if (salesGroup.length === 0) return false;
  if (salesGroup.length === 1) {
    return amountsEqual(bank.amount, salesGroup[0]!.amount, tolerance);
  }
  return amountsEqual(bank.amount, salesGroupTotal(salesGroup), tolerance);
}

export function resolveSalesGroupForMatch(
  movements: CanonicalMovement[],
  bank: CanonicalMovement | undefined,
  salesMovementIds?: string[]
): CanonicalMovement[] | undefined {
  if (!bank) return undefined;

  const byId = new Map(movements.map((m) => [m.id, m]));
  const fromIds = (salesMovementIds ?? [])
    .map((id) => byId.get(id))
    .filter((m): m is CanonicalMovement => Boolean(m));

  const linked =
    fromIds.length > 1 ? fromIds : salesLinkedToBank(movements, bank.id);

  return linked.length > 1 ? linked : undefined;
}
