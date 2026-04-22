/**
 * Tipo de documento de egreso caja chica. Solo "Factura" desglosa base + IGV;
 * el resto va el importe completo al gasto.
 */
export const PETTY_CASH_RECEIPT_TYPES = [
  'Boleta',
  'Factura',
  'RXH',
  'Recibo Simple',
  'Planilla de Movilidad',
] as const;

export type PettyCashReceiptType = (typeof PETTY_CASH_RECEIPT_TYPES)[number];

export function receiptTypeUsesIgv(
  receiptType: string | undefined | null
): boolean {
  return (receiptType || '').trim() === 'Factura';
}
