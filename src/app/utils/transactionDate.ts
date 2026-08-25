import { format, isValid, parseISO, startOfDay } from 'date-fns';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_SEP = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;

function normalizeYear(year: number): number {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

/** Fecha local válida (día/mes/año en orden latinoamericano). */
function buildLocalDate(day: number, month: number, year: number): Date | null {
  const y = normalizeYear(year);
  const local = new Date(y, month - 1, day);
  if (
    isValid(local) &&
    local.getFullYear() === y &&
    local.getMonth() === month - 1 &&
    local.getDate() === day
  ) {
    return startOfDay(local);
  }
  return null;
}

/** Serial de Excel (días desde 1899-12-30) → Date local. */
function parseExcelSerialDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 120000) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  const parsed = new Date(utcMs);
  if (!isValid(parsed)) return null;
  return startOfDay(
    new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
}

/** Convierte fechas de transacciones (Date, ISO string, DD/MM/YYYY, serial Excel) a `Date` local.
 *  Si no se puede interpretar, retorna `null` (no inventa “hoy”).
 */
export function tryParseAppDate(value: unknown): Date | null {
  if (value instanceof Date && isValid(value)) return startOfDay(value);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateOnly = DATE_ONLY.exec(trimmed);
    if (dateOnly) {
      const parsed = buildLocalDate(
        Number(dateOnly[3]),
        Number(dateOnly[2]),
        Number(dateOnly[1])
      );
      if (parsed) return parsed;
    }

    const dmy = DMY_SEP.exec(trimmed);
    if (dmy) {
      const parsed = buildLocalDate(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]));
      if (parsed) return parsed;
    }

    const iso = parseISO(trimmed);
    if (isValid(iso)) return startOfDay(iso);

    const legacy = new Date(trimmed);
    if (isValid(legacy)) return startOfDay(legacy);
    return null;
  }

  if (typeof value === 'number') {
    const excel = parseExcelSerialDate(value);
    if (excel) return excel;

    const parsed =
      value > 1e12 ? new Date(value) : value > 1e9 ? new Date(value * 1000) : new Date(value);
    if (isValid(parsed)) return startOfDay(parsed);
  }

  return null;
}

/** Igual que `tryParseAppDate`, con fallback a hoy si el valor es inválido. */
export function parseTransactionDate(value: unknown): Date {
  return tryParseAppDate(value) ?? startOfDay(new Date());
}

/** Formato `yyyy-MM-dd` para inputs HTML de tipo date. */
export function formatDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
