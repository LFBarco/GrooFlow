import { getConnectorBySource } from '../connectors';
import { readSpreadsheetRows } from '../connectors/spreadsheetUtils';
import type { ConnectorContext } from '../connectors/types';
import { newId, sessionMovements } from '../domain/dataset';
import type {
  CanonicalMovement,
  ReconciliationBatch,
  ReconciliationDataset,
  ReconciliationSourceType,
} from '../domain/types';
import {
  applyMatchToMovements,
  buildMatchFromCandidate,
  findMatchCandidates,
} from './matchingEngine';
import { applyPostMatchRules, detectCrossSourceMethodMismatches } from './rulesEngine';

export type ImportBatchResult = {
  dataset: ReconciliationDataset;
  batch: ReconciliationBatch;
  imported: number;
  errors: string[];
  skipped: number;
};

export async function importReconciliationFile(
  dataset: ReconciliationDataset,
  sourceType: ReconciliationSourceType,
  file: File,
  importedBy?: string
): Promise<ImportBatchResult> {
  const connector = getConnectorBySource(sourceType);
  const buffer = await file.arrayBuffer();
  const rows = readSpreadsheetRows(buffer);
  const sessionId = dataset.activeSessionId;
  const batchId = newId('rb');

  const batch: ReconciliationBatch = {
    id: batchId,
    sessionId,
    sourceType,
    fileName: file.name,
    importedAt: new Date().toISOString(),
    importedBy,
    recordCount: 0,
    status: 'processing',
    errors: [],
  };

  const ctx: ConnectorContext = {
    sessionId,
    fileName: file.name,
    importedBy,
    creditsOnly: sourceType === 'bcp_bank',
  };

  const parsed = connector.parseRows(rows, ctx);
  batch.errors = parsed.errors;
  batch.recordCount = parsed.movements.length;
  batch.status = parsed.errors.length > 0 && parsed.movements.length === 0 ? 'failed' : 'completed';

  const newMovements: CanonicalMovement[] = parsed.movements.map((partial) => ({
    ...partial,
    id: newId('mv'),
    batchId,
    sessionId,
    workflowStatus: 'normalized',
    ruleCodes: [],
    metadata: { ...partial.metadata },
  }));

  let next: ReconciliationDataset = {
    ...dataset,
    batches: [batch, ...dataset.batches],
    movements: [...dataset.movements, ...newMovements],
  };

  next = runReconciliationEngine(next, sessionId);

  return {
    dataset: next,
    batch,
    imported: newMovements.length,
    errors: parsed.errors,
    skipped: parsed.skipped,
  };
}

export function runReconciliationEngine(
  dataset: ReconciliationDataset,
  sessionId?: string
): ReconciliationDataset {
  const sid = sessionId ?? dataset.activeSessionId;
  let movements = sessionMovements(dataset, sid);

  const candidates = findMatchCandidates(
    movements.filter((m) => m.sourceType !== 'sales_erp' || m.side === 'bank_or_gateway'),
    movements.filter((m) => m.side === 'sales_application')
  );

  const newMatches = [...dataset.matches];
  const movementById = new Map(movements.map((m) => [m.id, m]));

  for (const cand of candidates) {
    const match = buildMatchFromCandidate(cand, sid);
    newMatches.push(match);
    const bank = movementById.get(cand.bank.id)!;
    const sales = movementById.get(cand.sales.id)!;
    const applied = applyMatchToMovements(bank, sales, match);
    movementById.set(bank.id, applied.bank);
    movementById.set(sales.id, applied.sales);
  }

  const otherMovements = dataset.movements.filter((m) => m.sessionId !== sid);
  movements = [...movementById.values()];

  let next: ReconciliationDataset = {
    ...dataset,
    movements: [...otherMovements, ...movements],
    matches: newMatches,
    alerts: dataset.alerts.filter((a) => a.sessionId !== sid || a.resolved),
  };

  next = applyPostMatchRules(next, sid);
  next = detectCrossSourceMethodMismatches(next, sid);
  return next;
}

export function resolveAlert(dataset: ReconciliationDataset, alertId: string): ReconciliationDataset {
  return {
    ...dataset,
    alerts: dataset.alerts.map((a) => (a.id === alertId ? { ...a, resolved: true } : a)),
  };
}
