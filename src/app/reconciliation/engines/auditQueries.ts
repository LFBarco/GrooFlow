import { sessionMovements } from '../domain/dataset';
import type { AuditStatusFilter } from '../domain/auditLabels';
import type {
  CanonicalMovement,
  MatchStrategy,
  ReconciliationDataset,
  ReconciliationSourceType,
} from '../domain/types';

export type AuditPairRow = {
  id: string;
  matchId?: string;
  strategy?: MatchStrategy;
  confidence?: number;
  bank?: CanonicalMovement;
  sales?: CanonicalMovement;
  status: 'reconciled' | 'orphan_bank' | 'orphan_sales' | 'difference' | 'pending';
  amountDelta?: number;
};

export type AuditSummary = {
  totalMovements: number;
  reconciledPairs: number;
  orphanBank: number;
  orphanSales: number;
  pending: number;
  difference: number;
  totalAmountReconciled: number;
  totalAmountOrphanBank: number;
  totalAmountOrphanSales: number;
  byStrategy: Record<MatchStrategy, number>;
};

export type AuditFilterParams = {
  status: AuditStatusFilter;
  source?: ReconciliationSourceType | 'all';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

function movementSearchText(m: CanonicalMovement): string {
  return [
    m.operationNumber,
    m.operationNumberRaw,
    m.documentNumber,
    m.customerName,
    m.registeredBy,
    m.branch,
    m.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function inDateRange(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function isSalesMovement(m: CanonicalMovement): boolean {
  return m.sourceType === 'sales_erp' || m.side === 'sales_application';
}

function classifyMovement(m: CanonicalMovement): AuditPairRow['status'] {
  if (m.workflowStatus === 'reconciled') return 'reconciled';
  if (m.workflowStatus === 'difference') return 'difference';
  if (isSalesMovement(m)) return 'orphan_sales';
  return 'orphan_bank';
}

function rowMatchesSearch(row: AuditPairRow, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const qDigits = q.replace(/\D/g, '');

  const bankText = row.bank ? movementSearchText(row.bank) : '';
  const salesText = row.sales ? movementSearchText(row.sales) : '';
  if (bankText.includes(q) || salesText.includes(q)) return true;

  if (qDigits.length >= 3) {
    const bankOp = row.bank?.operationNumber ?? '';
    const bankRaw = row.bank?.operationNumberRaw ?? '';
    const salesOp = row.sales?.operationNumber ?? '';
    const salesRaw = row.sales?.operationNumberRaw ?? '';
    if (
      bankOp.includes(qDigits) ||
      bankRaw.includes(qDigits) ||
      salesOp.includes(qDigits) ||
      salesRaw.includes(qDigits)
    ) {
      return true;
    }
  }
  return false;
}

function rowMatchesStatus(row: AuditPairRow, status: AuditStatusFilter): boolean {
  if (status === 'all') return true;
  if (status === 'pairs') return row.status === 'reconciled';
  if (status === 'reconciled') return row.status === 'reconciled';
  if (status === 'difference') return row.status === 'difference';
  if (status === 'orphan_bank') return row.status === 'orphan_bank';
  if (status === 'orphan_sales') return row.status === 'orphan_sales';
  if (status === 'pending') return row.status !== 'reconciled';
  return true;
}

export const AUDIT_ALL_SESSIONS = '__all_sessions__' as const;
export type AuditSessionScope = string | typeof AUDIT_ALL_SESSIONS;

export function buildAuditRows(
  dataset: ReconciliationDataset,
  sessionId?: AuditSessionScope
): AuditPairRow[] {
  if (sessionId === AUDIT_ALL_SESSIONS) {
    const sessionIds = [
      ...new Set([
        ...dataset.movements.map((m) => m.sessionId),
        ...dataset.matches.map((m) => m.sessionId),
      ]),
    ];
    const merged: AuditPairRow[] = [];
    for (const sid of sessionIds) {
      merged.push(...buildAuditRows(dataset, sid));
    }
    return merged.sort((a, b) => {
      const da = a.bank?.transactionDate ?? a.sales?.transactionDate ?? '';
      const db = b.bank?.transactionDate ?? b.sales?.transactionDate ?? '';
      return db.localeCompare(da);
    });
  }

  const sid = sessionId ?? dataset.activeSessionId;
  const movements = sessionMovements(dataset, sid);
  const byId = new Map(movements.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const rows: AuditPairRow[] = [];

  for (const match of dataset.matches.filter((m) => m.sessionId === sid)) {
    const bank = byId.get(match.bankMovementId);
    const sales = byId.get(match.salesMovementId);
    if (!bank && !sales) continue;
    seen.add(match.bankMovementId);
    seen.add(match.salesMovementId);
    const amountDelta =
      bank && sales ? Math.round((bank.amount - sales.amount) * 100) / 100 : undefined;
    rows.push({
      id: match.id,
      matchId: match.id,
      strategy: match.matchStrategy,
      confidence: match.confidence,
      bank,
      sales,
      status: bank?.workflowStatus === 'difference' || sales?.workflowStatus === 'difference'
        ? 'difference'
        : 'reconciled',
      amountDelta,
    });
  }

  for (const m of movements) {
    if (seen.has(m.id)) continue;
    const sales = isSalesMovement(m);
    rows.push({
      id: m.id,
      bank: sales ? undefined : m,
      sales: sales ? m : undefined,
      status: classifyMovement(m),
    });
  }

  return rows.sort((a, b) => {
    const da = a.bank?.transactionDate ?? a.sales?.transactionDate ?? '';
    const db = b.bank?.transactionDate ?? b.sales?.transactionDate ?? '';
    return db.localeCompare(da);
  });
}

export function filterAuditRows(rows: AuditPairRow[], params: AuditFilterParams): AuditPairRow[] {
  const search = params.search?.trim().toLowerCase();

  return rows.filter((row) => {
    if (!rowMatchesStatus(row, params.status)) return false;

    if (params.source && params.source !== 'all') {
      const bankOk = row.bank?.sourceType === params.source;
      const salesOk = row.sales?.sourceType === params.source;
      if (!bankOk && !salesOk) return false;
    }

    const date = row.bank?.transactionDate ?? row.sales?.transactionDate ?? '';
    if (date && !inDateRange(date, params.dateFrom, params.dateTo)) return false;
    if (!date && (params.dateFrom || params.dateTo)) return false;

    if (search && !rowMatchesSearch(row, search)) return false;

    return true;
  });
}

export function computeAuditSummary(
  dataset: ReconciliationDataset,
  sessionId?: AuditSessionScope
): AuditSummary {
  const rows = buildAuditRows(dataset, sessionId);
  const byStrategy: Record<MatchStrategy, number> = {
    operation_number: 0,
    amount_date: 0,
    manual: 0,
  };

  let reconciledPairs = 0;
  let orphanBank = 0;
  let orphanSales = 0;
  let pending = 0;
  let difference = 0;
  let totalAmountReconciled = 0;
  let totalAmountOrphanBank = 0;
  let totalAmountOrphanSales = 0;

  for (const row of rows) {
    if (row.strategy) byStrategy[row.strategy] += 1;
    switch (row.status) {
      case 'reconciled':
        reconciledPairs += 1;
        totalAmountReconciled += row.bank?.amount ?? row.sales?.amount ?? 0;
        break;
      case 'orphan_bank':
        orphanBank += 1;
        totalAmountOrphanBank += row.bank?.amount ?? 0;
        break;
      case 'orphan_sales':
        orphanSales += 1;
        totalAmountOrphanSales += row.sales?.amount ?? 0;
        break;
      case 'difference':
        difference += 1;
        break;
      default:
        pending += 1;
    }
  }

  const movements =
    sessionId === AUDIT_ALL_SESSIONS
      ? dataset.movements
      : sessionMovements(dataset, sessionId);
  return {
    totalMovements: movements.length,
    reconciledPairs,
    orphanBank,
    orphanSales,
    pending,
    difference,
    totalAmountReconciled,
    totalAmountOrphanBank,
    totalAmountOrphanSales,
    byStrategy,
  };
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function totalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize));
}
