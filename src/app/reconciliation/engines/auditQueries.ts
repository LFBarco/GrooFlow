import { sessionMovements } from '../domain/dataset';
import type { AuditStatusFilter } from '../domain/auditLabels';
import { ruleCodesForFilter, statusMatchesFilter } from '../domain/auditLabels';
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

function classifyMovement(m: CanonicalMovement): AuditPairRow['status'] {
  if (m.workflowStatus === 'reconciled') return 'reconciled';
  if (m.workflowStatus === 'difference') return 'difference';
  if (m.ruleCodes.includes('RULE-002')) return 'orphan_bank';
  if (m.ruleCodes.includes('RULE-003')) return 'orphan_sales';
  return 'pending';
}

export function buildAuditRows(
  dataset: ReconciliationDataset,
  sessionId?: string
): AuditPairRow[] {
  const sid = sessionId ?? dataset.activeSessionId;
  const movements = sessionMovements(dataset, sid);
  const byId = new Map(movements.map((m) => [m.id, m]));
  const matchById = new Map(dataset.matches.filter((m) => m.sessionId === sid).map((m) => [m.id, m]));
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
    rows.push({
      id: m.id,
      bank: m.sourceType !== 'sales_erp' ? m : undefined,
      sales: m.side === 'sales_application' ? m : undefined,
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
  const ruleFilter = ruleCodesForFilter(params.status);

  return rows.filter((row) => {
    if (params.status === 'pairs' && row.status !== 'reconciled') return false;
    if (params.status !== 'all' && params.status !== 'pairs') {
      if (params.status === 'orphan_bank' && row.status !== 'orphan_bank') return false;
      if (params.status === 'orphan_sales' && row.status !== 'orphan_sales') return false;
      if (params.status === 'reconciled' && row.status !== 'reconciled') return false;
      if (params.status === 'pending' && row.status !== 'pending') return false;
      if (params.status === 'difference' && row.status !== 'difference') return false;
    }

    if (params.source && params.source !== 'all') {
      const bankOk = row.bank?.sourceType === params.source;
      const salesOk = row.sales?.sourceType === params.source;
      if (!bankOk && !salesOk) return false;
    }

    const date = row.bank?.transactionDate ?? row.sales?.transactionDate ?? '';
    if (!inDateRange(date, params.dateFrom, params.dateTo)) return false;

    if (search) {
      const bankText = row.bank ? movementSearchText(row.bank) : '';
      const salesText = row.sales ? movementSearchText(row.sales) : '';
      if (!bankText.includes(search) && !salesText.includes(search)) return false;
    }

    if (ruleFilter) {
      const codes = [...(row.bank?.ruleCodes ?? []), ...(row.sales?.ruleCodes ?? [])];
      if (!ruleFilter.some((r) => codes.includes(r))) return false;
    }

    if (params.status === 'reconciled' && !statusMatchesFilter(row.bank?.workflowStatus ?? row.sales?.workflowStatus ?? 'pending', 'reconciled')) {
      return false;
    }

    return true;
  });
}

export function computeAuditSummary(dataset: ReconciliationDataset, sessionId?: string): AuditSummary {
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

  const movements = sessionMovements(dataset, sessionId);
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
