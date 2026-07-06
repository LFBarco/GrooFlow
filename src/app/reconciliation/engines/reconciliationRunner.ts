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

export type ImportOptions = {
  /** Si false, solo importa movimientos sin ejecutar el motor de cruce. */
  runEngine?: boolean;
  onProgress?: (phase: string, percent: number) => void;
};

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function importReconciliationFile(
  dataset: ReconciliationDataset,
  sourceType: ReconciliationSourceType,
  file: File,
  importedBy?: string,
  options: ImportOptions = {}
): Promise<ImportBatchResult> {
  const { runEngine = true, onProgress } = options;
  const connector = getConnectorBySource(sourceType);
  const buffer = await file.arrayBuffer();
  onProgress?.('Leyendo archivo…', 10);
  await yieldToMain();

  const rows = readSpreadsheetRows(buffer);
  onProgress?.('Parseando filas…', 30);
  await yieldToMain();

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
  onProgress?.('Normalizando movimientos…', 60);
  await yieldToMain();

  batch.errors = parsed.errors.slice(0, 100);
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

  if (runEngine) {
    onProgress?.('Ejecutando motor de conciliación…', 85);
    await yieldToMain();
    next = runReconciliationEngine(next, sessionId);
  }

  onProgress?.('Listo', 100);

  return {
    dataset: next,
    batch,
    imported: newMovements.length,
    errors: parsed.errors,
    skipped: parsed.skipped,
  };
}

export function resetSessionForMatching(
  dataset: ReconciliationDataset,
  sessionId: string
): ReconciliationDataset {
  return {
    ...dataset,
    movements: dataset.movements.map((m) =>
      m.sessionId !== sessionId
        ? m
        : {
            ...m,
            workflowStatus: 'normalized',
            matchedMovementId: undefined,
            matchId: undefined,
            ruleCodes: [],
          }
    ),
    matches: dataset.matches.filter((m) => m.sessionId !== sessionId),
  };
}

export function runReconciliationEngine(
  dataset: ReconciliationDataset,
  sessionId?: string
): ReconciliationDataset {
  const sid = sessionId ?? dataset.activeSessionId;
  let base = resetSessionForMatching(dataset, sid);
  let movements = sessionMovements(base, sid);

  const bankMovements = movements.filter(
    (m) => m.sourceType !== 'sales_erp' || m.side === 'bank_or_gateway'
  );
  const salesMovements = movements.filter((m) => m.side === 'sales_application');

  const candidates = findMatchCandidates(bankMovements, salesMovements);

  const newMatches = dataset.matches.filter((m) => m.sessionId !== sid);
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
    ...base,
    movements: [...otherMovements, ...movements],
    matches: newMatches,
    alerts: base.alerts.filter((a) => a.resolved || a.sessionId !== sid),
  };

  next = applyPostMatchRules(next, sid);
  next = detectCrossSourceMethodMismatches(next, sid);
  return next;
}

export function deleteReconciliationBatch(
  dataset: ReconciliationDataset,
  batchId: string
): ReconciliationDataset {
  const batch = dataset.batches.find((b) => b.id === batchId);
  if (!batch) return dataset;

  const removedIds = new Set(
    dataset.movements.filter((m) => m.batchId === batchId).map((m) => m.id)
  );

  const sessionId = batch.sessionId;
  const movements = dataset.movements
    .filter((m) => m.batchId !== batchId)
    .map((m) => {
      if (m.matchedMovementId && removedIds.has(m.matchedMovementId)) {
        return {
          ...m,
          workflowStatus: 'normalized' as const,
          matchedMovementId: undefined,
          matchId: undefined,
          ruleCodes: [],
        };
      }
      return m;
    });

  const matches = dataset.matches.filter(
    (m) => !removedIds.has(m.bankMovementId) && !removedIds.has(m.salesMovementId)
  );
  const alerts = dataset.alerts.filter((a) => !a.movementIds.some((id) => removedIds.has(id)));
  const batches = dataset.batches.filter((b) => b.id !== batchId);

  const next: ReconciliationDataset = {
    ...dataset,
    batches,
    movements,
    matches,
    alerts,
  };

  return runReconciliationEngine(next, sessionId);
}

/** Elimina todos los lotes importados de una fuente en la sesión indicada. */
export function deleteAllBatchesForSourceInSession(
  dataset: ReconciliationDataset,
  sessionId: string,
  sourceType: ReconciliationSourceType
): ReconciliationDataset {
  const batchIds = dataset.batches
    .filter((b) => b.sessionId === sessionId && b.sourceType === sourceType)
    .map((b) => b.id);
  if (batchIds.length === 0) return dataset;
  let next = dataset;
  for (const batchId of batchIds) {
    next = deleteReconciliationBatch(next, batchId);
  }
  return next;
}

export function resolveAlert(dataset: ReconciliationDataset, alertId: string): ReconciliationDataset {
  return {
    ...dataset,
    alerts: dataset.alerts.map((a) => (a.id === alertId ? { ...a, resolved: true } : a)),
  };
}
