import { eachMonthOfInterval, format, getDaysInMonth, parseISO, startOfMonth } from 'date-fns';
import type { SmartCashFlowScheduleLine, Transaction } from '../types';
import type { CategoryDefinition, ConfigStructure } from '../data/initialData';
import { getConceptsFlat } from '../data/initialData';
import type { IsoDate } from './types';

export type HistoricalKindFilter = 'all' | 'income' | 'expense';
export type HistoricalDistribution = 'lump_at_start' | 'month_avg_per_horizon_month';

function normRow(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function clampDayInMonth(monthDate: Date, dayHint: number): number {
  const dim = getDaysInMonth(monthDate);
  return Math.min(Math.max(1, dayHint), dim);
}

function monthAnchorIso(monthDate: Date, defaultDayHint: number): IsoDate {
  const d = clampDayInMonth(monthDate, defaultDayHint);
  return format(new Date(monthDate.getFullYear(), monthDate.getMonth(), d), 'yyyy-MM-dd');
}

/** Meses naturales inclusivos cubiertos por [from, to]. */
export function countCalendarMonthsInclusive(from: IsoDate, to: IsoDate): number {
  const a = startOfMonth(parseISO(from));
  const b = startOfMonth(parseISO(to));
  return eachMonthOfInterval({ start: a, end: b }).length;
}

/** Meses naturales del horizonte de proyección. */
export function horizonCalendarMonths(horizonStart: IsoDate, horizonEnd: IsoDate): Date[] {
  const a = startOfMonth(parseISO(horizonStart));
  const b = startOfMonth(parseISO(horizonEnd));
  return eachMonthOfInterval({ start: a, end: b });
}

function matchExpenseFlexFromConfig(
  catDef: CategoryDefinition | undefined,
  tx: Transaction
): {
  flexibility: 'fixed' | 'flexible';
  priorityRank?: number;
  defaultDay: number;
} {
  const fallback = { flexibility: 'flexible' as const, priorityRank: 95, defaultDay: 15 };
  if (!catDef || catDef.type !== 'expense') return fallback;
  const rowName = tx.concept || tx.subcategory;
  if (!rowName) return fallback;
  const concepts = getConceptsFlat(catDef);
  const hit =
    concepts.find((c) => c.name === rowName) ??
    concepts.find((c) => normRow(c.name) === normRow(rowName));
  if (!hit) return fallback;
  return {
    flexibility: hit.flexibility,
    priorityRank: hit.flexibility === 'flexible' ? 85 : undefined,
    defaultDay: hit.defaultDay ?? 15,
  };
}

interface AggBucket {
  kind: 'inflow' | 'outflow';
  category: string;
  rowLabel: string;
  total: number;
  flexibility: 'fixed' | 'flexible';
  priorityRank?: number;
  defaultDay: number;
}

/**
 * Agrupa totales históricos por categoría + fila de concepto (concepto ó subcategoría).
 */
export function aggregateHistoricalByCategoryRow(
  transactions: Transaction[],
  histStart: IsoDate,
  histEnd: IsoDate,
  kindFilter: HistoricalKindFilter,
  config: ConfigStructure
): AggBucket[] {
  const hs = parseISO(histStart);
  const heRaw = parseISO(histEnd);
  const he = new Date(heRaw.getFullYear(), heRaw.getMonth(), heRaw.getDate(), 23, 59, 59, 999);

  const map = new Map<string, AggBucket>();

  for (const tx of transactions) {
    const dRaw = tx.date instanceof Date ? tx.date : new Date(tx.date as string | number | Date);
    if (dRaw < hs || dRaw > he) continue;

    if (kindFilter === 'income' && tx.type !== 'income') continue;
    if (kindFilter === 'expense' && tx.type !== 'expense') continue;

    const rowLabel = tx.concept?.trim().length ? tx.concept!.trim()
      : tx.subcategory?.trim().length ? tx.subcategory!.trim() : 'General';
    const key = `${tx.type}|${tx.category}|${rowLabel}`;
    const catDef = config[String(tx.category)];

    let flexibility: 'fixed' | 'flexible' = 'flexible';
    let priorityRank: number | undefined = 92;
    let defaultDay = 15;
    if (tx.type === 'expense') {
      const inferred = matchExpenseFlexFromConfig(catDef, tx);
      flexibility = inferred.flexibility;
      priorityRank = inferred.priorityRank;
      defaultDay = inferred.defaultDay;
    }

    const amt = Number(tx.amount);
    const addAmt = Number.isFinite(amt) ? amt : 0;
    const prev = map.get(key);
    if (prev) prev.total += addAmt;
    else {
      map.set(key, {
        kind: tx.type === 'income' ? 'inflow' : 'outflow',
        category: String(tx.category),
        rowLabel,
        total: addAmt,
        flexibility,
        priorityRank,
        defaultDay,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'inflow' ? -1 : 1;
    return `${a.category} › ${a.rowLabel}`.localeCompare(`${b.category} › ${b.rowLabel}`);
  });
}

/**
 * Divide un total en `parts` porciones cuyos centavos suman exactamente `total`.
 */
export function splitAmountEvenlyAcrossParts(total: number, parts: number): number[] {
  if (!Number.isFinite(total) || parts <= 0) return [];
  const cents = Math.round(total * 100);
  const abs = Math.abs(cents);
  const sign = cents < 0 ? -1 : 1;
  const base = Math.floor(abs / parts);
  const rem = abs - base * parts;
  return Array.from({ length: parts }, (_, i) =>
    sign * ((base + (i < rem ? 1 : 0)) / 100)
  );
}

export interface BuildHistoricalScheduleLinesParams {
  transactions: Transaction[];
  config: ConfigStructure;
  histStart: IsoDate;
  histEnd: IsoDate;
  horizonStart: IsoDate;
  horizonEnd: IsoDate;
  kindFilter: HistoricalKindFilter;
  distribution: HistoricalDistribution;
}

/**
 * Genera líneas nuevas etiquetadas con prefijo Hist: para revisión del usuario antes de fusionarlas al programa.
 */
export function scheduleLinesFromHistoricalTransactions(
  p: BuildHistoricalScheduleLinesParams
): SmartCashFlowScheduleLine[] {
  const buckets = aggregateHistoricalByCategoryRow(
    p.transactions,
    p.histStart,
    p.histEnd,
    p.kindFilter,
    p.config
  );

  if (buckets.length === 0) return [];

  const histMonths = Math.max(1, countCalendarMonthsInclusive(p.histStart, p.histEnd));
  const horizonMonths = horizonCalendarMonths(p.horizonStart, p.horizonEnd);

  const out: SmartCashFlowScheduleLine[] = [];

  for (const b of buckets) {
    if (!Number.isFinite(b.total)) continue;

    const baseLabel = `[Hist ${p.histStart}→${p.histEnd}] ${b.category} › ${b.rowLabel}`;
    let lineIdStem = `${b.category}|${b.rowLabel}|${b.kind}`.slice(0, 80).replace(/\s+/g, '-');

    if (p.distribution === 'lump_at_start') {
      out.push({
        id: `scf-hist-lump-${lineIdStem.replace(/[^\w\-|]/gi, '').slice(0, 48)}-${b.kind}-${b.total}-${p.horizonStart}`,
        kind: b.kind,
        label: `${baseLabel} (total período)`,
        amount: b.total,
        date: p.horizonStart,
        flexibility: b.kind === 'inflow' ? 'flexible' : b.flexibility,
        priorityRank: b.flexibility === 'flexible' ? b.priorityRank : undefined,
      });
      continue;
    }

    /** Mensual típico del período histórico seleccionado. */
    const monthTemplate = b.total / histMonths;
    if (horizonMonths.length === 0) continue;

    const parts = splitAmountEvenlyAcrossParts(monthTemplate * horizonMonths.length, horizonMonths.length);

    horizonMonths.forEach((md, idx) => {
      const iso = monthAnchorIso(md, b.defaultDay);
      if (iso < p.horizonStart || iso > p.horizonEnd) return;
      out.push({
        id: `scf-hist-m${idx}-${lineIdStem.replace(/[^\w\-|]/gi, '').slice(0, 36)}-${format(md, 'yyyy-MM')}`,
        kind: b.kind,
        label: `${baseLabel} (${format(md, 'yyyy-MM')})`,
        amount: parts[idx] ?? 0,
        date: iso,
        flexibility: b.kind === 'inflow' ? 'flexible' : b.flexibility,
        priorityRank: b.flexibility === 'flexible' ? b.priorityRank : undefined,
      });
    });
  }

  out.sort((a, b) => (a.date === b.date ? a.label.localeCompare(b.label) : a.date.localeCompare(b.date)));
  return out;
}

/**
 * Totales efectivamente registrados en transacciones dentro del mismo rango que el horizonte (solo lectura / comparativa).
 */
export function realizedTotalsInHorizon(
  transactions: Transaction[],
  horizonStart: IsoDate,
  horizonEnd: IsoDate
): { income: number; expense: number; net: number } {
  const hs = parseISO(horizonStart);
  const heRaw = parseISO(horizonEnd);
  const he = new Date(heRaw.getFullYear(), heRaw.getMonth(), heRaw.getDate(), 23, 59, 59, 999);
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    const dRaw = tx.date instanceof Date ? tx.date : new Date(tx.date as string | number | Date);
    if (dRaw < hs || dRaw > he) continue;
    const n = Number(tx.amount);
    const amt = Number.isFinite(n) ? n : 0;
    if (tx.type === 'income') income += amt;
    else expense += amt;
  }
  return { income, expense, net: income - expense };
}
