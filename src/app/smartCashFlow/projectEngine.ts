import { addDays, format, parseISO, isAfter } from 'date-fns';
import type {
  IsoDate,
  PendingFlexible,
  ProjectionAlert,
  ProjectionDayResult,
  ProjectionEngineResult,
  ProjectionHorizonInput,
  ProjectionLedgerLine,
  ScheduledOutflow,
} from './types';

/** Prioridad por defecto para flexibles sin `priorityRank`. */
export const DEFAULT_FLEX_PRIORITY = 500;

/** Genera todas las fechas inclusive entre start y end (start <= end). */
export function listDaysInclusive(startDate: IsoDate, endDate: IsoDate): IsoDate[] {
  const startD = parseISO(startDate);
  const endD = parseISO(endDate);
  const out: IsoDate[] = [];
  for (let d = startD; !isAfter(d, endD); d = addDays(d, 1)) {
    out.push(format(d, 'yyyy-MM-dd'));
  }
  return out;
}

export function clampNonNegative(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return amount < 0 ? 0 : amount;
}

/** Orden estable: prioridad asc, fecha de vencimiento original asc, id. */
export function comparePendingFlex(a: PendingFlexible, b: PendingFlexible): number {
  const prA = a.outflow.priorityRank ?? DEFAULT_FLEX_PRIORITY;
  const prB = b.outflow.priorityRank ?? DEFAULT_FLEX_PRIORITY;
  if (prA !== prB) return prA - prB;
  if (a.originalDueDate !== b.originalDueDate) {
    return a.originalDueDate < b.originalDueDate ? -1 : 1;
  }
  return a.outflow.id.localeCompare(b.outflow.id);
}

function sumInflowsForDate(
  date: IsoDate,
  inflows: ProjectionHorizonInput['inflows']
): { total: number; lines: ProjectionLedgerLine[] } {
  const lines: ProjectionLedgerLine[] = [];
  let total = 0;
  for (const inf of inflows) {
    if (inf.date !== date) continue;
    const amt = clampNonNegative(inf.amount);
    total += amt;
    lines.push({
      kind: 'inflow',
      sourceId: inf.id,
      label: inf.label ?? inf.id,
      amount: amt,
    });
  }
  return { total, lines };
}

/** Egresos fijos con dueDate exacta en este día (no se difieren). */
function fixedOutflowsForDate(
  date: IsoDate,
  outflows: ScheduledOutflow[]
): ScheduledOutflow[] {
  return outflows.filter((o) => o.flexibility === 'fixed' && o.dueDate === date);
}

/** Nuevos flexibles que vencen exactamente este día (aún sin pool de arrastre). */
function newFlexibleDueOnDate(date: IsoDate, outflows: ScheduledOutflow[]): PendingFlexible[] {
  return outflows
    .filter((o) => o.flexibility === 'flexible' && o.dueDate === date)
    .map((o) => ({ outflow: o, originalDueDate: date }));
}

/**
 * Ejecuta la proyección día a día dentro del horizonte.
 * Reglas:
 * - Ingresos del día aumentan saldo antes de pagar obligaciones ese mismo día (orden: inflow → fijos → flex).
 * - Fijos siempre descuentan; pueden dejar saldo negativo (alertas).
 * - Flexibles ordenados por prioridad; si no hay saldo suficiente, se llevan al día siguiente.
 * - Flexibles pendientes competen cada día ordenados igual (prioridad, antigüedad de due, id).
 */
