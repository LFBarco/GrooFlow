import { getConnectorBySource } from '../connectors';
import { readSpreadsheetRows } from '../connectors/spreadsheetUtils';
import type { ConnectorContext } from '../connectors/types';
import { newId, sessionMovements } from '../domain/dataset';
import { isLockedReconciledMovement } from '../domain/salesMovementIdentity';
import type {
  CanonicalMovement,
  ReconciliationBatch,
  ReconciliationDataset,
  ReconciliationSourceType,
} from '../domain/types';
import {
  applyGroupMatchToMovements,
  applyMatchToMovements,
  buildMatchFromCandidate,
  findMatchCandidates,
} from './matchingEngine';
import { applyPostMatchRules, detectCrossSourceMethodMismatches } from './rulesEngine';
import {
  mergeSalesMovementsIncremental,
  type SalesImportMergeStats,
} from './salesIncrementalImport';

export type ImportBatchResult = {
  dataset: ReconciliationDataset;
  batch: ReconciliationBatch;
  imported: number;
  errors: string[];
  skipped: number;
  mergeStats?: SalesImportMergeStats;
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

  const incomingPartials = parsed.movements.map((partial) => ({
    ...partial,
    metadata: { ...partial.metadata },
  }));

  let mergeStats: SalesImportMergeStats | undefined;
  let movements: CanonicalMovement[];
  let newAlerts = dataset.alerts;

  if (sourceType === 'sales_erp') {
    onProgress?.('Fusionando con ventas existentes…', 70);
    await yieldToMain();
    const merged = mergeSalesMovementsIncremental(dataset, sessionId, batchId, incomingPartials);
    movements = merged.movements;
    mergeStats = merged.stats;
    if (merged.newAlerts.length > 0) {
      newAlerts = [...merged.newAlerts, ...dataset.alerts];
    }
  } else {
    const newMovements: CanonicalMovement[] = incomingPartials.map((partial) => ({
      ...partial,
      id: newId('mv'),
      batchId,
      sessionId,
      workflowStatus: 'normalized',
      ruleCodes: [],
    }));
    movements = [...dataset.movements, ...newMovements];
  }

  let next: ReconciliationDataset = {
    ...dataset,
    batches: [batch, ...dataset.batches],
    movements,
    alerts: newAlerts,
  };

  if (runEngine) {
    onProgress?.('Ejecutando motor de conciliación…', 85);
    await yieldToMain();
    next = runReconciliationEngine(next, sessionId);
  }

  onProgress?.('Listo', 100);

  const importedCount = mergeStats
    ? mergeStats.added + mergeStats.updated + mergeStats.needsReview
    : incomingPartials.length;

  return {
    dataset: next,
    batch,
    imported: importedCount,
    errors: parsed.errors,
    skipped: parsed.skipped,
    mergeStats,
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

/** Conserva cruces conciliados; solo resetea pendientes para re-matching parcial. */
export function prepareSessionForPartialMatching(
  dataset: ReconciliationDataset,
  sessionId: string
): ReconciliationDataset {
  const sessionMovs = sessionMovements(dataset, sessionId);
  const preservedIds = new Set(
    sessionMovs.filter(isLockedReconciledMovement).map((m) => m.id)
  );

  const preservedMatches = dataset.matches.filter((m) => {
    if (m.sessionId !== sessionId) return false;
    if (!preservedIds.has(m.bankMovementId)) return false;
    const salesIds = m.salesMovementIds ?? [m.salesMovementId];
    return salesIds.every((id) => preservedIds.has(id));
  });

  const movements = dataset.movements.map((m) => {
    if (m.sessionId !== sessionId || preservedIds.has(m.id)) return m;
    return {
      ...m,
      workflowStatus: 'normalized' as const,
      matchedMovementId: undefined,
      matchId: undefined,
      ruleCodes: [],
    };
  });

  const otherMatches = dataset.matches.filter((m) => m.sessionId !== sessionId);

  return {
    ...dataset,
    movements,
    matches: [...otherMatches, ...preservedMatches],
  };
}

export function runReconciliationEngine(
  dataset: ReconciliationDataset,
  sessionId?: string,
  options: { fullReset?: boolean } = {}
): ReconciliationDataset {
  const sid = sessionId ?? dataset.activeSessionId;
  let base = options.fullReset
    ? resetSessionForMatching(dataset, sid)
    : prepareSessionForPartialMatching(dataset, sid);
  let movements = sessionMovements(base, sid);

  const bankMovements = movements.filter(
    (m) => m.sourceType !== 'sales_erp' || m.side === 'bank_or_gateway'
  );
  const salesMovements = movements.filter((m) => m.side === 'sales_application');

  const candidates = findMatchCandidates(bankMovements, salesMovements);

  const sessionMatches = base.matches.filter((m) => m.sessionId === sid);
  const newMatches = [...sessionMatches];
  const movementById = new Map(movements.map((m) => [m.id, m]));

  for (const cand of candidates) {
    const match = buildMatchFromCandidate(cand, sid);
    newMatches.push(match);
    const bank = movementById.get(cand.bank.id)!;
    if (cand.sales.length > 1) {
      const salesList = cand.sales.map((s) => movementById.get(s.id)!);
      const applied = applyGroupMatchToMovements(bank, salesList, match);
      movementById.set(bank.id, applied.bank);
      for (const s of applied.sales) {
        movementById.set(s.id, s);
      }
    } else {
      const sales = movementById.get(cand.sales[0]!.id)!;
      const applied = applyMatchToMovements(bank, sales, match);
      movementById.set(bank.id, applied.bank);
      movementById.set(sales.id, applied.sales);
    }
  }

  const otherMovements = base.movements.filter((m) => m.sessionId !== sid);
  movements = [...movementById.values()];

  let next: ReconciliationDataset = {
    ...base,
    movements: [...otherMovements, ...movements],
    matches: [
      ...base.matches.filter((m) => m.sessionId !== sid),
      ...newMatches,
    ],
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
    (m) =>
      !removedIds.has(m.bankMovementId) &&
      !removedIds.has(m.salesMovementId) &&
      !(m.salesMovementIds?.some((id) => removedIds.has(id)))
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
