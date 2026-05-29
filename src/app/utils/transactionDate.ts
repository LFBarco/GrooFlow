import { format, isValid, parseISO, startOfDay } from 'date-fns';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Convierte fechas de transacciones (Date, ISO string, timestamp) a `Date` válido en hora local. */
export function parseTransactionDate(value: unknown): Date {
  if (value instanceof Date && isValid(value)) return startOfDay(value);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateOnly = DATE_ONLY.exec(trimmed);
    if (dateOnly) {
      const y = Number(dateOnly[1]);
      const m = Number(dateOnly[2]) - 1;
      const d = Number(dateOnly[3]);
      const local = new Date(y, m, d);
      if (isValid(local)) return local;
    }
    const iso = parseISO(trimmed);
    if (isValid(iso)) return startOfDay(iso);
    const legacy = new Date(trimmed);
    if (isValid(legacy)) return startOfDay(legacy);
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (isValid(parsed)) return startOfDay(parsed);
  }

  return startOfDay(new Date());
}

/** Formato `yyyy-MM-dd` para inputs HTML de tipo date. */
export function formatDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
