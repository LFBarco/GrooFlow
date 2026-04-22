import { endOfWeek, format, getWeek, setWeek, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PettyCashTransaction } from '../types';

/** Rango según fechas reales de movimientos de esa semana (más fiable que el calendario). */
export function weekRangeFromTransactions(
  txs: PettyCashTransaction[],
  weekStr: string
): string | null {
  const active = txs.filter(
    (e) =>
      e.weekNumber?.toString() === weekStr &&
      e.status !== 'voided' &&
      e.status !== 'rejected'
  );
  if (active.length === 0) return null;
  const times = active.map((e) => new Date(e.date).getTime());
  const min = new Date(Math.min(...times));
  const max = new Date(Math.max(...times));
  if (min.getTime() === max.getTime()) {
    return format(min, 'dd/MM/yyyy', { locale: es });
  }
  return `${format(min, 'dd/MM/yyyy', { locale: es })} – ${format(max, 'dd/MM/yyyy', { locale: es })}`;
}

/**
 * Rango calendario de la semana `w` alineado con `format(date, 'w')` de date-fns
 * (weekStartsOn: 1, sin locale = mismo criterio que el guardado en `weekNumber`).
 */
export function weekRangeFromCalendarWeek(weekStr: string, referenceYear?: number): string {
  const wn = parseInt(weekStr, 10);
  if (!Number.isFinite(wn)) return '';
  const year = referenceYear ?? new Date().getFullYear();
  const opts = { weekStartsOn: 1 as const };
  const midYear = new Date(year, 5, 15);
  let d = setWeek(midYear, wn, opts);
  if (getWeek(d, opts) !== wn) {
    d = setWeek(new Date(year, 0, 7), wn, opts);
  }
  const start = startOfWeek(d, opts);
  const end = endOfWeek(d, opts);
  return `${format(start, 'dd/MM/yyyy', { locale: es })} – ${format(end, 'dd/MM/yyyy', { locale: es })}`;
}
