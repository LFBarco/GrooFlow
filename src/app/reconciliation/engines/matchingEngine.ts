import { amountsEqual, daysBetween, operationMatchKey, salesMovementNeedsBankAmount } from '../domain/normalize';
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

function scoreOperationMatch(bank: CanonicalMovement, sales: CanonicalMovement, cfg: MatchingConfig): number {
  if (!bank.operationNumber || !sales.operationNumber) return 0;
  if (bank.operationNumber !== sales.operationNumber) return 0;
  const needsBankAmount = salesMovementNeedsBankAmount(sales);
  if (!needsBankAmount && !amountsEqual(bank.amount, sales.amount, cfg.amountTolerance)) return 0;
  const days = daysBetween(bank.transactionDate, sales.transactionDate);
  if (days > cfg.maxDateDays) return needsBankAmount ? 0.85 : 0.7;
  return needsBankAmount ? 0.95 : 0.98;
}

function scoreAmountDateMatch(bank: CanonicalMovement, sales: CanonicalMovement, cfg: MatchingConfig): number {
  if (!amountsEqual(bank.amount, sales.amount, cfg.amountTolerance)) return 0;
  const days = daysBetween(bank.transactionDate, sales.transactionDate);
  if (days > cfg.maxDateDays) return 0;
  if (days <= 1) return 0.75;
  return 0.65;
}

export function findMatchCandidates(
  bankMovements: CanonicalMovement[],
  salesMovements: CanonicalMovement[],
  cfg: MatchingConfig = DEFAULT_MATCHING_CONFIG
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  const usedBank = new Set<string>();
  const usedSales = new Set<string>();

  const pendingBank = bankMovements.filter((m) => isBankSide(m) && m.workflowStatus !== 'reconciled');
  const pendingSales = salesMovements.filter((m) => m.side === 'sales_application' && m.workflowStatus !== 'reconciled');

  for (const bank of pendingBank) {
    let best: MatchCandidate | null = null;
    for (const sales of pendingSales) {
      if (usedSales.has(sales.id)) continue;
      if (!sourceCompatible(bank, sales)) continue;
      const opScore = scoreOperationMatch(bank, sales, cfg);
      if (opScore >= 0.7) {
        const cand: MatchCandidate = { bank, sales, confidence: opScore, strategy: 'operation_number' };
        if (!best || cand.confidence > best.confidence) best = cand;
        continue;
      }
      const adScore = scoreAmountDateMatch(bank, sales, cfg);
      if (adScore >= 0.65) {
        const cand: MatchCandidate = { bank, sales, confidence: adScore, strategy: 'amount_date' };
        if (!best || cand.confidence > best.confidence) best = cand;
      }
    }
    if (best && best.confidence >= 0.65) {
      candidates.push(best);
      usedBank.add(best.bank.id);
      usedSales.add(best.sales.id);
    }
  }

  return candidates;
}

export function buildMatchFromCandidate(
  candidate: MatchCandidate,
  sessionId: string
): ReconciliationMatch {
  const ruleCode: ReconciliationRuleCode =
    candidate.strategy === 'operation_number' ? 'RULE-001' : 'RULE-001';
  return {
    id: newId('rm'),
    sessionId,
    bankMovementId: candidate.bank.id,
    salesMovementId: candidate.sales.id,
    confidence: candidate.confidence,
    matchStrategy: candidate.strategy,
    ruleCode,
    createdAt: new Date().toISOString(),
  };
}

export function applyMatchToMovements(
  bank: CanonicalMovement,
  sales: CanonicalMovement,
  match: ReconciliationMatch
): { bank: CanonicalMovement; sales: CanonicalMovement } {
  const ruleCodes: ReconciliationRuleCode[] = ['RULE-001'];
  const resolvedAmount = salesMovementNeedsBankAmount(sales) ? bank.amount : sales.amount;
  return {
    bank: {
      ...bank,
      workflowStatus: 'reconciled',
      matchedMovementId: sales.id,
      matchId: match.id,
      ruleCodes: [...new Set([...bank.ruleCodes, ...ruleCodes])],
    },
    sales: {
      ...sales,
      amount: resolvedAmount,
      workflowStatus: 'reconciled',
      matchedMovementId: bank.id,
      matchId: match.id,
      ruleCodes: [...new Set([...sales.ruleCodes, ...ruleCodes])],
    },
  };
}

export { operationMatchKey };
