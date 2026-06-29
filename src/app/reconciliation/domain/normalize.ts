import type { PaymentMethodHint } from './types';

/** Normaliza clave de columna Excel (sin acentos, minúsculas). */
export function normalizeImportKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function getImportCell(row: Record<string, unknown>, ...aliases: string[]): unknown {
  for (const alias of aliases) {
    const target = normalizeImportKey(alias);
    for (const key of Object.keys(row)) {
      if (normalizeImportKey(key) === target) {
        const v = row[key];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
    }
  }
  for (const alias of aliases) {
    if (alias in row) {
      const v = row[alias];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
  }
  /** Encabezados largos tipo «Fecha de compra (date_created)». */
  for (const alias of aliases) {
    const target = normalizeImportKey(alias);
    if (target.length < 4) continue;
    for (const key of Object.keys(row)) {
      const nk = normalizeImportKey(key);
      if (nk.includes(target)) {
        const v = row[key];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
    }
  }
  return undefined;
}

/** Valor por índice de columna (A=0, B=1, …) según orden del Excel exportado. */
export function getImportCellByIndex(row: Record<string, unknown>, index: number): unknown {
  const values = Object.values(row);
  if (index < 0 || index >= values.length) return undefined;
  const v = values[index];
  if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  return undefined;
}

/** Longitud unificada de la clave de cruce entre BCP, MP, Niubiz y ventas ERP. */
export const OPERATION_MATCH_DIGITS = 7;

/**
 * Clave de cruce PETMAX: últimos 7 dígitos; si hay menos, ceros a la izquierda.
 * Aplica a todos los reportes (BCP, Mercado Pago, Niubiz, ventas ERP).
 */
export function normalizeOperationNumber(raw: unknown): { normalized: string; raw: string } {
  const rawStr = String(raw ?? '').trim();
  if (!rawStr) return { normalized: '', raw: '' };
  const digits = rawStr.replace(/\D/g, '');
  if (!digits) return { normalized: '', raw: rawStr };
  const last7 =
    digits.length > OPERATION_MATCH_DIGITS ? digits.slice(-OPERATION_MATCH_DIGITS) : digits;
  return { normalized: last7.padStart(OPERATION_MATCH_DIGITS, '0'), raw: rawStr };
}

/** @deprecated Usar normalizeOperationNumber — misma regla de 7 dígitos. */
export function normalizeGatewayOperationNumber(raw: unknown): { normalized: string; raw: string } {
  return normalizeOperationNumber(raw);
}

export function isMercadoPagoApprovedStatus(status: unknown): boolean {
  const s = String(status ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!s) return false;
  return (
    s === 'approved' ||
    s === 'aprobado' ||
    s === 'aprovado' ||
    s.startsWith('approved') ||
    s.startsWith('aprobado') ||
    s.startsWith('aprovado')
  );
}

export function parseImportAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.abs(value);
  let s = String(value).trim().replace(/\s/g, '');
  s = s.replace(/^(S\/\.?|S\/|\$|USD|PEN)/i, '');
  if (/^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

export function parseImportDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && value > 20000 && value < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

const METHOD_ALIASES: Array<{ hints: string[]; method: PaymentMethodHint }> = [
  { hints: ['yape'], method: 'yape' },
  { hints: ['plin'], method: 'yape' },
  { hints: ['interbanc', 'otro banco', 'cci'], method: 'transfer_interbank' },
  { hints: ['transfer', 'bcp', 'abono'], method: 'transfer_bcp' },
  { hints: ['efectivo', 'cash'], method: 'cash' },
  { hints: ['pos', 'tarjeta', 'visa', 'mastercard'], method: 'pos' },
  { hints: ['mercado', 'mercadopago', 'mp'], method: 'mercado_pago' },
  { hints: ['niubiz', 'pago link', 'pagolink', 'link'], method: 'niubiz' },
];

export function inferPaymentMethod(text: unknown, sourceHint?: PaymentMethodHint): PaymentMethodHint {
  if (sourceHint && sourceHint !== 'unknown') return sourceHint;
  const s = String(text ?? '').toLowerCase();
  for (const row of METHOD_ALIASES) {
    if (row.hints.some((h) => s.includes(h))) return row.method;
  }
  return 'unknown';
}

/** Normaliza N° operación a 7 dígitos para cruce (todos los medios y fuentes). */
export function normalizeOperationForMovement(
  raw: unknown,
  _paymentMethod?: PaymentMethodHint
): { normalized: string; raw: string } {
  return normalizeOperationNumber(raw);
}

export function operationNumbersMatch(a: unknown, b: unknown): boolean {
  const ka = normalizeOperationNumber(a).normalized;
  const kb = normalizeOperationNumber(b).normalized;
  return Boolean(ka && kb && ka === kb);
}

/** Ventas ERP: códigos 2–4 no traen monto ni medio — el importe se toma del banco al conciliar. */
export function salesMovementNeedsBankAmount(movement: {
  paymentMethod: PaymentMethodHint;
  amount: number;
  metadata?: Record<string, unknown>;
}): boolean {
  if (movement.metadata?.erpAmountFromBank === true) return true;
  return movement.paymentMethod === 'unknown' && movement.amount === 0;
}

export function operationMatchKey(operationNumber: string, amount?: number): string {
  const key = normalizeOperationNumber(operationNumber).normalized;
  return amount === undefined ? key : `${key}|${amount.toFixed(2)}`;
}

export function amountsEqual(a: number, b: number, tolerance = 0.05): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 999;
  return Math.abs(a - b) / 86400000;
}
