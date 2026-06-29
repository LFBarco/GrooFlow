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
  sales: CanonicalMovement;
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

function scoreOperationMatch(bank: CanonicalMovement, sales: CanonicalMovement, cfg: MatchingConfig): number {
  if (!operationNumbersMatch(bank.operationNumberRaw || bank.operationNumber, sales.operationNumberRaw || sales.operationNumber)) {
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

function pickBestCandidate(
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
      const cand: MatchCandidate = { bank, sales, confidence: opScore, strategy: 'operation_number' };
      if (!best || cand.confidence > best.confidence) best = cand;
    }
  }
  return best;
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
    const best = pickBestCandidate(bank, salesByOp.get(opKey) ?? [], usedSales, cfg);
    if (best) {
      candidates.push(best);
      usedSales.add(best.sales.id);
    }
  }

  return candidates;
}

export function buildMatchFromCandidate(
  candidate: MatchCandidate,
  sessionId: string
): ReconciliationMatch {
  return {
    id: newId('rm'),
    sessionId,
    bankMovementId: candidate.bank.id,
    salesMovementId: candidate.sales.id,
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

export { operationMatchKey };
