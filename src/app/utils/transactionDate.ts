import { format, isValid } from 'date-fns';

/** Convierte fechas de transacciones (Date, ISO string, timestamp) a `Date` válido. */
export function parseTransactionDate(value: unknown): Date {
  if (value instanceof Date && isValid(value)) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

/** Formato `yyyy-MM-dd` para inputs HTML de tipo date. */
export function formatDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
