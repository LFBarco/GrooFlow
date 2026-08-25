import type { BankMovement, Invoice, Subscription } from './types';

function asDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function asOptionalDate(value: unknown): Date | undefined {
  if (value == null || value === '') return undefined;
  const parsed = asDate(value);
  return parsed;
}

/** Rehidrata facturas de tesorería tras JSON/KV (fechas llegan como ISO). */
export function normalizeTreasuryInvoices(raw: unknown): Invoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Invoice;
    return {
      ...r,
      issueDate: asDate(r.issueDate),
      dueDate: asDate(r.dueDate),
      tentativePaymentDate: asDate(r.tentativePaymentDate ?? r.dueDate),
    };
  });
}

/** Rehidrata movimientos de extracto bancario. */
export function normalizeTreasuryBankMovements(raw: unknown): BankMovement[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as BankMovement;
    return {
      ...r,
      date: asDate(r.date),
      amount: Number(r.amount) || 0,
    };
  });
}

/** Rehidrata suscripciones / gastos recurrentes. */
export function normalizeTreasurySubscriptions(raw: unknown): Subscription[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Subscription;
    return {
      ...r,
      amount: Number(r.amount) || 0,
      dayOfMonth: Math.min(28, Math.max(1, Number(r.dayOfMonth) || 1)),
      autoGenerate: r.autoGenerate !== false,
      lastGenerated: asOptionalDate(r.lastGenerated),
      nextDueDate: asDate(r.nextDueDate),
    };
  });
}
