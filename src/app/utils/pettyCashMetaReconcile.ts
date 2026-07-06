import type {
  PettyCashFundDelivery,
  PettyCashTransaction,
  PettyCashWeekClosure,
  User,
} from '../types';
import {
  allPettyCashWeekMovementsApproved,
  FUND_DELIVERY_CATEGORY,
  isFundDeliveryIncome,
} from './pettyCashAudit';
import { effectivePettyCashFundLimit } from './pettyCashFund';
import {
  isPettyCashMovementActive,
  sumCustodianWeekExpenses,
  sumCustodianWeekIncome,
} from './pettyCashBalance';
import { getUserOpeningCarryState } from './pettyCashOpeningCarry';
import type { PettyCashWeekMetaPayload } from './pettyCashMeta';
import {
  findFundDeliveryForWeek,
  getOpeningFundForWeek,
  isWeekClosed,
} from './pettyCashWeekOpening';
import {
  comparePettyCashWeekKeys,
  getNextWeekKey,
  getPreviousWeekKey,
  parsePettyCashWeekKey,
  weekKeyMatches,
} from './pettyCashWeekKey';

const RECON_DELIVERY_PREFIX = 'recon-fd-';
const RECON_CLOSURE_PREFIX = 'recon-cl-';

export type ReconcilePettyCashMetaInput = {
  meta: PettyCashWeekMetaPayload;
  transactions: PettyCashTransaction[];
  users: User[];
  globalFundLimit: number;
};

function isReconciledId(id: string): boolean {
  return id.startsWith(RECON_DELIVERY_PREFIX) || id.startsWith(RECON_CLOSURE_PREFIX);
}

function weekIdentity(custodianId: string, weekNumber: string | number): string {
  const p = parsePettyCashWeekKey(weekNumber);
  return `${custodianId}|${p.normalized}|${p.week ?? ''}`;
}

function pickPreferredDelivery(
  a: PettyCashFundDelivery,
  b: PettyCashFundDelivery
): PettyCashFundDelivery {
  const aRecon = isReconciledId(a.id);
  const bRecon = isReconciledId(b.id);
  if (aRecon && !bRecon) return b;
  if (!aRecon && bRecon) return a;
  return a.deliveredAt >= b.deliveredAt ? a : b;
}

function pickPreferredClosure(a: PettyCashWeekClosure, b: PettyCashWeekClosure): PettyCashWeekClosure {
  const aRecon = isReconciledId(a.id);
  const bRecon = isReconciledId(b.id);
  if (aRecon && !bRecon) return b;
  if (!aRecon && bRecon) return a;
  return a.closedAt >= b.closedAt ? a : b;
}

/** Une metadatos sin perder registros (p. ej. KV + SQL parciales). */
export function mergePettyCashMetaPayloads(
  a: PettyCashWeekMetaPayload,
  b: PettyCashWeekMetaPayload
): PettyCashWeekMetaPayload {
  const deliveryMap = new Map<string, PettyCashFundDelivery>();
  for (const d of [...a.fundDeliveries, ...b.fundDeliveries]) {
    const key = weekIdentity(d.custodianId, d.weekNumber);
    const prev = deliveryMap.get(key);
    deliveryMap.set(key, prev ? pickPreferredDelivery(prev, d) : d);
  }
  const closureMap = new Map<string, PettyCashWeekClosure>();
  for (const c of [...a.weekClosures, ...b.weekClosures]) {
    const key = weekIdentity(c.custodianId, c.weekNumber);
    const prev = closureMap.get(key);
    closureMap.set(key, prev ? pickPreferredClosure(prev, c) : c);
  }
  const preMap = new Map<string, (typeof a.weekPreClosures)[number]>();
  for (const p of [...a.weekPreClosures, ...b.weekPreClosures]) {
    const key = weekIdentity(p.custodianId, p.weekNumber);
    if (!preMap.has(key)) preMap.set(key, p);
  }
  return {
    fundDeliveries: [...deliveryMap.values()],
    weekClosures: [...closureMap.values()],
    weekPreClosures: [...preMap.values()],
  };
}

function usersById(users: User[]): Map<string, User> {
  return new Map(users.map((u) => [u.id, u]));
}

function isPeriodOpeningWeek(
  custodianId: string,
  weekStr: string,
  closures: PettyCashWeekClosure[]
): boolean {
  const prevWeek = getPreviousWeekKey(weekStr);
  if (!prevWeek) return true;
  return !closures.some(
    (c) => c.custodianId === custodianId && weekKeyMatches(c.weekNumber, prevWeek)
  );
}

