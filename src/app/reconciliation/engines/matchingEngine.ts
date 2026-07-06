import {
  amountsEqual,
  daysBetween,
  normalizeOperationNumber,
  operationMatchKey,
  operationNumbersMatch,
  salesMovementNeedsBankAmount,
} from '../domain/normalize';
import type {
  CanonicalMovement,
  MatchStrategy,
  ReconciliationMatch,
  ReconciliationRuleCode,
} from '../domain/types';
import { newId } from '../domain/dataset';

export type MatchingConfig = {
  amountTolerance: number;
  maxDateDays: number;
};

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  amountTolerance: 0.05,
  maxDateDays: 3,
};

export type MatchCandidate = {
  bank: CanonicalMovement;
  sales: CanonicalMovement[];
  confidence: number;
  strategy: MatchStrategy;
};

const BANK_SOURCES = new Set(['bcp_bank', 'mercado_pago', 'niubiz']);

function isBankSide(m: CanonicalMovement): boolean {
  return m.side === 'bank_or_gateway' || BANK_SOURCES.has(m.sourceType);
}

function sourceCompatible(bank: CanonicalMovement, sales: CanonicalMovement): boolean {
  if (sales.paymentMethod === 'unknown') return true;
  if (bank.sourceType === 'mercado_pago' && sales.paymentMethod !== 'mercado_pago') return false;
  if (bank.sourceType === 'niubiz' && sales.paymentMethod !== 'niubiz') return false;
  if (bank.sourceType === 'bcp_bank') {
    if (sales.paymentMethod === 'mercado_pago' || sales.paymentMethod === 'niubiz') return false;
  }
  return true;
}

function operationMatchKeyForMovement(m: CanonicalMovement): string {
  return normalizeOperationNumber(m.operationNumberRaw || m.operationNumber).normalized;
}

function salesAmountForGroupSum(sales: CanonicalMovement): number {
  if (salesMovementNeedsBankAmount(sales)) return 0;
  return Math.max(0, Number(sales.amount) || 0);
}

function scoreOperationMatch(bank: CanonicalMovement, sales: CanonicalMovement, cfg: MatchingConfig): number {
  if (
    !operationNumbersMatch(
      bank.operationNumberRaw || bank.operationNumber,
      sales.operationNumberRaw || sales.operationNumber
    )
  ) {
    return 0;
  }
  const needsBankAmount = salesMovementNeedsBankAmount(sales);
  const amountOk =
    needsBankAmount || amountsEqual(bank.amount, sales.amount, cfg.amountTolerance);
  const days = daysBetween(bank.transactionDate, sales.transactionDate);
  if (!amountOk) {
    return days <= cfg.maxDateDays ? 0.88 : 0.82;
  }
  if (days > cfg.maxDateDays) return needsBankAmount ? 0.92 : 0.9;
  return needsBankAmount ? 0.97 : 0.99;
}

function pickBestSingleCandidate(
  bank: CanonicalMovement,
  salesList: CanonicalMovement[],
  usedSales: Set<string>,
  cfg: MatchingConfig
): MatchCandidate | null {
  let best: MatchCandidate | null = null;
  for (const sales of salesList) {
    if (usedSales.has(sales.id)) continue;
    if (!sourceCompatible(bank, sales)) continue;
    const opScore = scoreOperationMatch(bank, sales, cfg);
    if (opScore >= 0.82) {
      const cand: MatchCandidate = {
        bank,
        sales: [sales],
        confidence: opScore,
        strategy: 'operation_number',
      };
      if (!best || cand.confidence > best.confidence) best = cand;
    }
  }
  return best;
}

function pickGroupCandidate(
  bank: CanonicalMovement,
  salesList: CanonicalMovement[],
  usedSales: Set<string>,
  cfg: MatchingConfig
): MatchCandidate | null {
  const group = salesList.filter(
    (s) => !usedSales.has(s.id) && sourceCompatible(bank, s)
  );
  if (group.length < 2) return null;

  const total = Math.round(group.reduce((acc, s) => acc + salesAmountForGroupSum(s), 0) * 100) / 100;
  if (!amountsEqual(total, bank.amount, cfg.amountTolerance)) return null;

  const maxDays = Math.max(...group.map((s) => daysBetween(bank.transactionDate, s.transactionDate)));
  if (maxDays > cfg.maxDateDays) return null;

  return {
    bank,
    sales: group,
    confidence: maxDays === 0 ? 0.99 : 0.97,
    strategy: 'operation_number_grouped',
  };
}

