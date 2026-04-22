import type { PettyCashTransaction, User } from '../types';

function norm(s: string | undefined | null): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

/** Correlativo del comprobante para armar la clave (voucher o legado receiptNumber). */
export function pettyCashVoucherNro(tx: Pick<PettyCashTransaction, 'voucherNumber' | 'receiptNumber'>): string {
  const v = norm(tx.voucherNumber);
  if (v) return v;
  return norm(tx.receiptNumber);
}

/** Clave única lógica: documento de identidad + serie + nro comprobante (todo normalizado). */
export function pettyCashDocCompositeKey(
  docNumber: string,
  docSeries: string,
  voucherNro: string
): string {
  return `${norm(docNumber)}|${norm(docSeries)}|${norm(voucherNro)}`;
}

export function transactionDocCompositeKey(tx: PettyCashTransaction): string | null {
  if (tx.type === 'income') return null;
  const ruc = norm(tx.docNumber);
  const ser = norm(tx.docSeries);
  const nro = pettyCashVoucherNro(tx);
  if (!ruc || !ser || !nro) return null;
  return pettyCashDocCompositeKey(tx.docNumber || '', tx.docSeries || '', nro);
}

/**
 * Busca otro gasto activo con la misma clave RUC/DNI + serie + nro. documento.
 * Ignora anulados/rechazados y reposiciones (ingreso).
 */
export function findPettyCashDuplicate(
  transactions: PettyCashTransaction[],
  docNumber: string,
  docSeries: string,
  voucherNro: string,
  excludeId?: string
): PettyCashTransaction | undefined {
  if (!norm(docNumber) || !norm(docSeries) || !norm(voucherNro)) return undefined;
  const key = pettyCashDocCompositeKey(docNumber, docSeries, voucherNro);
  return transactions.find((t) => {
    if (excludeId && t.id === excludeId) return false;
    if (t.status === 'voided' || t.status === 'rejected') return false;
    if (t.type === 'income') return false;
    const tk = transactionDocCompositeKey(t);
    return tk !== null && tk === key;
  });
}

/** Editar / anular: gastos activos; pendientes por custodian/solicitante o rol; aprobados solo admin+. */
export function canModifyPettyCashExpense(t: PettyCashTransaction, u: User): boolean {
  if (t.type === 'income') return false;
  if (t.status === 'voided' || t.status === 'rejected') return false;
  const admin = ['admin', 'super_admin', 'manager'].includes(u.role);
  if (t.status === 'pending_audit') {
    return admin || t.custodianId === u.id || t.requester === u.name;
  }
  return admin;
}