function txDateIso(t: PettyCashTransaction): string {
  const d = t.date instanceof Date ? t.date : new Date(t.date as string | number);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function reconcileFundDeliveriesFromTransactions(
  transactions: PettyCashTransaction[],
  deliveries: PettyCashFundDelivery[],
  users: Map<string, User>,
  globalFundLimit: number,
  closures: PettyCashWeekClosure[]
): PettyCashFundDelivery[] {
  const out = [...deliveries];
  for (const t of transactions) {
    if (!isFundDeliveryIncome(t) || !isPettyCashMovementActive(t)) continue;
    const custodianId = t.custodianId?.trim();
    if (!custodianId) continue;
    const weekStr = String(t.weekNumber ?? '').trim();
    if (!weekStr) continue;
    if (findFundDeliveryForWeek(custodianId, weekStr, out)) continue;

    const user = users.get(custodianId);
    const configured = effectivePettyCashFundLimit(user, globalFundLimit);
    const periodOpening = isPeriodOpeningWeek(custodianId, weekStr, closures);
    const carryState = getUserOpeningCarryState(user);
    const openingCarryAmount =
      periodOpening && carryState.suggested > 0
        ? carryState.consumed
          ? carryState.suggested
          : carryState.availableSuggested
        : undefined;

    out.push({
      id: `${RECON_DELIVERY_PREFIX}${t.id}`,
      custodianId,
      weekNumber: weekStr,
      configuredAmount: configured > 0 ? configured : Math.max(0, Number(t.amount) || 0),
      deliveredAmount: Math.max(0, Number(t.amount) || 0),
      deliveredAt: txDateIso(t),
      deliveredByUserId: 'system-reconcile',
      deliveredByName: 'Sistema (reconciliación automática)',
      ...(periodOpening
        ? {
            isPeriodOpening: true,
            ...(openingCarryAmount != null && openingCarryAmount > 0
              ? { openingCarryAmount }
              : {}),
          }
        : {}),
      ...(t.description?.trim() && t.description !== FUND_DELIVERY_CATEGORY
        ? { reason: t.description.trim() }
        : {}),
    });
  }
  return out;
}

function weekHasActivity(
  custodianId: string,
  weekStr: string,
  transactions: PettyCashTransaction[],
  deliveries: PettyCashFundDelivery[]
): boolean {
  if (findFundDeliveryForWeek(custodianId, weekStr, deliveries)) return true;
  return transactions.some(
    (t) =>
      t.custodianId === custodianId &&
      weekKeyMatches(t.weekNumber, weekStr) &&
      isPettyCashMovementActive(t)
  );
}

function collectCustodianWeeks(
  custodianId: string,
  transactions: PettyCashTransaction[],
  deliveries: PettyCashFundDelivery[],
  closures: PettyCashWeekClosure[]
): string[] {
  const set = new Set<string>();
  for (const t of transactions) {
    if (t.custodianId !== custodianId) continue;
    const wk = String(t.weekNumber ?? '').trim();
    if (wk) set.add(wk);
  }
  for (const d of deliveries) {
    if (d.custodianId !== custodianId) continue;
    const wk = String(d.weekNumber ?? '').trim();
    if (wk) set.add(wk);
  }
  for (const c of closures) {
    if (c.custodianId !== custodianId) continue;
    const wk = String(c.weekNumber ?? '').trim();
    if (wk) set.add(wk);
  }
  return [...set].sort(comparePettyCashWeekKeys);
}

function inferClosuresFromChain(
  transactions: PettyCashTransaction[],
  deliveries: PettyCashFundDelivery[],
  closures: PettyCashWeekClosure[],
  users: Map<string, User>,
  globalFundLimit: number
): PettyCashWeekClosure[] {
  const out = [...closures];
  const custodianIds = new Set<string>();
  for (const t of transactions) {
    if (t.custodianId) custodianIds.add(t.custodianId);
  }
  for (const d of deliveries) custodianIds.add(d.custodianId);

  for (const custodianId of custodianIds) {
    const weeks = collectCustodianWeeks(custodianId, transactions, deliveries, out);
    for (const weekStr of weeks) {
      if (isWeekClosed(custodianId, weekStr, out)) continue;

      const nextWeek = getNextWeekKey(weekStr);
      if (!nextWeek || !weekHasActivity(custodianId, nextWeek, transactions, deliveries)) {
        continue;
      }

      if (!findFundDeliveryForWeek(custodianId, weekStr, deliveries)) continue;

      const weekTxs = transactions.filter(
        (t) =>
          t.custodianId === custodianId &&
          weekKeyMatches(t.weekNumber, weekStr) &&
          isPettyCashMovementActive(t)
      );
      if (!allPettyCashWeekMovementsApproved(weekTxs)) continue;

      const user = users.get(custodianId);
      const limit = effectivePettyCashFundLimit(user, globalFundLimit);
      const openingCarry = getUserOpeningCarryState(user);
      const opening = getOpeningFundForWeek(
        custodianId,
        weekStr,
        out,
        limit,
        deliveries,
        openingCarry
      );
      const expenses = sumCustodianWeekExpenses(transactions, custodianId, weekStr);
      const income = sumCustodianWeekIncome(transactions, custodianId, weekStr);
      const closingBalance = Math.max(0, Math.round((opening - expenses + income) * 100) / 100);

      const lastTx = weekTxs
        .map(txDateIso)
        .sort()
        .at(-1);

      out.push({
        id: `${RECON_CLOSURE_PREFIX}${custodianId}-${parsePettyCashWeekKey(weekStr).normalized}`,
        custodianId,
        weekNumber: weekStr,
        closedAt: lastTx ?? new Date().toISOString(),
        openingFund: opening,
        expensesTotal: expenses,
        closingBalance,
        carriedForward: closingBalance,
      });
    }
  }

  return out;
}

/**
 * Reconstruye dotaciones y cierres faltantes desde movimientos existentes.
 * No modifica ni elimina transacciones de gastos/ingresos.
 */
export function reconcilePettyCashMeta(input: ReconcilePettyCashMetaInput): PettyCashWeekMetaPayload {
  let fundDeliveries = [...input.meta.fundDeliveries];
  let weekClosures = [...input.meta.weekClosures];
  const users = usersById(input.users);

  fundDeliveries = reconcileFundDeliveriesFromTransactions(
    input.transactions,
    fundDeliveries,
    users,
    input.globalFundLimit,
    weekClosures
  );

  weekClosures = inferClosuresFromChain(
    input.transactions,
    fundDeliveries,
    weekClosures,
    users,
    input.globalFundLimit
  );

  return {
    weekClosures,
    weekPreClosures: [...input.meta.weekPreClosures],
    fundDeliveries,
  };
}

export function pettyCashMetaReconcileChanged(
  before: PettyCashWeekMetaPayload,
  after: PettyCashWeekMetaPayload
): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}
