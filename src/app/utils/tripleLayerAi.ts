import { addDays, endOfYear, isAfter, isBefore, isWithinInterval, startOfDay, subMonths, endOfMonth, startOfMonth } from 'date-fns';
import type { Transaction } from '../types';
import { labelsMatch } from './labelMatch';
import { cellStorageKey } from './tripleLayerCashFlow';
import { parseTransactionDate } from './transactionDate';

/** Resultado sugerido por “IA” (promedio histórico simple) para una fila de concepto. */
export type AIProjectionSuggestion = {
  /** Monto sugerido mensual (promedio total en la ventana por mes, luego promedio mensual). */
  monthlyAmount: number;
  /** Promedio por día de ejecución (months / días con movimiento) — opcional. */
  confidence: 'low' | 'medium';
  windowLabel: string;
};

/**
 * Esqueleto de proyección IA: analiza ingresos reales de los últimos 3 meses
 * para una categoría + concepto concretos y propone un nivel base (Capa EST).
 */
export function getAIProjection(
  transactions: Transaction[],
  opts: {
    category: string;
    conceptName: string;
    asOfDate: Date;
    lookbackMonths?: number;
  }
): AIProjectionSuggestion | null {
  const lookback = opts.lookbackMonths ?? 3;
  const end = endOfMonth(opts.asOfDate);
  const start = startOfMonth(subMonths(end, lookback - 1));

  const relevant = transactions.filter((t) => {
    if (t.type !== 'income') return false;
    if (String(t.category) !== String(opts.category)) return false;
    const c = t.concept || t.subcategory;
    if (String(c || '') !== String(opts.conceptName)) return false;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) return false;
    return isWithinInterval(d, { start, end });
  });

  if (relevant.length === 0) return null;

  const total = relevant.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const monthlyAmount = total / lookback;

  return {
    monthlyAmount,
    confidence: relevant.length >= lookback * 2 ? 'medium' : 'low',
    windowLabel: `Últimos ${lookback} meses (hasta ${
      Number.isNaN(end.getTime()) ? 'fecha inválida' : end.toISOString().slice(0, 10)
    })`,
  };
}

/**
 * Mapa de sugerencias IA por clave `category|concept` (solo ingresos).
 */
export function buildAIIncomeEstimateMap(
  transactions: Transaction[],
  asOfDate: Date,
  incomeRows: { category: string; subcategory?: string; conceptName: string }[],
  opts?: {
    lookbackWeekdays?: number;
    minSamples?: number;
    horizonEnd?: Date;
  }
): Map<string, number> {
  const out = new Map<string, number>();
  const asOf = startOfDay(asOfDate);
  const horizonEnd = startOfDay(opts?.horizonEnd ?? endOfYear(asOf));
  const lookbackWeekdays = opts?.lookbackWeekdays ?? 12;

  for (const row of incomeRows) {
    const totalsByDate = new Map<number, number>();
    for (const transaction of transactions) {
      if (transaction.type !== 'income') continue;
      if (!labelsMatch(transaction.category, row.category)) continue;
      const concept = transaction.concept || transaction.subcategory;
      if (!labelsMatch(concept, row.conceptName)) continue;

      const date = startOfDay(parseTransactionDate(transaction.date));
      if (Number.isNaN(date.getTime())) continue;

      const amount = Math.abs(Number(transaction.amount) || 0);
      if (amount <= 0) continue;

      const time = date.getTime();
      totalsByDate.set(time, (totalsByDate.get(time) ?? 0) + amount);
    }

    const relevant = Array.from(totalsByDate.entries())
      .map(([time, amount]) => ({ date: new Date(time), amount }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (relevant.length === 0) continue;

    for (let date = asOf; !isAfter(date, horizonEnd); date = addDays(date, 1)) {
      const samples = relevant
        .filter((item) => item.date.getDay() === date.getDay() && isBefore(item.date, date))
        .slice(0, lookbackWeekdays)
        .map((item) => item.amount);
      if (samples.length < lookbackWeekdays) continue;
      const amount = samples.reduce((sum, value) => sum + value, 0) / lookbackWeekdays;
      if (amount <= 0) continue;
      const subcategory = row.subcategory || row.conceptName;
      const key = cellStorageKey(row.category, subcategory, row.conceptName, date);
      out.set(key, Math.round(amount * 100) / 100);
    }
  }

  return out;
}