export function runCashFlowProjection(input: ProjectionHorizonInput): ProjectionEngineResult {
  const days = listDaysInclusive(input.startDate, input.endDate);
  const alerts: ProjectionAlert[] = [];
  const dayResults: ProjectionDayResult[] = [];

  let running = Number(input.openingBalance);
  let pendingFlex: PendingFlexible[] = [];

  for (const date of days) {
    const ledger: ProjectionLedgerLine[] = [];

    ledger.push({
      kind: 'open',
      label: 'Apertura',
      amount: running,
    });

    const openingBalance = running;
    const infl = sumInflowsForDate(date, input.inflows);
    running += infl.total;
    ledger.push(...infl.lines);

    const fixes = fixedOutflowsForDate(date, input.outflows);
    let fixedTotal = 0;
    const fixedSorted = [...fixes].sort((a, b) => a.id.localeCompare(b.id));
    for (const fo of fixedSorted) {
      const amt = clampNonNegative(fo.amount);
      fixedTotal += amt;
      ledger.push({
        kind: 'fixed_out',
        sourceId: fo.id,
        label: fo.label ?? fo.id,
        amount: amt,
      });
      running -= amt;
    }
    if (running < 0) {
      alerts.push({
        kind: 'NEGATIVE_AFTER_FIXED',
        date,
        message: `Saldo negativo tras pagos fijos del ${date}.`,
        shortfallAmount: Math.abs(running),
        relatedOutflowIds: fixes.map((f) => f.id),
      });
    }

    pendingFlex.push(...newFlexibleDueOnDate(date, input.outflows));
    pendingFlex.sort(comparePendingFlex);

    let flexPaidToday = 0;
    const nextPending: PendingFlexible[] = [];

    for (const item of pendingFlex) {
      const amt = clampNonNegative(item.outflow.amount);
      if (amt <= 0) continue;
      if (running >= amt) {
        running -= amt;
        flexPaidToday += amt;
        ledger.push({
          kind: 'flex_paid',
          sourceId: item.outflow.id,
          label: item.outflow.label ?? item.outflow.id,
          amount: amt,
        });
      } else {
        ledger.push({
          kind: 'flex_deferred',
          sourceId: item.outflow.id,
          label: item.outflow.label ?? item.outflow.id,
          amount: amt,
          deferredFromDueDate: item.originalDueDate,
        });
        alerts.push({
          kind: 'FLEX_DEFERRED',
          date,
          relatedOutflowIds: [item.outflow.id],
          shortfallAmount: amt - Math.max(running, 0),
          message:
            running > 0
              ? `Gasto flexible aplazado: ${item.outflow.label ?? item.outflow.id} (${date}). Falta cubrir ${(amt - running).toFixed(2)}.`
              : `Gasto flexible aplazado: ${item.outflow.label ?? item.outflow.id} (${date}).`,
        });
        nextPending.push(item);
      }
    }
    pendingFlex = nextPending;

    if (running < 0 && flexPaidToday > 0) {
      alerts.push({
        kind: 'NEGATIVE_AFTER_FLEX_PAID',
        date,
        message: `Saldo negativo después de registrar pagos flexibles del ${date}.`,
        shortfallAmount: Math.abs(running),
      });
    }

    dayResults.push({
      date,
      openingBalance,
      inflowTotal: infl.total,
      fixedOutflowTotal: fixedTotal,
      flexiblePaidTotal: flexPaidToday,
      closingBalance: running,
      ledger,
    });
  }

  if (pendingFlex.length) {
    const totalUnpaid = pendingFlex.reduce((s, p) => s + clampNonNegative(p.outflow.amount), 0);
    alerts.push({
      kind: 'SHORTFALL_PENDING_FLEX_END',
      date: days[days.length - 1] ?? input.endDate,
      relatedOutflowIds: pendingFlex.map((p) => p.outflow.id),
      shortfallAmount: totalUnpaid,
      message:
        `${pendingFlex.length} gasto(s) flexible(s) no cubierto(s) al cerrar el horizonte (${formatCurrencyHint(totalUnpaid)}).`,
    });
  }

  return { days: dayResults, alerts, unresolvedFlex: [...pendingFlex] };
}

/** Ayuda texto simple para alertas (sin depender del formateador de UI). */
function formatCurrencyHint(n: number): string {
  const v = clampNonNegative(n);
  return `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
