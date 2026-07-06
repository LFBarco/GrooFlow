import { addWeeks, getWeek, getWeekYear, setWeek, setWeekYear, subWeeks } from 'date-fns';

const WEEK_OPTS = { weekStartsOn: 1 as const };

type ParsedWeekKey = {
  year: number | null;
  week: number | null;
  normalized: string;
  isLegacy: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formato canónico: YYYY-Www (ej. 2026-W01). */
export function getPettyCashWeekKey(date: Date): string {
  const year = getWeekYear(date, WEEK_OPTS);
  const week = getWeek(date, WEEK_OPTS);
  return `${year}-W${pad2(week)}`;
}

export function parsePettyCashWeekKey(raw: string | number | null | undefined): ParsedWeekKey {
  const text = String(raw ?? '').trim();
  const m = text.match(/^(\d{4})-W(\d{1,2})$/i);
  if (m) {
    const year = parseInt(m[1], 10);
    const week = parseInt(m[2], 10);
    if (Number.isFinite(year) && Number.isFinite(week) && week >= 1 && week <= 53) {
      return { year, week, normalized: `${year}-W${pad2(week)}`, isLegacy: false };
    }
  }
  const legacyWeek = parseInt(text, 10);
  if (Number.isFinite(legacyWeek) && legacyWeek >= 1 && legacyWeek <= 53) {
    return { year: null, week: legacyWeek, normalized: String(legacyWeek), isLegacy: true };
  }
  return { year: null, week: null, normalized: text, isLegacy: true };
}

/**
 * Compatibilidad:
 * - Nuevo vs nuevo: igualdad exacta de YYYY-Www.
 * - Si alguna parte es legado numérico: compara por número de semana.
 */
export function weekKeyMatches(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): boolean {
  const pa = parsePettyCashWeekKey(a);
  const pb = parsePettyCashWeekKey(b);
  if (pa.week == null || pb.week == null) return false;
  if (!pa.isLegacy && !pb.isLegacy) return pa.normalized === pb.normalized;
  return pa.week === pb.week;
}

export function getPreviousWeekKey(key: string): string | null {
  const parsed = parsePettyCashWeekKey(key);
  if (parsed.week == null) return null;
  if (parsed.year == null) {
    // Legado: conserva comportamiento antiguo numérico.
    const prev = parsed.week - 1;
    return prev >= 1 ? String(prev) : null;
  }
  let d = setWeekYear(new Date(parsed.year, 0, 4), parsed.year, WEEK_OPTS);
  d = setWeek(d, parsed.week, WEEK_OPTS);
  return getPettyCashWeekKey(subWeeks(d, 1));
}

export function getNextWeekKey(key: string): string | null {
  const parsed = parsePettyCashWeekKey(key);
  if (parsed.week == null) return null;
  if (parsed.year == null) {
    const next = parsed.week + 1;
    return next <= 53 ? String(next) : null;
  }
  let d = setWeekYear(new Date(parsed.year, 0, 4), parsed.year, WEEK_OPTS);
  d = setWeek(d, parsed.week, WEEK_OPTS);
  return getPettyCashWeekKey(addWeeks(d, 1));
}

/** Orden cronológico ascendente (semana antigua primero). */
export function comparePettyCashWeekKeys(a: string, b: string): number {
  const pa = parsePettyCashWeekKey(a);
  const pb = parsePettyCashWeekKey(b);
  if (pa.year != null && pb.year != null && pa.year !== pb.year) return pa.year - pb.year;
  return (pa.week ?? 0) - (pb.week ?? 0);
}

