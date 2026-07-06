import { newId, sessionMovements } from '../domain/dataset';
import {
  isLockedReconciledMovement,
  salesMovementBusinessKey,
  salesMovementCriticalFingerprint,
} from '../domain/salesMovementIdentity';
import type { CanonicalMovement, ReconciliationAlert, ReconciliationDataset } from '../domain/types';

export type SalesImportMergeStats = {
  added: number;
  updated: number;
  unchanged: number;
  needsReview: number;
};

export type SalesIncrementalMergeResult = {
  movements: CanonicalMovement[];
  stats: SalesImportMergeStats;
  newAlerts: ReconciliationAlert[];
};

type IncomingPartial = Omit<
  CanonicalMovement,
  'id' | 'batchId' | 'sessionId' | 'workflowStatus' | 'ruleCodes' | 'matchId' | 'matchedMovementId'
>;

function buildMovementFromPartial(
  partial: IncomingPartial,
  sessionId: string,
  batchId: string
): CanonicalMovement {
  return {
    ...partial,
    id: newId('mv'),
    batchId,
    sessionId,
    workflowStatus: 'normalized',
    ruleCodes: [],
    metadata: { ...partial.metadata },
  };
}

function applyPartialToExisting(
  existing: CanonicalMovement,
  partial: IncomingPartial,
  batchId: string
): CanonicalMovement {
  return {
    ...existing,
    batchId,
    transactionDate: partial.transactionDate,
    amount: partial.amount,
    currency: partial.currency,
    operationNumber: partial.operationNumber,
    operationNumberRaw: partial.operationNumberRaw,
    paymentMethod: partial.paymentMethod,
    documentNumber: partial.documentNumber,
    saleAmount: partial.saleAmount,
    branch: partial.branch,
    customerName: partial.customerName,
    registeredBy: partial.registeredBy,
    description: partial.description,
    metadata: { ...existing.metadata, ...partial.metadata },
  };
}

function markForReview(m: CanonicalMovement): CanonicalMovement {
  return {
    ...m,
    workflowStatus: 'in_review',
    matchedMovementId: undefined,
    matchId: undefined,
    ruleCodes: [...new Set([...m.ruleCodes, 'RULE-005'])],
  };
}

function makeErpChangeAlert(
  sessionId: string,
  movementId: string,
  documentNumber?: string
): ReconciliationAlert {
  return {
    id: newId('ra'),
    sessionId,
    ruleCode: 'RULE-005',
    severity: 'warning',
    message: documentNumber
      ? `El ERP modificó el comprobante ${documentNumber} que ya estaba conciliado. Revise el cruce.`
      : 'El ERP modificó una venta ya conciliada. Revise el cruce.',
    movementIds: [movementId],
    resolved: false,
    createdAt: new Date().toISOString(),
  };
}

/** Fusiona ventas ERP importadas con las ya existentes en la sesión (sin duplicar conciliados). */
export function mergeSalesMovementsIncremental(
  dataset: ReconciliationDataset,
  sessionId: string,
  batchId: string,
  incoming: IncomingPartial[]
): SalesIncrementalMergeResult {
  const existingSales = sessionMovements(dataset, sessionId).filter(
    (m) => m.sourceType === 'sales_erp' || m.side === 'sales_application'
  );

  const byKey = new Map<string, CanonicalMovement>();
  for (const m of existingSales) {
    byKey.set(salesMovementBusinessKey(m), m);
  }

  const stats: SalesImportMergeStats = {
    added: 0,
    updated: 0,
    unchanged: 0,
    needsReview: 0,
  };
  const newAlerts: ReconciliationAlert[] = [];
  const reviewClusters: string[][] = [];

  for (const partial of incoming) {
    const key = salesMovementBusinessKey(partial);
    const existing = byKey.get(key);

    if (!existing) {
      const created = buildMovementFromPartial(partial, sessionId, batchId);
      byKey.set(key, created);
      stats.added += 1;
      continue;
    }

    const nextFingerprint = salesMovementCriticalFingerprint(partial);
    const prevFingerprint = salesMovementCriticalFingerprint(existing);

    if (isLockedReconciledMovement(existing)) {
      if (nextFingerprint === prevFingerprint) {
        stats.unchanged += 1;
        continue;
      }
      const reviewed = markForReview(applyPartialToExisting(existing, partial, batchId));
      byKey.set(key, reviewed);
      const cluster = new Set<string>([existing.id]);
      if (existing.matchedMovementId) cluster.add(existing.matchedMovementId);
      if (existing.matchId) {
        for (const m of dataset.movements) {
          if (m.sessionId === sessionId && m.matchId === existing.matchId) {
            cluster.add(m.id);
          }
        }
      }
      reviewClusters.push([...cluster]);
      newAlerts.push(makeErpChangeAlert(sessionId, reviewed.id, reviewed.documentNumber));
      stats.needsReview += 1;
      continue;
    }

    if (nextFingerprint === prevFingerprint) {
      stats.unchanged += 1;
      continue;
    }

    byKey.set(
      key,
      applyPartialToExisting(
        {
          ...existing,
          workflowStatus: 'normalized',
          matchedMovementId: undefined,
          matchId: undefined,
          ruleCodes: [],
        },
        partial,
        batchId
      )
    );
    stats.updated += 1;
  }

  const sessionNonSales = dataset.movements.filter(
    (m) =>
      m.sessionId === sessionId &&
      m.sourceType !== 'sales_erp' &&
      m.side !== 'sales_application'
  );

  const salesInSession = [...byKey.values()];

  let sessionSlice = [...sessionNonSales, ...salesInSession];
  for (const cluster of reviewClusters) {
    const releaseIds = new Set(
      cluster.filter((id) => {
        const m = sessionSlice.find((x) => x.id === id);
        return m && m.workflowStatus !== 'in_review';
      })
    );
    sessionSlice = sessionSlice.map((m) => {
      if (!releaseIds.has(m.id)) return m;
      return {
        ...m,
        workflowStatus: 'normalized' as const,
        matchedMovementId: undefined,
        matchId: undefined,
        ruleCodes: [],
      };
    });
  }

  const movements = [
    ...dataset.movements.filter((m) => m.sessionId !== sessionId),
    ...sessionSlice,
  ];

  return {
    movements,
    stats,
    newAlerts,
  };
}