function indexSalesByOperation(sales: CanonicalMovement[]): Map<string, CanonicalMovement[]> {
  const map = new Map<string, CanonicalMovement[]>();
  for (const s of sales) {
    const key = operationMatchKeyForMovement(s);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return map;
}

export function findMatchCandidates(
  bankMovements: CanonicalMovement[],
  salesMovements: CanonicalMovement[],
  cfg: MatchingConfig = DEFAULT_MATCHING_CONFIG
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  const usedSales = new Set<string>();

  const pendingBank = bankMovements.filter((m) => isBankSide(m) && m.workflowStatus !== 'reconciled');
  const pendingSales = salesMovements.filter(
    (m) =>
      (m.sourceType === 'sales_erp' || m.side === 'sales_application') &&
      m.workflowStatus !== 'reconciled'
  );

  const salesByOp = indexSalesByOperation(pendingSales);

  for (const bank of pendingBank) {
    const opKey = operationMatchKeyForMovement(bank);
    if (!opKey) continue;
    const opSales = salesByOp.get(opKey) ?? [];

    const grouped = pickGroupCandidate(bank, opSales, usedSales, cfg);
    if (grouped) {
      candidates.push(grouped);
      for (const s of grouped.sales) usedSales.add(s.id);
      continue;
    }

    const best = pickBestSingleCandidate(bank, opSales, usedSales, cfg);
    if (best) {
      candidates.push(best);
      usedSales.add(best.sales[0]!.id);
    }
  }

  return candidates;
}

export function buildMatchFromCandidate(
  candidate: MatchCandidate,
  sessionId: string
): ReconciliationMatch {
  const primarySales = candidate.sales[0]!;
  return {
    id: newId('rm'),
    sessionId,
    bankMovementId: candidate.bank.id,
    salesMovementId: primarySales.id,
    ...(candidate.sales.length > 1
      ? { salesMovementIds: candidate.sales.map((s) => s.id) }
      : {}),
    confidence: candidate.confidence,
    matchStrategy: candidate.strategy,
    ruleCode: 'RULE-001',
    createdAt: new Date().toISOString(),
  };
}

export function applyMatchToMovements(
  bank: CanonicalMovement,
  sales: CanonicalMovement,
  match: ReconciliationMatch
): { bank: CanonicalMovement; sales: CanonicalMovement } {
  if (
    !operationNumbersMatch(
      bank.operationNumberRaw || bank.operationNumber,
      sales.operationNumberRaw || sales.operationNumber
    )
  ) {
    return { bank, sales };
  }

  const ruleCodes: ReconciliationRuleCode[] = ['RULE-001'];
  const needsBankAmount = salesMovementNeedsBankAmount(sales);
  const resolvedAmount = needsBankAmount ? bank.amount : sales.amount;
  const amountMismatch =
    !needsBankAmount && !amountsEqual(bank.amount, sales.amount, DEFAULT_MATCHING_CONFIG.amountTolerance);
  const workflowStatus = amountMismatch ? 'difference' : 'reconciled';
  if (amountMismatch) ruleCodes.push('RULE-005');

  return {
    bank: {
      ...bank,
      workflowStatus,
      matchedMovementId: sales.id,
      matchId: match.id,
      ruleCodes: [...new Set([...bank.ruleCodes, ...ruleCodes])],
    },
    sales: {
      ...sales,
      amount: resolvedAmount,
      workflowStatus,
      matchedMovementId: bank.id,
      matchId: match.id,
      ruleCodes: [...new Set([...sales.ruleCodes, ...ruleCodes])],
    },
  };
}

export function applyGroupMatchToMovements(
  bank: CanonicalMovement,
  salesGroup: CanonicalMovement[],
  match: ReconciliationMatch
): { bank: CanonicalMovement; sales: CanonicalMovement[] } {
  const primary = salesGroup[0]!;
  const ruleCodes: ReconciliationRuleCode[] = ['RULE-001'];

  const nextBank: CanonicalMovement = {
    ...bank,
    workflowStatus: 'reconciled',
    matchedMovementId: primary.id,
    matchId: match.id,
    ruleCodes: [...new Set([...bank.ruleCodes, ...ruleCodes])],
  };

  const nextSales = salesGroup.map((sales) => {
    const needsBankAmount = salesMovementNeedsBankAmount(sales);
    return {
      ...sales,
      amount: needsBankAmount ? bank.amount : sales.amount,
      workflowStatus: 'reconciled' as const,
      matchedMovementId: bank.id,
      matchId: match.id,
      ruleCodes: [...new Set([...sales.ruleCodes, ...ruleCodes])],
    };
  });

  return { bank: nextBank, sales: nextSales };
}

export { operationMatchKey };
