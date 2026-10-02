import type { ParsedSunatQr } from './sunatQr';

export type PettyCashQrFields = {
  classification: 'Factura' | 'Boleta' | null;
  docType: 'RUC';
  docNumber: string;
  docSeries: string;
  voucherNumber: string;
  documentDate: string;
  /** Base imponible (Factura) o total (otros tipos), como texto con 2 decimales. */
  amountBI: string;
  amountExempt: string;
  invoiceIgv10: boolean;
  compradorDoc: string;
};

const TOLERANCE = 0.05;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Montos de una Factura a partir de IGV y total del QR (detecta 18 % / 10 % y parte inafecta). */
export function splitInvoiceAmounts(igv: number, total: number): { base: number; exempt: number; igv10: boolean } {
  const base = r2(total - igv);
  if (igv <= 0 || base <= 0) return { base: r2(total), exempt: 0, igv10: false };
  if (Math.abs(base * 0.18 - igv) <= TOLERANCE) return { base, exempt: 0, igv10: false };
  if (Math.abs(base * 0.1 - igv) <= TOLERANCE) return { base, exempt: 0, igv10: true };
  for (const [rate, igv10] of [
    [0.18, false],
    [0.1, true],
  ] as const) {
    const taxed = r2(igv / rate);
    const exempt = r2(total - taxed - igv);
    if (exempt >= 0) return { base: taxed, exempt, igv10 };
  }
  return { base, exempt: 0, igv10: false };
}

export function qrToPettyCashFields(qr: ParsedSunatQr): PettyCashQrFields {
  const classification = qr.tipoDoc === '01' ? 'Factura' : qr.tipoDoc === '03' ? 'Boleta' : null;
  const total = qr.total ?? 0;
  let amountBI = total > 0 ? total.toFixed(2) : '';
  let amountExempt = '';
  let invoiceIgv10 = false;
  if (classification === 'Factura' && total > 0 && qr.igv != null) {
    const split = splitInvoiceAmounts(qr.igv, total);
    amountBI = split.base.toFixed(2);
    amountExempt = split.exempt > 0 ? split.exempt.toFixed(2) : '';
    invoiceIgv10 = split.igv10;
  }
  return {
    classification,
    docType: 'RUC',
    docNumber: qr.emisorRuc,
    docSeries: qr.serie,
    voucherNumber: qr.numero,
    documentDate: qr.fechaEmision,
    amountBI,
    amountExempt,
    invoiceIgv10,
    compradorDoc: qr.compradorDoc,
  };
}
